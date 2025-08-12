package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/opendataensemble/synkronus/internal/handlers"
	"github.com/opendataensemble/synkronus/internal/handlers/mocks"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/pkg/logger"
	authmw "github.com/opendataensemble/synkronus/pkg/middleware/auth"
)

func TestProtectedEndpoints(t *testing.T) {
	// Create a logger for testing
	log := logger.NewLogger()

	// Create mock services for testing
	mockAuthService := mocks.NewMockAuthService()
	mockAppBundleService := mocks.NewMockAppBundleService()
	mockSyncService := mocks.NewMockSyncService()
	// Initialize the sync service
	if err := mockSyncService.Initialize(context.Background()); err != nil {
		t.Fatalf("Failed to initialize mock sync service: %v", err)
	}
	mockUserService := mocks.NewMockUserService()
	mockVersionService := mocks.NewMockVersionService()
	mockAttachmentManifestService := &mocks.MockAttachmentManifestService{}
	mockConfig := mocks.NewTestConfig()

	// Create a mock handler for testing
	mockDataExportService := mocks.NewMockDataExportService()
	mockHandler := handlers.NewHandler(
		log,
		mockConfig,
		mockAuthService,
		mockAppBundleService,
		mockSyncService,
		mockUserService,
		mockVersionService,
		mockAttachmentManifestService,
		mockDataExportService,
	)

	// Create a new router with the handler
	r := chi.NewRouter()

	// Add middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Add CORS middleware
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"accept", "authorization", "content-type", "x-csrf-token", "if-none-match"},
		ExposedHeaders:   []string{"link", "etag"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Public endpoints
	r.Get("/health", mockHandler.HealthCheck)
	r.Get("/api/versions", mockHandler.GetAPIVersions)

	// Authentication routes
	r.Route("/auth", func(r chi.Router) {
		r.Post("/login", mockHandler.Login)
		r.Post("/refresh", mockHandler.RefreshToken)
	})

	// Protected routes - require authentication
	r.Group(func(r chi.Router) {
		// Add authentication middleware
		r.Use(authmw.AuthMiddleware(mockHandler.GetAuthService(), log))

		// Sync routes
		r.Route("/sync", func(r chi.Router) {
			// Pull endpoint - accessible to all authenticated users
			r.Post("/pull", mockHandler.Pull)

			// Push endpoint - requires read-write or admin role
			r.With(authmw.RequireRole(models.RoleReadWrite, models.RoleAdmin)).Post("/push", mockHandler.Push)
		})

		// App bundle routes
		r.Route("/app-bundle", func(r chi.Router) {
			// Read endpoints - accessible to all authenticated users
			r.Get("/manifest", mockHandler.GetAppBundleManifest)
			r.Get("/versions", mockHandler.GetAppBundleVersions)
			r.Get("/download/{path}", mockHandler.GetAppBundleFile)

			// Write endpoints - require admin role
			r.With(authmw.RequireRole(models.RoleAdmin)).Post("/push", mockHandler.PushAppBundle)
			r.With(authmw.RequireRole(models.RoleAdmin)).Post("/switch/{version}", mockHandler.SwitchAppBundleVersion)
		})

		// User routes
		r.Route("/users", func(r chi.Router) {
			// Admin-only routes
			r.With(authmw.RequireRole(models.RoleAdmin)).Post("/create", mockHandler.CreateUserHandler)
			r.With(authmw.RequireRole(models.RoleAdmin)).Delete("/delete/{username}", mockHandler.DeleteUserHandler)
			r.With(authmw.RequireRole(models.RoleAdmin)).Post("/reset-password", mockHandler.ResetPasswordHandler)
			r.With(authmw.RequireRole(models.RoleAdmin)).Get("/list", mockHandler.ListUsersHandler)
			// Authenticated user route
			r.Post("/change-password", mockHandler.ChangePasswordHandler)
		})
	})

	// Create a router
	router := r

	// Create a test server
	server := httptest.NewServer(router)
	defer server.Close()

	// Test cases
	tests := []struct {
		name           string
		endpoint       string
		method         string
		body           any
		withAuth       bool
		invalidToken   bool
		expiredToken   bool
		readOnlyUser   bool
		adminUser      bool
		expectedStatus int
	}{
		{
			name:           "Sync Pull - Without Auth",
			endpoint:       "/sync/pull",
			method:         http.MethodPost,
			body:           map[string]any{"client_id": "test-client"},
			withAuth:       false,
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Sync Pull - With Auth",
			endpoint:       "/sync/pull",
			method:         http.MethodPost,
			body:           map[string]any{"client_id": "test-client"},
			withAuth:       true,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Sync Push - Without Auth",
			endpoint:       "/sync/push",
			method:         http.MethodPost,
			body:           map[string]any{"transmission_id": "test-transmission", "client_id": "test-client", "records": []any{}},
			withAuth:       false,
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Sync Push - With Auth",
			endpoint:       "/sync/push",
			method:         http.MethodPost,
			body:           map[string]any{"transmission_id": "test-transmission", "client_id": "test-client", "records": []any{}},
			withAuth:       true,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "App Bundle Manifest - Without Auth",
			endpoint:       "/app-bundle/manifest",
			method:         http.MethodGet,
			body:           nil,
			withAuth:       false,
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "App Bundle Manifest - With Auth",
			endpoint:       "/app-bundle/manifest",
			method:         http.MethodGet,
			body:           nil,
			withAuth:       true,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "App Bundle File - Without Auth",
			endpoint:       "/app-bundle/download/index.html",
			method:         http.MethodGet,
			body:           nil,
			withAuth:       false,
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "App Bundle File - With Auth",
			endpoint:       "/app-bundle/download/index.html",
			method:         http.MethodGet,
			body:           nil,
			withAuth:       true,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Health Check - Without Auth",
			endpoint:       "/health",
			method:         http.MethodGet,
			body:           nil,
			withAuth:       false,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Health Check - With Auth",
			endpoint:       "/health",
			method:         http.MethodGet,
			body:           nil,
			withAuth:       true,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Sync Pull - With Invalid Token",
			endpoint:       "/sync/pull",
			method:         http.MethodPost,
			body:           map[string]any{"client_id": "test-client"},
			withAuth:       true,
			invalidToken:   true,
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Sync Push - With Expired Token",
			endpoint:       "/sync/push",
			method:         http.MethodPost,
			body:           map[string]any{"transmission_id": "test-transmission", "client_id": "test-client", "records": []any{}},
			withAuth:       true,
			expiredToken:   true,
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "App Bundle Manifest - With Invalid Token",
			endpoint:       "/app-bundle/manifest",
			method:         http.MethodGet,
			body:           nil,
			withAuth:       true,
			invalidToken:   true,
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Sync Push - With Read-Only User",
			endpoint:       "/sync/push",
			method:         http.MethodPost,
			body:           map[string]any{"transmission_id": "test-transmission", "client_id": "test-client", "records": []any{}},
			withAuth:       true,
			readOnlyUser:   true,
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "Sync Pull - With Read-Only User",
			endpoint:       "/sync/pull",
			method:         http.MethodPost,
			body:           map[string]any{"client_id": "test-client"},
			withAuth:       true,
			readOnlyUser:   true,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Sync Push - With Admin User",
			endpoint:       "/sync/push",
			method:         http.MethodPost,
			body:           map[string]any{"transmission_id": "test-transmission", "client_id": "test-client", "records": []any{}},
			withAuth:       true,
			readOnlyUser:   false,
			adminUser:      true,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "App Bundle Versions - With Read-Only User",
			endpoint:       "/app-bundle/versions",
			method:         http.MethodGet,
			body:           nil,
			withAuth:       true,
			readOnlyUser:   true,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "App Bundle Push - With Read-Only User",
			endpoint:       "/app-bundle/push",
			method:         http.MethodPost,
			body:           nil, // Multipart form would be tested in handler unit tests
			withAuth:       true,
			readOnlyUser:   true,
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "App Bundle Push - With Admin User",
			endpoint:       "/app-bundle/push",
			method:         http.MethodPost,
			body:           nil, // Multipart form would be tested in handler unit tests
			withAuth:       true,
			adminUser:      true,
			expectedStatus: http.StatusBadRequest, // Expect bad request since we're not sending a proper multipart form
		},
		{
			name:           "App Bundle Switch - With Read-Only User",
			endpoint:       "/app-bundle/switch/20250101-000000",
			method:         http.MethodPost,
			body:           nil,
			withAuth:       true,
			readOnlyUser:   true,
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "App Bundle Switch - With Admin User",
			endpoint:       "/app-bundle/switch/20250101-000000",
			method:         http.MethodPost,
			body:           nil,
			withAuth:       true,
			adminUser:      true,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Health Check - Public Endpoint",
			endpoint:       "/health",
			method:         http.MethodGet,
			body:           nil,
			withAuth:       false,
			expectedStatus: http.StatusOK,
		},
	}

	// For testing, we'll use specific token values that the mock service recognizes
	validToken := "mock-jwt-token-for-testuser" // Matches the format from GenerateToken
	readOnlyToken := "readOnlyToken"            // Special token for read-only user
	adminToken := "adminToken"                  // Special token for admin user
	invalidToken := "invalid-token"             // The mock auth service is configured to reject this
	expiredToken := "expired-token"             // We'll handle this in the test execution

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create request body
			var reqBody io.Reader
			if tc.body != nil {
				bodyBytes, err := json.Marshal(tc.body)
				if err != nil {
					t.Fatalf("Failed to marshal request body: %v", err)
				}
				reqBody = bytes.NewReader(bodyBytes)
			}

			// Create request
			req, err := http.NewRequest(tc.method, server.URL+tc.endpoint, reqBody)
			if err != nil {
				t.Fatalf("Failed to create request: %v", err)
			}

			// Add headers
			req.Header.Set("Content-Type", "application/json")
			if tc.withAuth {
				// Determine which token to use based on test case
				tokenToUse := validToken
				if tc.invalidToken {
					tokenToUse = invalidToken
				} else if tc.expiredToken {
					tokenToUse = expiredToken
				} else if tc.readOnlyUser {
					tokenToUse = readOnlyToken
				} else if tc.adminUser {
					tokenToUse = adminToken
				}
				req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tokenToUse))
			}

			// Send request
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatalf("Failed to send request: %v", err)
			}
			defer resp.Body.Close()

			// Check status code
			if resp.StatusCode != tc.expectedStatus {
				t.Errorf("Expected status code %d, got %d", tc.expectedStatus, resp.StatusCode)
			}
		})
	}
}
