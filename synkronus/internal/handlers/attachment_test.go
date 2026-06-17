package handlers

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/opendataensemble/synkronus/internal/handlers/mocks"
	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockAttachmentService struct {
	mock.Mock
}

func (m *mockAttachmentService) Save(ctx context.Context, attachmentID string, file io.Reader) error {
	args := m.Called(ctx, attachmentID, file)
	return args.Error(0)
}

func (m *mockAttachmentService) SaveUpload(ctx context.Context, attachmentID string, data []byte, contentType string) (attachment.SaveUploadResult, error) {
	args := m.Called(ctx, attachmentID, data, contentType)
	if args.Get(0) == nil {
		return attachment.SaveUploadResult{}, args.Error(1)
	}
	return args.Get(0).(attachment.SaveUploadResult), args.Error(1)
}

func (m *mockAttachmentService) Get(ctx context.Context, attachmentID string) (io.ReadCloser, error) {
	args := m.Called(ctx, attachmentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(io.ReadCloser), args.Error(1)
}

func (m *mockAttachmentService) Exists(ctx context.Context, attachmentID string) (bool, error) {
	args := m.Called(ctx, attachmentID)
	return args.Bool(0), args.Error(1)
}

func (m *mockAttachmentService) OpenForDownload(ctx context.Context, attachmentID string, preferOriginal bool) (io.ReadCloser, error) {
	args := m.Called(ctx, attachmentID, preferOriginal)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(io.ReadCloser), args.Error(1)
}

func (m *mockAttachmentService) ExistsForDownload(ctx context.Context, attachmentID string, preferOriginal bool) (bool, error) {
	args := m.Called(ctx, attachmentID, preferOriginal)
	return args.Bool(0), args.Error(1)
}

func (m *mockAttachmentService) WriteZip(ctx context.Context, w io.Writer, ids []string) error {
	args := m.Called(ctx, w, ids)
	return args.Error(0)
}

func TestAttachmentHandler_UploadAttachment(t *testing.T) {
	tests := []struct {
		name           string
		attachmentID   string
		setupMocks     func(*mockAttachmentService)
		expectedStatus int
		expectedBody   string
	}{
		{
			name:         "successful upload",
			attachmentID: "testfile.txt",
			setupMocks: func(mas *mockAttachmentService) {
				mas.On("SaveUpload", mock.Anything, "testfile.txt", mock.Anything, mock.Anything).
					Return(attachment.SaveUploadResult{ServedSize: 12, ServedContentType: "text/plain"}, nil)
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"status":"success"}`,
		},
		{
			name:         "file already exists",
			attachmentID: "existing.txt",
			setupMocks: func(mas *mockAttachmentService) {
				mas.On("SaveUpload", mock.Anything, "existing.txt", mock.Anything, mock.Anything).
					Return(attachment.SaveUploadResult{}, os.ErrExist)
			},
			expectedStatus: http.StatusConflict,
			expectedBody:   `{"error":"file already exists", "message":"Attachment already exists"}`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Setup mock service
			mockSvc := &mockAttachmentService{}
			tc.setupMocks(mockSvc)

			var manifestRecords int
			mockManifest := &mocks.MockAttachmentManifestService{
				RecordOperationFunc: func(ctx context.Context, attachmentID, operation, clientID string, size *int, contentType *string) error {
					manifestRecords++
					if tc.expectedStatus == http.StatusOK {
						assert.Equal(t, tc.attachmentID, attachmentID)
						assert.Equal(t, "create", operation)
						assert.Equal(t, "", clientID)
					}
					return nil
				},
			}

			// Create handler with mock service
			handler := NewAttachmentHandler(logger.NewLogger(), mockSvc, mockManifest, mocks.NewMockSyncService())

			// Create a test file
			var b bytes.Buffer
			w := multipart.NewWriter(&b)
			part, _ := w.CreateFormFile("file", "test.txt")
			part.Write([]byte("test content"))
			w.Close()

			// Create request
			req := httptest.NewRequest("PUT", "/api/attachments/"+tc.attachmentID, &b)
			req.Header.Set("Content-Type", w.FormDataContentType())

			// Create response recorder
			rr := httptest.NewRecorder()

			// Create router and make request
			r := chi.NewRouter()
			r.Put("/api/attachments/{attachment_id}", handler.UploadAttachment)
			r.ServeHTTP(rr, req)

			// Check response
			assert.Equal(t, tc.expectedStatus, rr.Code)
			if tc.expectedBody != "" {
				assert.JSONEq(t, tc.expectedBody, rr.Body.String())
			}
			if tc.expectedStatus == http.StatusOK {
				assert.Equal(t, 1, manifestRecords, "manifest RecordOperation should run after successful save")
			} else {
				assert.Equal(t, 0, manifestRecords, "manifest should not be updated when upload fails")
			}
		})
	}
}

func TestAttachmentHandler_DownloadAttachment(t *testing.T) {
	tests := []struct {
		name           string
		attachmentID   string
		setupMocks     func(*mockAttachmentService)
		expectedStatus int
		expectedBody   string
	}{
		{
			name:         "successful download",
			attachmentID: "testfile.txt",
			setupMocks: func(mas *mockAttachmentService) {
				mas.On("ExistsForDownload", mock.Anything, "testfile.txt", false).
					Return(true, nil)
				mas.On("OpenForDownload", mock.Anything, "testfile.txt", false).
					Return(io.NopCloser(bytes.NewBufferString("file content")), nil)
			},
			expectedStatus: http.StatusOK,
			expectedBody:   "file content",
		},
		{
			name:         "file not found",
			attachmentID: "nonexistent.txt",
			setupMocks: func(mas *mockAttachmentService) {
				mas.On("ExistsForDownload", mock.Anything, "nonexistent.txt", false).
					Return(false, nil)
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Setup mock service
			mockSvc := &mockAttachmentService{}
			tc.setupMocks(mockSvc)

			mockManifest := &mocks.MockAttachmentManifestService{}

			// Create handler with mock service
			handler := NewAttachmentHandler(logger.NewLogger(), mockSvc, mockManifest, mocks.NewMockSyncService())

			// Create request
			req := httptest.NewRequest("GET", "/api/attachments/"+tc.attachmentID, nil)

			// Create response recorder
			rr := httptest.NewRecorder()

			// Create router and make request
			r := chi.NewRouter()
			r.Get("/api/attachments/{attachment_id}", handler.DownloadAttachment)
			r.ServeHTTP(rr, req)

			// Check response
			assert.Equal(t, tc.expectedStatus, rr.Code)
			if tc.expectedBody != "" {
				assert.Equal(t, tc.expectedBody, rr.Body.String())
			}
		})
	}
}

func TestAttachmentHandler_DownloadAttachment_WithOriginalQuery(t *testing.T) {
	mockSvc := &mockAttachmentService{}
	mockSvc.On("ExistsForDownload", mock.Anything, "photo.jpg", true).Return(true, nil)
	mockSvc.On("OpenForDownload", mock.Anything, "photo.jpg", true).
		Return(io.NopCloser(bytes.NewBufferString("original bytes")), nil)

	handler := NewAttachmentHandler(logger.NewLogger(), mockSvc, &mocks.MockAttachmentManifestService{}, mocks.NewMockSyncService())

	req := httptest.NewRequest("GET", "/api/attachments/photo.jpg?original=true", nil)
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	r.Get("/api/attachments/{attachment_id}", handler.DownloadAttachment)
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "original bytes", rr.Body.String())
}

func TestAttachmentHandler_CheckAttachment(t *testing.T) {
	tests := []struct {
		name           string
		attachmentID   string
		setupMocks     func(*mockAttachmentService)
		expectedStatus int
	}{
		{
			name:         "file exists",
			attachmentID: "exists.txt",
			setupMocks: func(mas *mockAttachmentService) {
				mas.On("ExistsForDownload", mock.Anything, "exists.txt", false).
					Return(true, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:         "file not found",
			attachmentID: "nonexistent.txt",
			setupMocks: func(mas *mockAttachmentService) {
				mas.On("ExistsForDownload", mock.Anything, "nonexistent.txt", false).
					Return(false, nil)
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Setup mock service
			mockSvc := &mockAttachmentService{}
			tc.setupMocks(mockSvc)

			mockManifest := &mocks.MockAttachmentManifestService{}

			// Create handler with mock service
			handler := NewAttachmentHandler(logger.NewLogger(), mockSvc, mockManifest, mocks.NewMockSyncService())

			// Create request
			req := httptest.NewRequest("HEAD", "/api/attachments/"+tc.attachmentID, nil)

			// Create response recorder
			rr := httptest.NewRecorder()

			// Create router and make request
			r := chi.NewRouter()
			r.Head("/api/attachments/{attachment_id}", handler.CheckAttachment)
			r.ServeHTTP(rr, req)

			// Check response
			assert.Equal(t, tc.expectedStatus, rr.Code)
		})
	}
}

func TestAttachmentHandler_CheckAttachment_WithOriginalQuery(t *testing.T) {
	mockSvc := &mockAttachmentService{}
	mockSvc.On("ExistsForDownload", mock.Anything, "photo.jpg", true).Return(true, nil)

	handler := NewAttachmentHandler(logger.NewLogger(), mockSvc, &mocks.MockAttachmentManifestService{}, mocks.NewMockSyncService())
	req := httptest.NewRequest("HEAD", "/api/attachments/photo.jpg?original=yes", nil)
	rr := httptest.NewRecorder()
	r := chi.NewRouter()
	r.Head("/api/attachments/{attachment_id}", handler.CheckAttachment)
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

type errReader struct{}

func (errReader) Read(p []byte) (int, error) { return 0, errors.New("read error") }
func (errReader) Close() error               { return nil }

func TestDownloadAttachment_StreamingErrorLogged(t *testing.T) {
	var buf bytes.Buffer
	log := logger.NewLogger(logger.WithOutputWriter(&buf))

	mockSvc := &mockAttachmentService{}
	mockSvc.On("ExistsForDownload", mock.Anything, "badfile", false).Return(true, nil)
	mockSvc.On("OpenForDownload", mock.Anything, "badfile", false).Return(io.NopCloser(errReader{}), nil)

	mockManifest := &mocks.MockAttachmentManifestService{}

	handler := NewAttachmentHandler(log, mockSvc, mockManifest, mocks.NewMockSyncService())

	req := httptest.NewRequest("GET", "/api/attachments/badfile", nil)
	rr := httptest.NewRecorder()
	r := chi.NewRouter()
	r.Get("/api/attachments/{attachment_id}", handler.DownloadAttachment)
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, buf.String(), "Failed to stream attachment")
}

func TestAttachmentHandler_ExportAllAttachmentsZip(t *testing.T) {
	t.Run("storage unavailable", func(t *testing.T) {
		handler := NewAttachmentHandler(logger.NewLogger(), nil, &mocks.MockAttachmentManifestService{}, mocks.NewMockSyncService())
		req := httptest.NewRequest(http.MethodGet, "/api/attachments/export-zip", nil)
		rr := httptest.NewRecorder()
		handler.ExportAllAttachmentsZip(rr, req)
		assert.Equal(t, http.StatusServiceUnavailable, rr.Code)
	})

	t.Run("list error", func(t *testing.T) {
		mockSvc := &mockAttachmentService{}
		mockManifest := &mocks.MockAttachmentManifestService{
			ListAllCurrentAttachmentIDsFunc: func(ctx context.Context) ([]string, error) {
				return nil, errors.New("db error")
			},
		}
		handler := NewAttachmentHandler(logger.NewLogger(), mockSvc, mockManifest, mocks.NewMockSyncService())
		req := httptest.NewRequest(http.MethodGet, "/api/attachments/export-zip", nil)
		rr := httptest.NewRecorder()
		handler.ExportAllAttachmentsZip(rr, req)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
	})

	t.Run("write zip success", func(t *testing.T) {
		mockSvc := &mockAttachmentService{}
		mockManifest := &mocks.MockAttachmentManifestService{
			ListAllCurrentAttachmentIDsFunc: func(ctx context.Context) ([]string, error) {
				return []string{"a"}, nil
			},
		}
		mockSvc.On("WriteZip", mock.Anything, mock.Anything, []string{"a"}).Return(nil)
		handler := NewAttachmentHandler(logger.NewLogger(), mockSvc, mockManifest, mocks.NewMockSyncService())
		req := httptest.NewRequest(http.MethodGet, "/api/attachments/export-zip", nil)
		rr := httptest.NewRecorder()
		handler.ExportAllAttachmentsZip(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "application/zip", rr.Header().Get("Content-Type"))
		mockSvc.AssertExpectations(t)
	})

	t.Run("write zip error before body", func(t *testing.T) {
		mockSvc := &mockAttachmentService{}
		mockManifest := &mocks.MockAttachmentManifestService{
			ListAllCurrentAttachmentIDsFunc: func(ctx context.Context) ([]string, error) {
				return []string{"a"}, nil
			},
		}
		mockSvc.On("WriteZip", mock.Anything, mock.Anything, []string{"a"}).Return(errors.New("write fail"))
		handler := NewAttachmentHandler(logger.NewLogger(), mockSvc, mockManifest, mocks.NewMockSyncService())
		req := httptest.NewRequest(http.MethodGet, "/api/attachments/export-zip", nil)
		rr := httptest.NewRecorder()
		handler.ExportAllAttachmentsZip(rr, req)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
	})
}
