package handlers

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/opendataensemble/synkronus/internal/handlers/mocks"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/pkg/logger"
	authmw "github.com/opendataensemble/synkronus/pkg/middleware/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPushAppBundle(t *testing.T) {
	// Create a logger for testing
	log := logger.NewLogger()

	// Create mock services for testing
	mockAuthService := mocks.NewMockAuthService()
	mockAppBundleService := mocks.NewMockAppBundleService()
	mockSyncService := mocks.NewMockSyncService()
	mockUserService := mocks.NewMockUserService()
	mockVersionService := mocks.NewMockVersionService()
	mockConfig := mocks.NewTestConfig()

	// Create a handler for testing
	h := NewHandler(log, mockConfig, mockAuthService, mockAppBundleService, mockSyncService, mockUserService, mockVersionService)

	// Create a temporary test file
	tempDir := t.TempDir()
	testZipPath := filepath.Join(tempDir, "test-bundle.zip")
	testZipContent := []byte("mock zip file content")
	err := os.WriteFile(testZipPath, testZipContent, 0644)
	require.NoError(t, err)

	// Test cases
	tests := []struct {
		name           string
		setupRequest   func() (*http.Request, error)
		setupContext   func(r *http.Request)
		expectedStatus int
		expectedBody   string
	}{
		{
			name: "Successful Push - Admin User",
			setupRequest: func() (*http.Request, error) {
				// Create a multipart form with a test file
				body := &bytes.Buffer{}
				writer := multipart.NewWriter(body)
				part, err := writer.CreateFormFile("bundle", "test-bundle.zip")
				if err != nil {
					return nil, err
				}

				// Open the test file
				file, err := os.Open(testZipPath)
				if err != nil {
					return nil, err
				}
				defer file.Close()

				// Copy the file content to the form
				_, err = io.Copy(part, file)
				if err != nil {
					return nil, err
				}

				err = writer.Close()
				if err != nil {
					return nil, err
				}

				// Create the request
				req := httptest.NewRequest(http.MethodPost, "/app-bundle/push", body)
				req.Header.Set("Content-Type", writer.FormDataContentType())
				return req, nil
			},
			setupContext: func(r *http.Request) {
				// Add admin user to context
				adminUser := models.User{
					ID:       uuid.New(),
					Username: "admin",
					Role:     models.RoleAdmin,
				}
				ctx := context.WithValue(r.Context(), authmw.UserKey, &adminUser)
				*r = *r.WithContext(ctx)
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `"message":"App bundle successfully pushed"`,
		},
		{
			name: "Unauthorized - No User in Context",
			setupRequest: func() (*http.Request, error) {
				req := httptest.NewRequest(http.MethodPost, "/app-bundle/push", nil)
				return req, nil
			},
			setupContext: func(r *http.Request) {
				// No user in context
			},
			expectedStatus: http.StatusUnauthorized,
			expectedBody:   "Unauthorized",
		},
		{
			name: "Bad Request - No Multipart Form",
			setupRequest: func() (*http.Request, error) {
				req := httptest.NewRequest(http.MethodPost, "/app-bundle/push", nil)
				return req, nil
			},
			setupContext: func(r *http.Request) {
				// Add admin user to context
				adminUser := models.User{
					ID:       uuid.New(),
					Username: "admin",
					Role:     models.RoleAdmin,
				}
				ctx := context.WithValue(r.Context(), authmw.UserKey, &adminUser)
				*r = *r.WithContext(ctx)
			},
			expectedStatus: http.StatusBadRequest,
			expectedBody:   "Invalid request format",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Setup request
			req, err := tc.setupRequest()
			require.NoError(t, err)

			// Setup context
			tc.setupContext(req)

			// Create a response recorder
			rr := httptest.NewRecorder()

			// Call the handler
			h.PushAppBundle(rr, req)

			// Check the status code
			assert.Equal(t, tc.expectedStatus, rr.Code)

			// Check the response body
			if tc.expectedBody != "" {
				assert.Contains(t, rr.Body.String(), tc.expectedBody)
			}
		})
	}
}

func TestGetAppBundleVersions(t *testing.T) {
	// Create a logger for testing
	log := logger.NewLogger()

	// Create mock services for testing
	mockAuthService := mocks.NewMockAuthService()
	mockAppBundleService := mocks.NewMockAppBundleService()
	mockSyncService := mocks.NewMockSyncService()
	mockUserService := mocks.NewMockUserService()
	mockVersionService := mocks.NewMockVersionService()
	mockConfig := mocks.NewTestConfig()

	// Create a handler for testing
	h := NewHandler(log, mockConfig, mockAuthService, mockAppBundleService, mockSyncService, mockUserService, mockVersionService)

	// Test cases
	tests := []struct {
		name           string
		setupRequest   func() *http.Request
		expectedStatus int
		expectedBody   string
	}{
		{
			name: "Successful Get Versions",
			setupRequest: func() *http.Request {
				return httptest.NewRequest(http.MethodGet, "/app-bundle/versions", nil)
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `"versions":["20250101-000000","20250102-000000"]`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Setup request
			req := tc.setupRequest()

			// Create a response recorder
			rr := httptest.NewRecorder()

			// Call the handler
			h.GetAppBundleVersions(rr, req)

			// Check the status code
			assert.Equal(t, tc.expectedStatus, rr.Code)

			// Check the response body
			if tc.expectedBody != "" {
				assert.Contains(t, rr.Body.String(), tc.expectedBody)
			}
		})
	}
}

func TestSwitchAppBundleVersion(t *testing.T) {
	// Create a logger for testing
	log := logger.NewLogger()

	// Create mock services for testing
	mockAuthService := mocks.NewMockAuthService()
	mockAppBundleService := mocks.NewMockAppBundleService()
	mockSyncService := mocks.NewMockSyncService()
	mockUserService := mocks.NewMockUserService()
	mockVersionService := mocks.NewMockVersionService()
	mockConfig := mocks.NewTestConfig()

	// Create a handler for testing
	h := NewHandler(log, mockConfig, mockAuthService, mockAppBundleService, mockSyncService, mockUserService, mockVersionService)

	// Test cases
	tests := []struct {
		name           string
		version        string
		setupContext   func(r *http.Request)
		expectedStatus int
		expectedBody   string
	}{
		{
			name:    "Successful Switch - Admin User",
			version: "1.0.0-alpha007",
			setupContext: func(r *http.Request) {
				// Add admin user to context
				adminUser := models.User{
					ID:       uuid.New(),
					Username: "admin",
					Role:     models.RoleAdmin,
				}
				ctx := context.WithValue(r.Context(), authmw.UserKey, &adminUser)
				*r = *r.WithContext(ctx)
			},
			expectedStatus: http.StatusOK,
			expectedBody:   `"message":"Switched to app bundle version`,
		},
		{
			name:    "Unauthorized - No User in Context",
			version: "1.0.0-alpha007",
			setupContext: func(r *http.Request) {
				// No user in context
			},
			expectedStatus: http.StatusUnauthorized,
			expectedBody:   "Unauthorized",
		},
		{
			name:    "Bad Request - No Version Specified",
			version: "", // Empty version
			setupContext: func(r *http.Request) {
				// Add admin user to context
				adminUser := models.User{
					ID:       uuid.New(),
					Username: "admin",
					Role:     models.RoleAdmin,
				}
				ctx := context.WithValue(r.Context(), authmw.UserKey, &adminUser)
				*r = *r.WithContext(ctx)
			},
			expectedStatus: http.StatusBadRequest,
			expectedBody:   "Version is required",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create a test request with the version as a URL parameter
			url := "/app-bundle/switch/" + tc.version
			req := httptest.NewRequest(http.MethodPost, url, nil)

			// Setup the chi router context with URL params
			rctx := chi.NewRouteContext()
			if tc.version != "" {
				rctx.URLParams.Add("version", tc.version)
			}
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			// Setup context with user information
			tc.setupContext(req)

			// Create a response recorder
			rr := httptest.NewRecorder()

			// Call the handler
			h.SwitchAppBundleVersion(rr, req)

			// Check the status code
			assert.Equal(t, tc.expectedStatus, rr.Code)

			// Check the response body
			if tc.expectedBody != "" {
				assert.Contains(t, rr.Body.String(), tc.expectedBody)
			}
		})
	}
}
