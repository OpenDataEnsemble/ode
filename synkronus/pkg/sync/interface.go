package sync

import (
	"context"
	"encoding/json"
	"errors"
)

// Common errors
var (
	// ErrInvalidData is returned when the data is invalid
	ErrInvalidData = errors.New("invalid data")
	// ErrClientNotFound is returned when the client is not found
	ErrClientNotFound = errors.New("client not found")
	// ErrSyncFailed is returned when the sync operation fails
	ErrSyncFailed = errors.New("sync operation failed")
	// ErrVersionConflict is returned when there's a version conflict
	ErrVersionConflict = errors.New("version conflict")
)

// Geolocation represents geographic coordinates and accuracy information
type Geolocation struct {
	Latitude         float64  `json:"latitude"`
	Longitude        float64  `json:"longitude"`
	Accuracy         float64  `json:"accuracy"`
	Altitude         *float64 `json:"altitude,omitempty"`
	AltitudeAccuracy *float64 `json:"altitude_accuracy,omitempty"`
}

// Observation represents a synchronized observation record
type Observation struct {
	// ObservationID is the unique identifier for the observation and is used as the primary key
	ObservationID string          `json:"observation_id" db:"observation_id,primarykey"`
	FormType      string          `json:"form_type" db:"form_type"`
	FormVersion   string          `json:"form_version" db:"form_version"`
	Data          json.RawMessage `json:"data" db:"data"`
	CreatedAt     string          `json:"created_at" db:"created_at"`
	UpdatedAt     string          `json:"updated_at" db:"updated_at"`
	SyncedAt      *string         `json:"synced_at,omitempty" db:"synced_at"`
	Deleted       bool            `json:"deleted" db:"deleted"`
	Version       int64           `json:"version" db:"version"`
	Geolocation   *Geolocation    `json:"geolocation,omitempty" db:"geolocation,json"`
}

// SyncPullCursor represents pagination cursor for sync pull operations
type SyncPullCursor struct {
	Version int64  `json:"version"`
	ID      string `json:"id"`
}

// SyncResult represents the result of a sync pull operation
type SyncResult struct {
	CurrentVersion int64         `json:"current_version"`
	Records        []Observation `json:"records"`
	ChangeCutoff   int64         `json:"change_cutoff"`
	HasMore        bool          `json:"has_more"`
}

// SyncPushResult represents the result of a sync push operation
type SyncPushResult struct {
	CurrentVersion int64                    `json:"current_version"`
	SuccessCount   int                      `json:"success_count"`
	FailedRecords  []map[string]interface{} `json:"failed_records,omitempty"`
	Warnings       []SyncWarning            `json:"warnings,omitempty"`
}

// SyncWarning represents a warning during sync operations
type SyncWarning struct {
	ID      string `json:"id"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// SyncItem represents an item to be synchronized
type SyncItem any

// ServiceInterface defines the interface for version-based sync operations
type ServiceInterface interface {
	// GetRecordsSinceVersion retrieves records that have changed since the specified version
	GetRecordsSinceVersion(ctx context.Context, sinceVersion int64, clientID string, schemaTypes []string, limit int, cursor *SyncPullCursor) (*SyncResult, error)

	// ProcessPushedRecords processes records pushed from a client
	ProcessPushedRecords(ctx context.Context, records []Observation, clientID string, transmissionID string) (*SyncPushResult, error)

	// GetCurrentVersion returns the current database version
	GetCurrentVersion(ctx context.Context) (int64, error)

	// Initialize initializes the sync service
	Initialize(ctx context.Context) error
}

// Config contains sync service configuration
type Config struct {
	// MaxRecordsPerSync is the maximum number of records to return in a single sync
	MaxRecordsPerSync int

	// DefaultLimit is the default limit when none is specified
	DefaultLimit int
}
