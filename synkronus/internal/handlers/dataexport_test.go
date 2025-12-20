package handlers

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/opendataensemble/synkronus/internal/handlers/mocks"
)

func TestHandler_ParquetExportHandler(t *testing.T) {
	tests := []struct {
		name           string
		setupMock      func(*mocks.MockDataExportService)
		expectedStatus int
		expectedHeader string
		expectError    bool
	}{
		{
			name: "successful export",
			setupMock: func(mock *mocks.MockDataExportService) {
				mock.ExportParquetZipFunc = func(ctx context.Context) (io.ReadCloser, error) {
					// Return a mock ZIP file content
					zipContent := []byte("PK\x03\x04mock zip content")
					return io.NopCloser(bytes.NewReader(zipContent)), nil
				}
			},
			expectedStatus: http.StatusOK,
			expectedHeader: "application/zip",
			expectError:    false,
		},
		{
			name: "export service error",
			setupMock: func(mock *mocks.MockDataExportService) {
				mock.ExportParquetZipFunc = func(ctx context.Context) (io.ReadCloser, error) {
					return nil, io.ErrUnexpectedEOF
				}
			},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create handler with mock services
			h, _ := createTestHandler()

			// Setup mock data export service
			mockDataExportService := mocks.NewMockDataExportService()
			tt.setupMock(mockDataExportService)
			h.dataExportService = mockDataExportService

			// Create request
			req := httptest.NewRequest(http.MethodGet, "/dataexport/parquet", nil)
			w := httptest.NewRecorder()

			// Call handler
			h.ParquetExportHandler(w, req)

			// Check status code
			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// Check content type for successful requests
			if !tt.expectError && tt.expectedHeader != "" {
				contentType := w.Header().Get("Content-Type")
				if contentType != tt.expectedHeader {
					t.Errorf("Expected Content-Type %s, got %s", tt.expectedHeader, contentType)
				}
			}

			// Check Content-Disposition header for successful requests
			if !tt.expectError {
				disposition := w.Header().Get("Content-Disposition")
				expectedDisposition := "attachment; filename=\"observations_export.zip\""
				if disposition != expectedDisposition {
					t.Errorf("Expected Content-Disposition %s, got %s", expectedDisposition, disposition)
				}
			}

			// For successful requests, verify we got some content
			if !tt.expectError {
				body := w.Body.Bytes()
				if len(body) == 0 {
					t.Error("Expected response body but got empty content")
				}
			}
		})
	}
}

func TestHandler_ParquetExportHandler_Integration(t *testing.T) {
	// This test verifies the handler works with a more realistic mock
	h, _ := createTestHandler()

	// Setup mock data export service with realistic behavior
	mockDataExportService := mocks.NewMockDataExportService()
	mockDataExportService.ExportParquetZipFunc = func(ctx context.Context) (io.ReadCloser, error) {
		// Simulate a small ZIP file with proper headers
		zipContent := []byte{
			0x50, 0x4b, 0x03, 0x04, // ZIP file signature
			0x14, 0x00, 0x00, 0x00, // Version, flags
			0x00, 0x00, 0x00, 0x00, // Compression, time, date
			0x00, 0x00, 0x00, 0x00, // CRC32
			0x00, 0x00, 0x00, 0x00, // Compressed size
			0x00, 0x00, 0x00, 0x00, // Uncompressed size
			0x00, 0x00, 0x00, 0x00, // Filename length, extra length
		}
		return io.NopCloser(bytes.NewReader(zipContent)), nil
	}
	h.dataExportService = mockDataExportService

	// Create request
	req := httptest.NewRequest(http.MethodGet, "/dataexport/parquet", nil)
	w := httptest.NewRecorder()

	// Call handler
	h.ParquetExportHandler(w, req)

	// Verify response
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Verify headers
	if w.Header().Get("Content-Type") != "application/zip" {
		t.Errorf("Expected Content-Type application/zip, got %s", w.Header().Get("Content-Type"))
	}

	// Verify we got the ZIP content
	body := w.Body.Bytes()
	if len(body) == 0 {
		t.Error("Expected ZIP content but got empty response")
	}

	// Verify ZIP signature
	if len(body) >= 4 {
		zipSig := []byte{0x50, 0x4b, 0x03, 0x04}
		if !bytes.Equal(body[:4], zipSig) {
			t.Error("Response does not start with ZIP file signature")
		}
	}
}
