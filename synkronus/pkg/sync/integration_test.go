package sync

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/opendataensemble/synkronus/pkg/logger"
)

// TestDatabaseIntegration_VersionIncrement tests that database operations correctly increment current_version
func TestDatabaseIntegration_VersionIncrement(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database integration test in short mode")
	}

	db, cleanup := SetupTestDatabase(t)
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

	t.Logf("Initial version: %d", initialVersion)

	// Create test observation
	testRecord := Observation{
		ObservationID: "test-obs-version-1",
		FormType:      "survey",
		FormVersion:   "1.0",
		Data:          `{"field1": "value1"}`,
		CreatedAt:     time.Now().Format(time.RFC3339),
		UpdatedAt:     time.Now().Format(time.RFC3339),
		Deleted:       false,
	}

	// Process the record
	result, err := service.ProcessPushedRecords(ctx, []Observation{testRecord}, "test-client", "test-transmission-1")
	if err != nil {
		t.Fatalf("Failed to process records: %v", err)
	}

	// Verify version incremented
	if result.CurrentVersion <= initialVersion {
		t.Errorf("Expected version to increment from %d, got %d", initialVersion, result.CurrentVersion)
	}

	t.Logf("Version after first insert: %d", result.CurrentVersion)

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

	// Test update operation also increments version
	updateRecord := testRecord
	updateRecord.Data = `{"field1": "updated_value"}`
	updateRecord.UpdatedAt = time.Now().Format(time.RFC3339)

	updateResult, err := service.ProcessPushedRecords(ctx, []Observation{updateRecord}, "test-client", "test-transmission-2")
	if err != nil {
		t.Fatalf("Failed to process update: %v", err)
	}

	if updateResult.CurrentVersion <= result.CurrentVersion {
		t.Errorf("Expected version to increment from %d on update, got %d", result.CurrentVersion, updateResult.CurrentVersion)
	}

	t.Logf("Version after update: %d", updateResult.CurrentVersion)
}

// TestDatabaseIntegration_TransactionRollback tests that failed operations don't increment version
func TestDatabaseIntegration_TransactionRollback(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database integration test in short mode")
	}

	db, cleanup := SetupTestDatabase(t)
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

	t.Logf("Initial version: %d", initialVersion)

	// Test with mixed valid/invalid data
	records := []Observation{
		{
			ObservationID: "valid-obs-rollback",
			FormType:      "survey",
			FormVersion:   "1.0",
			Data:          `{"field1": "value1"}`,
			CreatedAt:     time.Now().Format(time.RFC3339),
			UpdatedAt:     time.Now().Format(time.RFC3339),
			Deleted:       false,
		},
		{
			ObservationID: "", // Invalid - empty ID should cause validation error
			FormType:      "survey",
			FormVersion:   "1.0",
			Data:          `{"field1": "value1"}`,
			CreatedAt:     time.Now().Format(time.RFC3339),
			UpdatedAt:     time.Now().Format(time.RFC3339),
			Deleted:       false,
		},
	}

	result, err := service.ProcessPushedRecords(ctx, records, "test-client", "test-transmission-rollback")
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

	t.Logf("Version after partial success: %d", result.CurrentVersion)

	// Verify only the valid record was inserted
	syncResult, err := service.GetRecordsSinceVersion(ctx, initialVersion, "test-client", nil, 10, nil)
	if err != nil {
		t.Fatalf("Failed to get records since version: %v", err)
	}

	if len(syncResult.Records) != 1 {
		t.Errorf("Expected 1 record in database, got %d", len(syncResult.Records))
	}

	if syncResult.Records[0].ObservationID != "valid-obs-rollback" {
		t.Errorf("Expected valid observation, got %s", syncResult.Records[0].ObservationID)
	}
}

// TestDatabaseIntegration_ConcurrentAccess tests concurrent operations don't cause race conditions
func TestDatabaseIntegration_ConcurrentAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database integration test in short mode")
	}

	db, cleanup := SetupTestDatabase(t)
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

	t.Logf("Initial version: %d", initialVersion)

	// Run multiple concurrent operations
	const numGoroutines = 10
	const recordsPerGoroutine = 3

	var wg sync.WaitGroup
	results := make(chan *SyncPushResult, numGoroutines)
	errors := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			records := make([]Observation, recordsPerGoroutine)
			for j := 0; j < recordsPerGoroutine; j++ {
				records[j] = Observation{
					ObservationID: fmt.Sprintf("concurrent-obs-%d-%d", id, j),
					FormType:      "survey",
					FormVersion:   "1.0",
					Data:          fmt.Sprintf(`{"goroutine": %d, "record": %d}`, id, j),
					CreatedAt:     time.Now().Format(time.RFC3339),
					UpdatedAt:     time.Now().Format(time.RFC3339),
					Deleted:       false,
				}
			}

			result, err := service.ProcessPushedRecords(ctx, records, fmt.Sprintf("client-%d", id), fmt.Sprintf("transmission-%d", id))
			if err != nil {
				errors <- fmt.Errorf("goroutine %d failed: %w", id, err)
				return
			}
			results <- result
		}(i)
	}

	// Wait for all goroutines to complete
	go func() {
		wg.Wait()
		close(results)
		close(errors)
	}()

	// Collect results
	var allResults []*SyncPushResult

	// Process results and errors until all goroutines complete
	for i := 0; i < numGoroutines; i++ {
		select {
		case result, ok := <-results:
			if !ok {
				continue
			}
			allResults = append(allResults, result)
		case err, ok := <-errors:
			if !ok {
				continue
			}
			if err != nil {
				t.Errorf("Concurrent operation failed: %v", err)
				t.FailNow()
			}
		case <-time.After(30 * time.Second):
			t.Fatal("Timeout waiting for concurrent operations")
		}
	}

	// Verify all operations succeeded
	if len(allResults) != numGoroutines {
		t.Fatalf("Expected %d results, got %d", numGoroutines, len(allResults))
	}



	totalSuccessful := 0
	maxVersion := initialVersion
	for i, result := range allResults {
		totalSuccessful += result.SuccessCount
		if result.CurrentVersion <= initialVersion {
			t.Errorf("Result %d: Expected version to increment from %d, got %d", i, initialVersion, result.CurrentVersion)
		}
		if result.CurrentVersion > maxVersion {
			maxVersion = result.CurrentVersion
		}
		t.Logf("Goroutine %d: Success count: %d, Version: %d", i, result.SuccessCount, result.CurrentVersion)
	}

	expectedTotal := numGoroutines * recordsPerGoroutine
	if totalSuccessful != expectedTotal {
		t.Errorf("Expected %d total successful records, got %d", expectedTotal, totalSuccessful)
	}

	t.Logf("Final version: %d (increment of %d)", maxVersion, maxVersion-initialVersion)

	// Verify all records are retrievable
	finalResult, err := service.GetRecordsSinceVersion(ctx, initialVersion, "test-client", nil, 1000, nil)
	if err != nil {
		t.Fatalf("Failed to get final records: %v", err)
	}

	if len(finalResult.Records) != expectedTotal {
		t.Errorf("Expected %d total records in database, got %d", expectedTotal, len(finalResult.Records))
	}
}

// TestDatabaseIntegration_VersionConsistency tests that version increments are consistent across operations
func TestDatabaseIntegration_VersionConsistency(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database integration test in short mode")
	}

	db, cleanup := SetupTestDatabase(t)
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

	var lastVersion int64 = initialVersion
	const numOperations = 5

	for i := 0; i < numOperations; i++ {
		record := Observation{
			ObservationID: fmt.Sprintf("consistency-obs-%d", i),
			FormType:      "survey",
			FormVersion:   "1.0",
			Data:          fmt.Sprintf(`{"operation": %d}`, i),
			CreatedAt:     time.Now().Format(time.RFC3339),
			UpdatedAt:     time.Now().Format(time.RFC3339),
			Deleted:       false,
		}

		result, err := service.ProcessPushedRecords(ctx, []Observation{record}, "test-client", fmt.Sprintf("transmission-%d", i))
		if err != nil {
			t.Fatalf("Operation %d failed: %v", i, err)
		}

		// Version should always increment
		if result.CurrentVersion <= lastVersion {
			t.Errorf("Operation %d: Expected version > %d, got %d", i, lastVersion, result.CurrentVersion)
		}

		// Verify we can get the current version independently
		currentVersion, err := service.GetCurrentVersion(ctx)
		if err != nil {
			t.Fatalf("Failed to get current version after operation %d: %v", i, err)
		}

		if currentVersion != result.CurrentVersion {
			t.Errorf("Operation %d: Version mismatch - push result: %d, get current: %d", i, result.CurrentVersion, currentVersion)
		}

		lastVersion = result.CurrentVersion
		t.Logf("Operation %d: Version %d", i, lastVersion)
	}

	// Final verification: total version increment should equal number of operations
	finalIncrement := lastVersion - initialVersion
	if finalIncrement != numOperations {
		t.Errorf("Expected total version increment of %d, got %d", numOperations, finalIncrement)
	}
}

// setupIntegrationDB creates a test database connection for integration tests
func setupIntegrationDB(t *testing.T) (*sql.DB, func()) {
	return SetupTestDatabase(t)
}
