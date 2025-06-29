package mocks

import (
	"context"
	"fmt"

	"github.com/opendataensemble/synkronus/pkg/sync"
)

// MockSyncService is a mock implementation of the sync.ServiceInterface for testing
type MockSyncService struct {
	currentVersion int64
	observations   []sync.Observation
	initialized    bool
}

// NewMockSyncService creates a new mock sync service
func NewMockSyncService() *MockSyncService {
	return &MockSyncService{
		currentVersion: 1,
		observations:   make([]sync.Observation, 0), // Initialize as empty slice, not nil
		initialized:    false,
	}
}

// Initialize mocks the initialization process
func (m *MockSyncService) Initialize(ctx context.Context) error {
	m.initialized = true
	return nil
}

// GetCurrentVersion returns the current mock version
func (m *MockSyncService) GetCurrentVersion(ctx context.Context) (int64, error) {
	if !m.initialized {
		return 0, fmt.Errorf("sync service not initialized")
	}
	return m.currentVersion, nil
}

// GetRecordsSinceVersion mocks retrieving records that have changed since the specified version
func (m *MockSyncService) GetRecordsSinceVersion(ctx context.Context, sinceVersion int64, clientID string, schemaTypes []string, limit int, cursor *sync.SyncPullCursor) (*sync.SyncResult, error) {
	if !m.initialized {
		return nil, fmt.Errorf("sync service not initialized")
	}

	// Filter observations by version
	var filteredRecords []sync.Observation
	for _, obs := range m.observations {
		if obs.Version > sinceVersion {
			// Apply schema type filter if specified
			if len(schemaTypes) > 0 {
				found := false
				for _, schemaType := range schemaTypes {
					if obs.FormType == schemaType {
						found = true
						break
					}
				}
				if !found {
					continue
				}
			}
			filteredRecords = append(filteredRecords, obs)
		}
	}

	// Ensure filteredRecords is never nil - initialize as empty slice if no records found
	if filteredRecords == nil {
		filteredRecords = make([]sync.Observation, 0)
	}

	// Apply limit
	if limit > 0 && len(filteredRecords) > limit {
		filteredRecords = filteredRecords[:limit]
	}

	// Determine change cutoff
	var changeCutoff int64 = sinceVersion
	if len(filteredRecords) > 0 {
		changeCutoff = filteredRecords[len(filteredRecords)-1].Version
	}

	return &sync.SyncResult{
		CurrentVersion: m.currentVersion,
		Records:        filteredRecords,
		ChangeCutoff:   changeCutoff,
		HasMore:        false, // Mock always returns all data
	}, nil
}

// ProcessPushedRecords mocks processing records pushed from a client
func (m *MockSyncService) ProcessPushedRecords(ctx context.Context, records []sync.Observation, clientID string, transmissionID string) (*sync.SyncPushResult, error) {
	if !m.initialized {
		return nil, fmt.Errorf("sync service not initialized")
	}

	var successCount int
	var failedRecords []map[string]interface{}
	var warnings []sync.SyncWarning

	for i, record := range records {
		// Basic validation
		if record.ObservationID == "" {
			failedRecords = append(failedRecords, map[string]interface{}{
				"index":  i,
				"error":  "observation_id is required",
				"record": record,
			})
			continue
		}

		// Generate warnings for missing optional fields
		if record.FormType == "" {
			warnings = append(warnings, sync.SyncWarning{
				ID:      record.ObservationID,
				Code:    "MISSING_FORM_TYPE",
				Message: "form_type is empty but record was processed",
			})
		}

		// Mock successful processing - add to observations
		record.Version = m.currentVersion + 1
		m.observations = append(m.observations, record)
		m.currentVersion++
		successCount++
	}

	return &sync.SyncPushResult{
		CurrentVersion: m.currentVersion,
		SuccessCount:   successCount,
		FailedRecords:  failedRecords,
		Warnings:       warnings,
	}, nil
}
