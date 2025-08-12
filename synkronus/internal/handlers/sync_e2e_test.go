package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/opendataensemble/synkronus/internal/handlers/mocks"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/pkg/appbundle"
	"github.com/opendataensemble/synkronus/pkg/auth"
	"github.com/opendataensemble/synkronus/pkg/logger"
	authmw "github.com/opendataensemble/synkronus/pkg/middleware/auth"
	"github.com/opendataensemble/synkronus/pkg/sync"
	"github.com/opendataensemble/synkronus/pkg/version"
)

// TestSyncE2E_VersionIncrement tests end-to-end version increment behavior
func TestSyncE2E_VersionIncrement(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	// Setup test database and server
	db, cleanup := sync.SetupTestDatabase(t)
	defer cleanup()

	server := createTestServerWithDB(t, db)
	defer server.Close()

	// Test 1: Initial pull should return version 1 with no records
	pullReq := SyncPullRequest{
		ClientID: "test-client",
	}
	var pullBody []byte
	var err error
	pullBody, err = json.Marshal(pullReq)
	if err != nil {
		t.Fatalf("Failed to marshal pull request: %v", err)
	}

	req, err := http.NewRequest("POST", server.URL+"/sync/pull", bytes.NewReader(pullBody))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Logf("Pull response body: %s", string(body))
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
		return // Don't continue if pull failed
	}

	var pullResp SyncPullResponse
	if err := json.NewDecoder(resp.Body).Decode(&pullResp); err != nil {
		t.Fatalf("Failed to unmarshal pull response: %v", err)
	}

	if pullResp.CurrentVersion < 1 {
		t.Errorf("Expected current_version >= 1, got %d", pullResp.CurrentVersion)
	}

	if len(pullResp.Records) != 0 {
		t.Errorf("Expected 0 records, got %d", len(pullResp.Records))
	}
}

// TestSyncE2E_PartialFailure tests that partial failures are handled correctly
func TestSyncE2E_PartialFailure(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	// Setup test database and server
	db, cleanup := sync.SetupTestDatabase(t)
	defer cleanup()

	server := createTestServerWithDB(t, db)
	defer server.Close()

	// Create push request with one valid and one invalid record
	pushReq := SyncPushRequest{
		TransmissionID: "test-transmission",
		ClientID:       "test-client",
		Records: []sync.Observation{
			{
				ObservationID: "valid-record",
				FormType:      "observation",
				FormVersion:   "1.0",
				Data:          json.RawMessage(`{"field1": "value1"}`),
				CreatedAt:     "2024-01-01T00:00:00Z",
				UpdatedAt:     "2024-01-01T00:00:00Z",
			},
			{
				ObservationID: "", // Invalid - empty ID
				FormType:      "observation",
				FormVersion:   "1.0",
				Data:          json.RawMessage(`{"field2": "value2"}`),
				CreatedAt:     "2024-01-01T00:00:00Z",
				UpdatedAt:     "2024-01-01T00:00:00Z",
			},
		},
	}

	pushBody, err := json.Marshal(pushReq)
	if err != nil {
		t.Fatalf("Failed to marshal push request: %v", err)
	}

	req, err := http.NewRequest("POST", server.URL+"/sync/push", bytes.NewReader(pushBody))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Logf("Push response body: %s", string(body))
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
		return // Don't continue if push failed
	}

	var pushResp SyncPushResponse
	if err := json.NewDecoder(resp.Body).Decode(&pushResp); err != nil {
		t.Fatalf("Failed to unmarshal push response: %v", err)
	}

	// Should have warnings for invalid records
	if len(pushResp.FailedRecords) == 0 {
		t.Error("Expected failed records for invalid data")
	}
}

// TestSyncE2E_SchemaTypeFiltering tests schema type filtering in pull requests
func TestSyncE2E_SchemaTypeFiltering(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	// Setup test database and server
	db, cleanup := sync.SetupTestDatabase(t)
	defer cleanup()

	server := createTestServerWithDB(t, db)
	defer server.Close()

	// First, push a record of type "survey"
	pushReq := SyncPushRequest{
		TransmissionID: "test-transmission",
		ClientID:       "test-client",
		Records: []sync.Observation{
			{
				ObservationID: "survey-record",
				FormType:      "survey",
				FormVersion:   "1.0",
				Data:          json.RawMessage(`{"question": "How are you?"}`),
				CreatedAt:     "2024-01-01T00:00:00Z",
				UpdatedAt:     "2024-01-01T00:00:00Z",
			},
		},
	}

	pushBody, err := json.Marshal(pushReq)
	if err != nil {
		t.Fatalf("Failed to marshal push request: %v", err)
	}

	req, err := http.NewRequest("POST", server.URL+"/sync/push", bytes.NewReader(pushBody))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Logf("Push response body: %s", string(body))
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
		return // Don't continue if push failed
	}

	// Now pull with schema type filter
	pullReq := SyncPullRequest{
		ClientID:    "test-client",
		SchemaTypes: []string{"survey"},
	}
	var pullBody []byte
	pullBody, err = json.Marshal(pullReq)
	if err != nil {
		t.Fatalf("Failed to marshal pull request: %v", err)
	}

	req, err = http.NewRequest("POST", server.URL+"/sync/pull", bytes.NewReader(pullBody))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")

	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("Failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Logf("Pull response body: %s", string(body))
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
		return // Don't continue if pull failed
	}

	var pullResp SyncPullResponse
	if err := json.NewDecoder(resp.Body).Decode(&pullResp); err != nil {
		t.Fatalf("Failed to unmarshal pull response: %v", err)
	}

	// Check if we have the expected record (but don't panic if we don't)
	if len(pullResp.Records) == 0 {
		t.Error("Expected at least 1 record after pushing a survey record")
		return
	}

	if len(pullResp.Records) != 1 {
		t.Errorf("Expected 1 record, got %d", len(pullResp.Records))
		return
	}

	if pullResp.Records[0].FormType != "survey" {
		t.Errorf("Expected survey record, got %s", pullResp.Records[0].FormType)
	}
}

// createTestServerWithDB creates a test HTTP server with proper middleware and routing
func createTestServerWithDB(t *testing.T, db *sql.DB) *httptest.Server {
	log := logger.NewLogger()
	mockConfig := mocks.NewTestConfig()
	// Create sync service with real database
	syncService := sync.NewService(db, sync.DefaultConfig(), log)
	if err := syncService.Initialize(context.Background()); err != nil {
		t.Fatalf("Failed to initialize sync service: %v", err)
	}

	// Create handler with real sync service and mock other services
	mockAttachmentManifestService := &mocks.MockAttachmentManifestService{}
	mockDataExportService := mocks.NewMockDataExportService()
	handler := NewHandler(
		log,
		mockConfig,
		&mockAuthService{},
		&mockAppBundleService{},
		syncService,
		&mockUserService{},
		&mockVersionService{},
		mockAttachmentManifestService,
		mockDataExportService,
	)

	// Create router with authentication middleware
	mux := http.NewServeMux()

	// Wrap sync endpoints with auth middleware
	authMiddleware := authmw.AuthMiddleware(&mockAuthService{}, log)
	mux.Handle("/sync/pull", authMiddleware(http.HandlerFunc(handler.Pull)))
	mux.Handle("/sync/push", authMiddleware(http.HandlerFunc(handler.Push)))

	return httptest.NewServer(mux)
}

// Simple mock implementations
type mockAuthService struct{}

func (m *mockAuthService) Config() auth.Config { return auth.Config{} }
func (m *mockAuthService) Authenticate(ctx context.Context, username, password string) (*models.User, error) {
	return &models.User{ID: uuid.New(), Username: username, Role: models.RoleReadWrite}, nil
}
func (m *mockAuthService) GenerateToken(user *models.User) (string, error) { return "token", nil }
func (m *mockAuthService) GenerateRefreshToken(user *models.User) (string, error) {
	return "refresh", nil
}
func (m *mockAuthService) RefreshToken(ctx context.Context, refreshToken string) (string, string, error) {
	return "new-token", "new-refresh", nil
}
func (m *mockAuthService) ValidateToken(tokenString string) (*auth.AuthClaims, error) {
	return &auth.AuthClaims{Username: "test", Role: models.RoleReadWrite}, nil
}
func (m *mockAuthService) Initialize(ctx context.Context) error         { return nil }
func (m *mockAuthService) HashPassword(password string) (string, error) { return "hash", nil }
func (m *mockAuthService) CheckPasswordHash(password, hash string) bool { return true }
func (m *mockAuthService) VerifyPassword(password, hash string) bool    { return true }

type mockAppBundleService struct{}

func (m *mockAppBundleService) GetManifest(ctx context.Context) (*appbundle.Manifest, error) {
	return &appbundle.Manifest{Version: "1.0.0"}, nil
}
func (m *mockAppBundleService) GetFile(ctx context.Context, path string) (io.ReadCloser, *appbundle.File, error) {
	return nil, nil, nil
}
func (m *mockAppBundleService) GetLatestVersionFile(ctx context.Context, path string) (io.ReadCloser, *appbundle.File, error) {
	return nil, nil, nil
}
func (m *mockAppBundleService) GetFileHash(ctx context.Context, path string, useLatest bool) (string, error) {
	return "hash", nil
}
func (m *mockAppBundleService) RefreshManifest() error { return nil }
func (m *mockAppBundleService) PushBundle(ctx context.Context, zipReader io.Reader) (*appbundle.Manifest, error) {
	return &appbundle.Manifest{Version: "1.0.0"}, nil
}
func (m *mockAppBundleService) GetVersions(ctx context.Context) ([]string, error) {
	return []string{"1.0.0"}, nil
}
func (m *mockAppBundleService) SwitchVersion(ctx context.Context, version string) error { return nil }
func (m *mockAppBundleService) GetAppInfo(ctx context.Context, version string) (*appbundle.AppInfo, error) {
	return &appbundle.AppInfo{}, nil
}
func (m *mockAppBundleService) GetLatestAppInfo(ctx context.Context) (*appbundle.AppInfo, error) {
	return &appbundle.AppInfo{}, nil
}
func (m *mockAppBundleService) CompareAppInfos(ctx context.Context, versionA, versionB string) (*appbundle.ChangeLog, error) {
	return &appbundle.ChangeLog{}, nil
}

type mockUserService struct{}

func (m *mockUserService) CreateUser(ctx context.Context, username, password string, role models.Role) (*models.User, error) {
	return &models.User{ID: uuid.New(), Username: username, Role: role}, nil
}
func (m *mockUserService) DeleteUser(ctx context.Context, username string) error { return nil }
func (m *mockUserService) ResetPassword(ctx context.Context, username, newPassword string) error {
	return nil
}
func (m *mockUserService) ChangePassword(ctx context.Context, username, currentPassword, newPassword string) error {
	return nil
}
func (m *mockUserService) ListUsers(ctx context.Context) ([]models.User, error) {
	return []models.User{}, nil
}

type mockVersionService struct{}

func (m *mockVersionService) GetVersion(ctx context.Context) (*version.SystemVersionInfo, error) {
	return &version.SystemVersionInfo{}, nil
}
