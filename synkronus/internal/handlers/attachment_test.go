package handlers

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
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
				mas.On("Save", mock.Anything, "testfile.txt", mock.Anything).
					Return(nil)
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `{"status":"success"}`,
		},
		{
			name:         "file already exists",
			attachmentID: "existing.txt",
			setupMocks: func(mas *mockAttachmentService) {
				mas.On("Save", mock.Anything, "existing.txt", mock.Anything).
					Return(os.ErrExist)
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

			// Create handler with mock service
			handler := &AttachmentHandler{service: mockSvc}

			// Create a test file
			var b bytes.Buffer
			w := multipart.NewWriter(&b)
			part, _ := w.CreateFormFile("file", "test.txt")
			part.Write([]byte("test content"))
			w.Close()

			// Create request
			req := httptest.NewRequest("PUT", "/attachments/"+tc.attachmentID, &b)
			req.Header.Set("Content-Type", w.FormDataContentType())

			// Create response recorder
			rr := httptest.NewRecorder()

			// Create router and make request
			r := chi.NewRouter()
			r.Put("/attachments/{attachment_id}", handler.UploadAttachment)
			r.ServeHTTP(rr, req)

			// Check response
			assert.Equal(t, tc.expectedStatus, rr.Code)
			if tc.expectedBody != "" {
				assert.JSONEq(t, tc.expectedBody, rr.Body.String())
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
				mas.On("Exists", mock.Anything, "testfile.txt").
					Return(true, nil)
				mas.On("Get", mock.Anything, "testfile.txt").
					Return(io.NopCloser(bytes.NewBufferString("file content")), nil)
			},
			expectedStatus: http.StatusOK,
			expectedBody:   "file content",
		},
		{
			name:         "file not found",
			attachmentID: "nonexistent.txt",
			setupMocks: func(mas *mockAttachmentService) {
				mas.On("Exists", mock.Anything, "nonexistent.txt").
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

			// Create handler with mock service
			handler := &AttachmentHandler{service: mockSvc}

			// Create request
			req := httptest.NewRequest("GET", "/attachments/"+tc.attachmentID, nil)

			// Create response recorder
			rr := httptest.NewRecorder()

			// Create router and make request
			r := chi.NewRouter()
			r.Get("/attachments/{attachment_id}", handler.DownloadAttachment)
			r.ServeHTTP(rr, req)

			// Check response
			assert.Equal(t, tc.expectedStatus, rr.Code)
			if tc.expectedBody != "" {
				assert.Equal(t, tc.expectedBody, rr.Body.String())
			}
		})
	}
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
				mas.On("Exists", mock.Anything, "exists.txt").
					Return(true, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:         "file not found",
			attachmentID: "nonexistent.txt",
			setupMocks: func(mas *mockAttachmentService) {
				mas.On("Exists", mock.Anything, "nonexistent.txt").
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

			// Create handler with mock service
			handler := &AttachmentHandler{service: mockSvc}

			// Create request
			req := httptest.NewRequest("HEAD", "/attachments/"+tc.attachmentID, nil)

			// Create response recorder
			rr := httptest.NewRecorder()

			// Create router and make request
			r := chi.NewRouter()
			r.Head("/attachments/{attachment_id}", handler.CheckAttachment)
			r.ServeHTTP(rr, req)

			// Check response
			assert.Equal(t, tc.expectedStatus, rr.Code)
		})
	}
}
