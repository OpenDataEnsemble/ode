package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/opendataensemble/synkronus/internal/handlers/mocks"
	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

func TestAttachmentManifestHandler(t *testing.T) {
	// Create a logger for testing
	log := logger.NewLogger()

	// Create test config
	testConfig := mocks.NewTestConfig()

	// Create mock services
	mockAuthService := mocks.NewMockAuthService()
	mockAppBundleService := mocks.NewMockAppBundleService()
	mockSyncService := mocks.NewMockSyncService()
	mockUserService := mocks.NewMockUserService()
	mockVersionService := mocks.NewMockVersionService()

	// Initialize the mock sync service
	if err := mockSyncService.Initialize(context.Background()); err != nil {
		t.Fatalf("Failed to initialize mock sync service: %v", err)
	}

	// Create mock attachment manifest service
	mockAttachmentManifestService := &mocks.MockAttachmentManifestService{
		GetManifestFunc: func(ctx context.Context, req attachment.AttachmentManifestRequest) (*attachment.AttachmentManifestResponse, error) {
			return &attachment.AttachmentManifestResponse{
				CurrentVersion: 45,
				Operations: []attachment.AttachmentOperation{
					{
						Operation:    "download",
						AttachmentID: "test-attachment-123.jpg",
						DownloadURL:  stringPtr("http://localhost:8080/attachments/test-attachment-123.jpg"),
						Size:         intPtr(524288),
						ContentType:  stringPtr("image/jpeg"),
						Version:      43,
					},
					{
						Operation:    "delete",
						AttachmentID: "old-attachment-456.png",
						Version:      44,
					},
				},
				TotalDownloadSize: 524288,
				OperationCount: attachment.OperationCount{
					Download: 1,
					Delete:   1,
				},
			}, nil
		},
	}

	// Create a new handler
	mockDataExportService := mocks.NewMockDataExportService()
	h := NewHandler(
		log,
		testConfig,
		mockAuthService,
		mockAppBundleService,
		mockSyncService,
		mockUserService,
		mockVersionService,
		mockAttachmentManifestService,
		mockDataExportService,
	)

	tests := []struct {
		name           string
		requestBody    attachment.AttachmentManifestRequest
		expectedStatus int
		expectedOps    int
	}{
		{
			name: "successful manifest request",
			requestBody: attachment.AttachmentManifestRequest{
				ClientID:     "mobile-app-123",
				SinceVersion: 42,
			},
			expectedStatus: http.StatusOK,
			expectedOps:    2,
		},
		{
			name: "missing client_id",
			requestBody: attachment.AttachmentManifestRequest{
				SinceVersion: 42,
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "negative since_version",
			requestBody: attachment.AttachmentManifestRequest{
				ClientID:     "mobile-app-123",
				SinceVersion: -1,
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create request body
			body, err := json.Marshal(tt.requestBody)
			if err != nil {
				t.Fatalf("Failed to marshal request body: %v", err)
			}

			// Create request
			req := httptest.NewRequest(http.MethodPost, "/attachments/manifest", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			// Create response recorder
			w := httptest.NewRecorder()

			// Call the handler
			h.AttachmentManifestHandler(w, req)

			// Check status code
			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// For successful requests, check response body
			if tt.expectedStatus == http.StatusOK {
				var response attachment.AttachmentManifestResponse
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if len(response.Operations) != tt.expectedOps {
					t.Errorf("Expected %d operations, got %d", tt.expectedOps, len(response.Operations))
				}

				if response.CurrentVersion != 45 {
					t.Errorf("Expected current version 45, got %d", response.CurrentVersion)
				}

				if response.TotalDownloadSize != 524288 {
					t.Errorf("Expected total download size 524288, got %d", response.TotalDownloadSize)
				}

				if response.OperationCount.Download != 1 {
					t.Errorf("Expected 1 download operation, got %d", response.OperationCount.Download)
				}

				if response.OperationCount.Delete != 1 {
					t.Errorf("Expected 1 delete operation, got %d", response.OperationCount.Delete)
				}
			}
		})
	}
}

// Helper functions for creating pointers
func stringPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}
