package dataexport

import (
	"context"
	"encoding/json"
)

// FormTypeColumn represents a column definition for a specific form type
type FormTypeColumn struct {
	Key      string `json:"key"`
	DataType string `json:"data_type"`
	SQLType  string `json:"sql_type"`
}

// FormTypeSchema represents the schema for a specific form type
type FormTypeSchema struct {
	FormType string           `json:"form_type"`
	Columns  []FormTypeColumn `json:"columns"`
}

// ObservationRow represents a flattened observation row
type ObservationRow struct {
	ObservationID string                 `json:"observation_id"`
	FormType      string                 `json:"form_type"`
	FormVersion   string                 `json:"form_version"`
	CreatedAt     string                 `json:"created_at"`
	UpdatedAt     string                 `json:"updated_at"`
	SyncedAt      *string                `json:"synced_at"`
	Deleted       bool                   `json:"deleted"`
	Version       int64                  `json:"version"`
	Geolocation   json.RawMessage        `json:"geolocation"`
	DataFields    map[string]interface{} `json:"data_fields"`
}

// DatabaseInterface defines the database operations needed for data export
type DatabaseInterface interface {
	// GetFormTypes returns all distinct form types in the observations table
	GetFormTypes(ctx context.Context) ([]string, error)

	// GetFormTypeSchema analyzes the JSON data structure for a form type and returns column definitions
	GetFormTypeSchema(ctx context.Context, formType string) (*FormTypeSchema, error)

	// GetObservationsForFormType returns all observations for a specific form type with flattened data
	GetObservationsForFormType(ctx context.Context, formType string, schema *FormTypeSchema) ([]ObservationRow, error)
}
