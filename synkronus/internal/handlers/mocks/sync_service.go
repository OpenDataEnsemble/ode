package mocks

import (
	"context"
	"errors"
	"time"

	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/opendataensemble/synkronus/pkg/sync"
)

// MockSyncService is a mock implementation of the sync.ServiceInterface for testing
type MockSyncService struct {
	log         *logger.Logger
	dataStore   map[string][]sync.SyncItem
	deviceData  map[string]mockDeviceData
	initialized bool
}

type mockDeviceData struct {
	LastSyncTimestamp int64
	ETag              string
	DeviceID          string
}

// NewMockSyncService creates a new mock sync service
func NewMockSyncService() *MockSyncService {
	mock := &MockSyncService{
		log:        logger.NewLogger(),
		dataStore:  make(map[string][]sync.SyncItem),
		deviceData: make(map[string]mockDeviceData),
	}

	// Add some test data
	testDevice := "test-device-id"
	testData := []sync.SyncItem{
		map[string]any{
			"id":        "item1",
			"type":      "note",
			"content":   "Test note content",
			"createdAt": time.Now().Unix(),
			"updatedAt": time.Now().Unix(),
		},
		map[string]any{
			"id":        "item2",
			"type":      "task",
			"content":   "Test task content",
			"completed": false,
			"createdAt": time.Now().Unix(),
			"updatedAt": time.Now().Unix(),
		},
	}
	mock.dataStore[testDevice] = testData
	mock.deviceData[testDevice] = mockDeviceData{
		LastSyncTimestamp: time.Now().Unix(),
		ETag:              "test-etag-value",
		DeviceID:          testDevice,
	}

	mock.initialized = true
	return mock
}

// Initialize mocks the initialization process
func (m *MockSyncService) Initialize(ctx context.Context) error {
	m.initialized = true
	return nil
}

// GetDataSince mocks retrieving data changes since the specified timestamp for a device
func (m *MockSyncService) GetDataSince(ctx context.Context, lastSyncTimestamp int64, deviceID string) ([]sync.SyncItem, string, error) {
	if !m.initialized {
		return nil, "", errors.New("sync service not initialized")
	}

	// Validate device ID
	if deviceID == "" {
		return nil, "", sync.ErrDeviceNotFound
	}

	// Get data for the device
	items, exists := m.dataStore[deviceID]
	if !exists {
		// If no data exists for this device, return empty array
		return []sync.SyncItem{}, "empty-etag", nil
	}

	// Get device data
	deviceData, exists := m.deviceData[deviceID]
	if !exists {
		deviceData = mockDeviceData{
			LastSyncTimestamp: time.Now().Unix(),
			ETag:              "new-etag-value",
			DeviceID:          deviceID,
		}
		m.deviceData[deviceID] = deviceData
	}

	return items, deviceData.ETag, nil
}

// ProcessPushedData mocks processing data pushed from a device
func (m *MockSyncService) ProcessPushedData(ctx context.Context, data []sync.SyncItem, deviceID string, timestamp int64) error {
	if !m.initialized {
		return errors.New("sync service not initialized")
	}

	// Store the data
	m.dataStore[deviceID] = data

	// Update device data
	m.deviceData[deviceID] = mockDeviceData{
		LastSyncTimestamp: timestamp,
		ETag:              "updated-etag-value",
		DeviceID:          deviceID,
	}

	return nil
}

// CheckETag mocks checking if the data has changed since the ETag was generated
func (m *MockSyncService) CheckETag(ctx context.Context, etag string, deviceID string) (bool, error) {
	if !m.initialized {
		return false, errors.New("sync service not initialized")
	}

	// Get device data
	deviceData, exists := m.deviceData[deviceID]
	if !exists {
		return false, nil // No data for this device, so ETag doesn't match
	}

	// Check if ETag matches
	return deviceData.ETag == etag, nil
}
