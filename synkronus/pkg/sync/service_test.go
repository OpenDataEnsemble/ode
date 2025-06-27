package sync

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	_ "github.com/lib/pq"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

// TestService_VersionIncrement tests that database operations correctly increment current_version
func TestService_VersionIncrement(t *testing.T) {
	// Skip if no test database available
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db, cleanup := setupTestDB(t)
	defer cleanup()

	service := NewService(db, DefaultConfig(), logger.NewLogger())
	ctx := context.Background()

	// Initialize service
	if err := service.Initialize(ctx); err != nil {
		t.Fatalf("Failed to initialize service: %v", err)
	}

	// Get initial version
	initialVersion, err := service.GetCurrentVersion(ctx)
	if err != nil {
		t.Fatalf("Failed to get initial version: %v", err)
	}

	// Create test observation
	testRecord := Observation{
		ObservationID: "test-obs-1",
		FormType:      "survey",
		FormVersion:   "1.0",
		Data:          json.RawMessage(`{"field1": "value1"}`),
		CreatedAt:     time.Now().Format(time.RFC3339),
		UpdatedAt:     time.Now().Format(time.RFC3339),
		Deleted:       false,
	}

	// Process the record
	result, err := service.ProcessPushedRecords(ctx, []Observation{testRecord}, "test-client", "test-transmission")
	if err != nil {
		t.Fatalf("Failed to process records: %v", err)
	}

	// Verify version incremented
	if result.CurrentVersion <= initialVersion {
		t.Errorf("Expected version to increment from %d, got %d", initialVersion, result.CurrentVersion)
	}

	// Verify we can retrieve the record
	syncResult, err := service.GetRecordsSinceVersion(ctx, initialVersion, "test-client", nil, 10, nil)
	if err != nil {
		t.Fatalf("Failed to get records since version: %v", err)
	}

	if len(syncResult.Records) != 1 {
		t.Errorf("Expected 1 record, got %d", len(syncResult.Records))
	}

	if syncResult.Records[0].ObservationID != testRecord.ObservationID {
		t.Errorf("Expected observation ID %s, got %s", testRecord.ObservationID, syncResult.Records[0].ObservationID)
	}
}

// TestService_TransactionRollback tests that failed operations don't increment version
func TestService_TransactionRollback(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db, cleanup := setupTestDB(t)
	defer cleanup()

	service := NewService(db, DefaultConfig(), logger.NewLogger())
	ctx := context.Background()

	if err := service.Initialize(ctx); err != nil {
		t.Fatalf("Failed to initialize service: %v", err)
	}

	initialVersion, err := service.GetCurrentVersion(ctx)
	if err != nil {
		t.Fatalf("Failed to get initial version: %v", err)
	}

	// Test with invalid data that should cause partial failure
	records := []Observation{
		{
			ObservationID: "valid-obs",
			FormType:      "survey",
			FormVersion:   "1.0",
			Data:          json.RawMessage(`{"field1": "value1"}`),
			CreatedAt:     time.Now().Format(time.RFC3339),
			UpdatedAt:     time.Now().Format(time.RFC3339),
			Deleted:       false,
		},
		{
			ObservationID: "", // Invalid - empty ID
			FormType:      "survey",
			FormVersion:   "1.0",
			Data:          json.RawMessage(`{"field1": "value1"}`),
			CreatedAt:     time.Now().Format(time.RFC3339),
			UpdatedAt:     time.Now().Format(time.RFC3339),
			Deleted:       false,
		},
	}

	result, err := service.ProcessPushedRecords(ctx, records, "test-client", "test-transmission")
	if err != nil {
		t.Fatalf("Failed to process records: %v", err)
	}

	// Should have 1 success, 1 failure
	if result.SuccessCount != 1 {
		t.Errorf("Expected 1 success, got %d", result.SuccessCount)
	}
	if len(result.FailedRecords) != 1 {
		t.Errorf("Expected 1 failed record, got %d", len(result.FailedRecords))
	}

	// Version should still increment for successful records
	if result.CurrentVersion <= initialVersion {
		t.Errorf("Expected version to increment from %d, got %d", initialVersion, result.CurrentVersion)
	}
}

// TestService_ConcurrentAccess tests concurrent operations don't cause race conditions
func TestService_ConcurrentAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	db, cleanup := setupTestDB(t)
	defer cleanup()

	service := NewService(db, DefaultConfig(), logger.NewLogger())
	ctx := context.Background()

	if err := service.Initialize(ctx); err != nil {
		t.Fatalf("Failed to initialize service: %v", err)
	}

	initialVersion, err := service.GetCurrentVersion(ctx)
	if err != nil {
		t.Fatalf("Failed to get initial version: %v", err)
	}

	// Run multiple concurrent operations
	const numGoroutines = 5
	const recordsPerGoroutine = 2

	results := make(chan *SyncPushResult, numGoroutines)
	errors := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			records := make([]Observation, recordsPerGoroutine)
			for j := 0; j < recordsPerGoroutine; j++ {
				records[j] = Observation{
					ObservationID: fmt.Sprintf("concurrent-obs-%d-%d", id, j),
					FormType:      "survey",
					FormVersion:   "1.0",
					Data:          json.RawMessage(fmt.Sprintf(`{"goroutine": %d, "record": %d}`, id, j)),
					CreatedAt:     time.Now().Format(time.RFC3339),
					UpdatedAt:     time.Now().Format(time.RFC3339),
					Deleted:       false,
				}
			}

			result, err := service.ProcessPushedRecords(ctx, records, fmt.Sprintf("client-%d", id), fmt.Sprintf("transmission-%d", id))
			if err != nil {
				errors <- err
				return
			}
			results <- result
		}(i)
	}

	// Collect results
	var allResults []*SyncPushResult
	for i := 0; i < numGoroutines; i++ {
		select {
		case result := <-results:
			allResults = append(allResults, result)
		case err := <-errors:
			t.Fatalf("Concurrent operation failed: %v", err)
		case <-time.After(10 * time.Second):
			t.Fatal("Timeout waiting for concurrent operations")
		}
	}

	// Verify all operations succeeded
	totalSuccessful := 0
	for _, result := range allResults {
		totalSuccessful += result.SuccessCount
		if result.CurrentVersion <= initialVersion {
			t.Errorf("Expected version to increment from %d, got %d", initialVersion, result.CurrentVersion)
		}
	}

	expectedTotal := numGoroutines * recordsPerGoroutine
	if totalSuccessful != expectedTotal {
		t.Errorf("Expected %d total successful records, got %d", expectedTotal, totalSuccessful)
	}
}

// setupTestDB creates a test database connection
// In a real environment, this would connect to a test database
func setupTestDB(t *testing.T) (*sql.DB, func()) {
	// This is a placeholder - in real tests you'd connect to a test database
	// For now, we'll skip these tests unless a test database is configured
	t.Skip("Test database not configured - implement setupTestDB for your environment")
	return nil, func() {}
}
