package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/opendataensemble/synkronus/pkg/sync"
	_ "github.com/lib/pq"
)

// TestSyncE2E_VersionIncrement tests end-to-end version increment behavior
func TestSyncE2E_VersionIncrement(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	// Setup test database and handler
	db, cleanup := setupTestDB(t)
	defer cleanup()

	handler := createTestHandlerWithDB(t, db)

	// Test 1: Initial pull should return version 1 with no records
	pullReq := SyncPullRequest{
		ClientID: "test-client",
		Since: &SyncPullRequestSince{
			Version: 0,
		},
	}
	pullBody, _ := json.Marshal(pullReq)

	req := httptest.NewRequest("POST", "/sync/pull", bytes.NewBuffer(pullBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Pull(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	var pullResp SyncPullResponse
	if err := json.NewDecoder(w.Body).Decode(&pullResp); err != nil {
		t.Fatalf("Failed to decode pull response: %v", err)
	}

	initialVersion := pullResp.CurrentVersion
	if initialVersion <= 0 {
		t.Errorf("Expected positive initial version, got %d", initialVersion)
	}

	// Test 2: Push a record and verify version increments
	pushReq := SyncPushRequest{
		TransmissionID: "test-transmission-1",
		ClientID:       "test-client",
		Records: []sync.Observation{
			{
				ObservationID: "obs-1",
				FormType:      "survey",
				FormVersion:   "1.0",
				Data:          `{"field1": "value1"}`,
				CreatedAt:     time.Now().Format(time.RFC3339),
				UpdatedAt:     time.Now().Format(time.RFC3339),
				Deleted:       false,
			},
		},
	}
	pushBody, _ := json.Marshal(pushReq)

	req = httptest.NewRequest("POST", "/sync/push", bytes.NewBuffer(pushBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	handler.Push(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	var pushResp SyncPushResponse
	if err := json.NewDecoder(w.Body).Decode(&pushResp); err != nil {
		t.Fatalf("Failed to decode push response: %v", err)
	}

	if pushResp.CurrentVersion <= initialVersion {
		t.Errorf("Expected version to increment from %d, got %d", initialVersion, pushResp.CurrentVersion)
	}

	newVersion := pushResp.CurrentVersion

	// Test 3: Pull again and verify we get the new record
	pullReq.Since = &SyncPullRequestSince{
		Version: initialVersion,
	}
	pullBody, _ = json.Marshal(pullReq)

	req = httptest.NewRequest("POST", "/sync/pull", bytes.NewBuffer(pullBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	handler.Pull(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	if err := json.NewDecoder(w.Body).Decode(&pullResp); err != nil {
		t.Fatalf("Failed to decode second pull response: %v", err)
	}

	if pullResp.CurrentVersion != newVersion {
		t.Errorf("Expected current version %d, got %d", newVersion, pullResp.CurrentVersion)
	}

	if len(pullResp.Records) != 1 {
		t.Errorf("Expected 1 record, got %d", len(pullResp.Records))
	}

	if pullResp.Records[0].ObservationID != "obs-1" {
		t.Errorf("Expected observation ID 'obs-1', got '%s'", pullResp.Records[0].ObservationID)
	}
}

// TestSyncE2E_PartialFailure tests that partial failures are handled correctly
func TestSyncE2E_PartialFailure(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	db, cleanup := setupTestDB(t)
	defer cleanup()

	handler := createTestHandlerWithDB(t, db)

	// Get initial version
	pullReq := SyncPullRequest{
		ClientID: "test-client",
		Since: &SyncPullRequestSince{
			Version: 0,
		},
	}
	pullBody, _ := json.Marshal(pullReq)

	req := httptest.NewRequest("POST", "/sync/pull", bytes.NewBuffer(pullBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Pull(w, req)

	var pullResp SyncPullResponse
	json.NewDecoder(w.Body).Decode(&pullResp)
	initialVersion := pullResp.CurrentVersion

	// Push mixed valid/invalid records
	pushReq := SyncPushRequest{
		TransmissionID: "test-transmission-2",
		ClientID:       "test-client",
		Records: []sync.Observation{
			{
				ObservationID: "valid-obs",
				FormType:      "survey",
				FormVersion:   "1.0",
				Data:          `{"field1": "value1"}`,
				CreatedAt:     time.Now().Format(time.RFC3339),
				UpdatedAt:     time.Now().Format(time.RFC3339),
				Deleted:       false,
			},
			{
				ObservationID: "", // Invalid - empty ID
				FormType:      "survey",
				FormVersion:   "1.0",
				Data:          `{"field1": "value1"}`,
				CreatedAt:     time.Now().Format(time.RFC3339),
				UpdatedAt:     time.Now().Format(time.RFC3339),
				Deleted:       false,
			},
		},
	}
	pushBody, _ := json.Marshal(pushReq)

	req = httptest.NewRequest("POST", "/sync/push", bytes.NewBuffer(pushBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	handler.Push(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	var pushResp SyncPushResponse
	if err := json.NewDecoder(w.Body).Decode(&pushResp); err != nil {
		t.Fatalf("Failed to decode push response: %v", err)
	}

	// Should have 1 success, 1 failure
	if pushResp.SuccessCount != 1 {
		t.Errorf("Expected 1 success, got %d", pushResp.SuccessCount)
	}
	if len(pushResp.FailedRecords) != 1 {
		t.Errorf("Expected 1 failed record, got %d", len(pushResp.FailedRecords))
	}

	// Version should still increment for successful records
	if pushResp.CurrentVersion <= initialVersion {
		t.Errorf("Expected version to increment from %d, got %d", initialVersion, pushResp.CurrentVersion)
	}
}

// TestSyncE2E_SchemaTypeFiltering tests schema type filtering in pull requests
func TestSyncE2E_SchemaTypeFiltering(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	db, cleanup := setupTestDB(t)
	defer cleanup()

	handler := createTestHandlerWithDB(t, db)

	// Push records with different schema types
	pushReq := SyncPushRequest{
		TransmissionID: "test-transmission-3",
		ClientID:       "test-client",
		Records: []sync.Observation{
			{
				ObservationID: "survey-obs",
				FormType:      "survey",
				FormVersion:   "1.0",
				Data:          `{"type": "survey"}`,
				CreatedAt:     time.Now().Format(time.RFC3339),
				UpdatedAt:     time.Now().Format(time.RFC3339),
				Deleted:       false,
			},
			{
				ObservationID: "checklist-obs",
				FormType:      "checklist",
				FormVersion:   "1.0",
				Data:          `{"type": "checklist"}`,
				CreatedAt:     time.Now().Format(time.RFC3339),
				UpdatedAt:     time.Now().Format(time.RFC3339),
				Deleted:       false,
			},
		},
	}
	pushBody, _ := json.Marshal(pushReq)

	req := httptest.NewRequest("POST", "/sync/push", bytes.NewBuffer(pushBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.Push(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	// Pull with schema type filter for "survey" only
	pullReq := SyncPullRequest{
		ClientID: "test-client",
		Since: &SyncPullRequestSince{
			Version: 0,
		},
		SchemaTypes: []string{"survey"},
	}
	pullBody, _ = json.Marshal(pullReq)

	req = httptest.NewRequest("POST", "/sync/pull", bytes.NewBuffer(pullBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	handler.Pull(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	var pullResp SyncPullResponse
	if err := json.NewDecoder(w.Body).Decode(&pullResp); err != nil {
		t.Fatalf("Failed to decode pull response: %v", err)
	}

	// Should only get the survey record
	if len(pullResp.Records) != 1 {
		t.Errorf("Expected 1 filtered record, got %d", len(pullResp.Records))
	}

	if pullResp.Records[0].FormType != "survey" {
		t.Errorf("Expected survey record, got %s", pullResp.Records[0].FormType)
	}
}

// createTestHandlerWithDB creates a handler with a real database connection for E2E tests
func createTestHandlerWithDB(t *testing.T, db *sql.DB) *Handler {
	log := logger.NewLogger()

	// Create sync service with real database
	syncService := sync.NewService(db, sync.DefaultConfig(), log)
	if err := syncService.Initialize(context.Background()); err != nil {
		t.Fatalf("Failed to initialize sync service: %v", err)
	}

	// Create handler with real sync service and mock other services
	return NewHandler(
		log,
		createMockAuthService(),
		createMockAppBundleService(),
		syncService,
		createMockUserService(),
		createMockVersionService(),
	)
}

// Helper functions to create individual mock services
func createMockAuthService() interface{} {
	// Return mock auth service - type will be inferred
	return nil
}

func createMockAppBundleService() interface{} {
	// Return mock app bundle service - type will be inferred
	return nil
}

func createMockUserService() interface{} {
	// Return mock user service - type will be inferred
	return nil
}

func createMockVersionService() interface{} {
	// Return mock version service - type will be inferred
	return nil
}

// setupTestDB creates a test database connection
// This is a placeholder - in real tests you'd connect to a test database
func setupTestDB(t *testing.T) (*sql.DB, func()) {
	// This would connect to a real test database in a production environment
	t.Skip("Test database not configured - implement setupTestDB for your environment")
	return nil, func() {}
}
