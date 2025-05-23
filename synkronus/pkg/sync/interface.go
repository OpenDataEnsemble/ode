package sync

import (
	"context"
	"errors"
	"time"
)

// Common errors
var (
	// ErrInvalidData is returned when the data is invalid
	ErrInvalidData = errors.New("invalid data")
	// ErrDeviceNotFound is returned when the device is not found
	ErrDeviceNotFound = errors.New("device not found")
	// ErrSyncFailed is returned when the sync operation fails
	ErrSyncFailed = errors.New("sync operation failed")
)

// SyncItem represents an item to be synchronized
type SyncItem any

// ServiceInterface defines the interface for sync operations
type ServiceInterface interface {
	// GetDataSince retrieves data changes since the specified timestamp for a device
	GetDataSince(ctx context.Context, lastSyncTimestamp int64, deviceID string) ([]SyncItem, string, error)

	// ProcessPushedData processes data pushed from a device
	ProcessPushedData(ctx context.Context, data []SyncItem, deviceID string, timestamp int64) error

	// CheckETag checks if the data has changed since the ETag was generated
	CheckETag(ctx context.Context, etag string, deviceID string) (bool, error)

	// Initialize initializes the sync service
	Initialize(ctx context.Context) error
}

// Config contains sync service configuration
type Config struct {
	// DataStorePath is the path to the data store
	DataStorePath string

	// MaxItemsPerSync is the maximum number of items to return in a single sync
	MaxItemsPerSync int

	// RetentionPeriod is how long to keep sync history
	RetentionPeriod time.Duration
}
