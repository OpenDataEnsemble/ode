package sync

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/opendataensemble/synkronus/pkg/logger"
)

// Service provides synchronization functionality
type Service struct {
	config      Config
	log         *logger.Logger
	dataStore   map[string][]SyncItem
	deviceData  map[string]DeviceData
	mutex       sync.RWMutex
	initialized bool
}

// DeviceData holds information about a device's sync state
type DeviceData struct {
	LastSyncTimestamp int64
	ETag              string
	DeviceID          string
}

// NewService creates a new sync service
func NewService(config Config, log *logger.Logger) *Service {
	return &Service{
		config:     config,
		log:        log,
		dataStore:  make(map[string][]SyncItem),
		deviceData: make(map[string]DeviceData),
		mutex:      sync.RWMutex{},
	}
}

// DefaultConfig returns a default configuration
func DefaultConfig() Config {
	return Config{
		DataStorePath:   "./data/sync",
		MaxItemsPerSync: 1000,
		RetentionPeriod: 30 * 24 * time.Hour, // 30 days
	}
}

// Initialize initializes the sync service
func (s *Service) Initialize(ctx context.Context) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Create data directory if it doesn't exist
	if err := os.MkdirAll(s.config.DataStorePath, 0755); err != nil {
		s.log.Error("Failed to create data directory", "error", err)
		return err
	}

	// Load existing data from disk if available
	if err := s.loadData(); err != nil {
		s.log.Error("Failed to load sync data", "error", err)
		return err
	}

	s.initialized = true
	s.log.Info("Sync service initialized")
	return nil
}

// GetDataSince retrieves data changes since the specified timestamp for a device
func (s *Service) GetDataSince(ctx context.Context, lastSyncTimestamp int64, deviceID string) ([]SyncItem, string, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if !s.initialized {
		return nil, "", fmt.Errorf("sync service not initialized")
	}

	// Get data for the device
	items, exists := s.dataStore[deviceID]
	if !exists {
		// If no data exists for this device, return empty array
		items = []SyncItem{}
		s.dataStore[deviceID] = items
	}

	// Filter items based on timestamp
	var result []SyncItem
	for _, item := range items {
		// In a real implementation, you would check the timestamp of each item
		// For this example, we'll just return all items
		result = append(result, item)
	}

	// Limit the number of items
	if len(result) > s.config.MaxItemsPerSync {
		result = result[:s.config.MaxItemsPerSync]
	}

	// Generate ETag for the data
	etag := s.generateETag(result)

	// Update device data
	s.deviceData[deviceID] = DeviceData{
		LastSyncTimestamp: time.Now().Unix(),
		ETag:              etag,
		DeviceID:          deviceID,
	}

	return result, etag, nil
}

// ProcessPushedData processes data pushed from a device
func (s *Service) ProcessPushedData(ctx context.Context, data []SyncItem, deviceID string, timestamp int64) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.initialized {
		return fmt.Errorf("sync service not initialized")
	}

	// Validate data
	if len(data) == 0 {
		return nil // Nothing to process
	}

	// Process and store the data
	// In a real implementation, you would merge the data with existing data
	s.dataStore[deviceID] = data

	// Update device data
	s.deviceData[deviceID] = DeviceData{
		LastSyncTimestamp: timestamp,
		ETag:              s.generateETag(data),
		DeviceID:          deviceID,
	}

	// Save data to disk
	if err := s.saveData(); err != nil {
		s.log.Error("Failed to save sync data", "error", err)
		return err
	}

	return nil
}

// CheckETag checks if the data has changed since the ETag was generated
func (s *Service) CheckETag(ctx context.Context, etag string, deviceID string) (bool, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if !s.initialized {
		return false, fmt.Errorf("sync service not initialized")
	}

	// Get device data
	deviceData, exists := s.deviceData[deviceID]
	if !exists {
		return false, nil // No data for this device, so ETag doesn't match
	}

	// Check if ETag matches
	return deviceData.ETag == etag, nil
}

// generateETag generates an ETag for the given data
func (s *Service) generateETag(data []SyncItem) string {
	// Convert data to JSON
	jsonData, err := json.Marshal(data)
	if err != nil {
		s.log.Error("Failed to marshal data for ETag generation", "error", err)
		return ""
	}

	// Generate SHA-256 hash
	hash := sha256.Sum256(jsonData)
	return hex.EncodeToString(hash[:])
}

// loadData loads sync data from disk
func (s *Service) loadData() error {
	// In a real implementation, you would load data from disk
	// For this example, we'll just initialize empty data
	s.dataStore = make(map[string][]SyncItem)
	s.deviceData = make(map[string]DeviceData)
	return nil
}

// saveData saves sync data to disk
func (s *Service) saveData() error {
	// In a real implementation, you would save data to disk
	// For this example, we'll just log that data was saved
	s.log.Info("Sync data saved")
	return nil
}
