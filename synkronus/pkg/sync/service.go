package sync

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/lib/pq"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

// Service provides version-based synchronization functionality with PostgreSQL
type Service struct {
	db     *sql.DB
	config Config
	log    *logger.Logger
}

// NewService creates a new version-based sync service
func NewService(db *sql.DB, config Config, log *logger.Logger) *Service {
	return &Service{
		db:     db,
		config: config,
		log:    log,
	}
}

// DefaultConfig returns a default configuration
func DefaultConfig() Config {
	return Config{
		MaxRecordsPerSync: 1000,
		DefaultLimit:      100,
	}
}

// Initialize initializes the sync service
func (s *Service) Initialize(ctx context.Context) error {
	s.log.Info("Sync service initialized with version-based operations")
	return nil
}

// GetCurrentVersion returns the current database version
func (s *Service) GetCurrentVersion(ctx context.Context) (int64, error) {
	var version int64
	query := "SELECT current_version FROM sync_version WHERE id = 1"

	err := s.db.QueryRowContext(ctx, query).Scan(&version)
	if err != nil {
		s.log.Error("Failed to get current version", "error", err)
		return 0, fmt.Errorf("failed to get current version: %w", err)
	}

	return version, nil
}

// GetRecordsSinceVersion retrieves records that have changed since the specified version
func (s *Service) GetRecordsSinceVersion(ctx context.Context, sinceVersion int64, clientID string, schemaTypes []string, limit int, cursor *SyncPullCursor) (*SyncResult, error) {
	// Get current version first
	currentVersion, err := s.GetCurrentVersion(ctx)
	if err != nil {
		return nil, err
	}

	// Set default limit if not specified
	if limit <= 0 {
		limit = s.config.DefaultLimit
	}

	// Enforce maximum limit
	if limit > s.config.MaxRecordsPerSync {
		limit = s.config.MaxRecordsPerSync
	}

	// Build query with optional filters
	var queryBuilder strings.Builder
	var args []interface{}
	argIndex := 1

	queryBuilder.WriteString(`
		SELECT observation_id, form_type, form_version, data, 
		       created_at, updated_at, synced_at, deleted, version
		FROM observations 
		WHERE version > $`)
	queryBuilder.WriteString(strconv.Itoa(argIndex))
	args = append(args, sinceVersion)
	argIndex++

	// Add schema type filter if specified
	if len(schemaTypes) > 0 {
		queryBuilder.WriteString(" AND form_type = ANY($")
		queryBuilder.WriteString(strconv.Itoa(argIndex))
		queryBuilder.WriteString(")")
		args = append(args, pq.Array(schemaTypes))
		argIndex++
	}

	// Add cursor pagination if provided
	if cursor != nil {
		queryBuilder.WriteString(" AND (version > $")
		queryBuilder.WriteString(strconv.Itoa(argIndex))
		queryBuilder.WriteString("::BIGINT OR (version = $")
		queryBuilder.WriteString(strconv.Itoa(argIndex + 1))
		queryBuilder.WriteString("::BIGINT AND observation_id > $")
		queryBuilder.WriteString(strconv.Itoa(argIndex + 2))
		queryBuilder.WriteString("::VARCHAR))")
		args = append(args, cursor.Version, cursor.Version, cursor.ID)
		argIndex += 3
	}

	// Order by version and observation_id for consistent pagination
	queryBuilder.WriteString(" ORDER BY version ASC, observation_id ASC")

	// Add limit + 1 to check if there are more records
	// Calculate the correct parameter index based on whether we have schema types or not
	limitParamIndex := 1 // for sinceVersion
	if len(schemaTypes) > 0 {
		limitParamIndex = 2 // for sinceVersion and schemaTypes
	}
	if cursor != nil {
		limitParamIndex += 3 // for cursor.Version, cursor.Version, cursor.ID
	}
	limitParamIndex++ // for the limit parameter itself

	queryBuilder.WriteString(" LIMIT $")
	queryBuilder.WriteString(strconv.Itoa(limitParamIndex))
	args = append(args, limit+1)

	// Execute query
	sqlStmt := queryBuilder.String()
	s.log.Debug("SQL query", "sql", sqlStmt, "args", args)
	rows, err := s.db.QueryContext(ctx, sqlStmt, args...)
	if err != nil {
		s.log.Error("Failed to query observations", "error", err)
		return nil, fmt.Errorf("failed to query observations: %w", err)
	}
	defer rows.Close()

	var records []Observation
	for rows.Next() {
		var obs Observation
		var syncedAt sql.NullString

		err := rows.Scan(
			&obs.ObservationID, &obs.FormType, &obs.FormVersion,
			&obs.Data, &obs.CreatedAt, &obs.UpdatedAt, &syncedAt,
			&obs.Deleted, &obs.Version,
		)
		if err != nil {
			s.log.Error("Failed to scan observation row", "error", err)
			return nil, fmt.Errorf("failed to scan observation: %w", err)
		}

		if syncedAt.Valid {
			obs.SyncedAt = &syncedAt.String
		}

		records = append(records, obs)
	}

	if err := rows.Err(); err != nil {
		s.log.Error("Error iterating observation rows", "error", err)
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	// Check if there are more records
	hasMore := len(records) > limit
	if hasMore {
		records = records[:limit] // Remove the extra record
	}

	// Determine change cutoff (version of the last record returned)
	var changeCutoff int64 = sinceVersion
	if len(records) > 0 {
		changeCutoff = records[len(records)-1].Version
	}

	result := &SyncResult{
		CurrentVersion: currentVersion,
		Records:        records,
		ChangeCutoff:   changeCutoff,
		HasMore:        hasMore,
	}

	s.log.Info("Retrieved records since version",
		"sinceVersion", sinceVersion,
		"currentVersion", currentVersion,
		"recordCount", len(records),
		"hasMore", hasMore,
		"changeCutoff", changeCutoff,
		"clientId", clientID)

	return result, nil
}

// ProcessPushedRecords processes records pushed from a client
func (s *Service) ProcessPushedRecords(ctx context.Context, records []Observation, clientID string, transmissionID string) (*SyncPushResult, error) {
	var successCount int
	var failedRecords []map[string]interface{}
	var warnings []SyncWarning

	// Begin transaction for atomic processing
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		s.log.Error("Failed to begin transaction", "error", err)
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	committed := false
	defer func() {
		if !committed {
			if err := tx.Rollback(); err != nil {
				s.log.Error("Failed to rollback transaction", "error", err)
			}
		}
	}()

	for i, record := range records {
		// Validate required fields
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
			warnings = append(warnings, SyncWarning{
				ID:      record.ObservationID,
				Code:    "MISSING_FORM_TYPE",
				Message: "form_type is empty but record was processed",
			})
		}

		// Insert or update the observation
		query := `
			INSERT INTO observations (observation_id, form_type, form_version, data, created_at, updated_at, deleted)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (observation_id) 
			DO UPDATE SET 
				form_type = EXCLUDED.form_type,
				form_version = EXCLUDED.form_version,
				data = EXCLUDED.data,
				updated_at = EXCLUDED.updated_at,
				deleted = EXCLUDED.deleted,
				version = observations.version + 1
		`

		_, err := tx.ExecContext(ctx, query,
			record.ObservationID, record.FormType, record.FormVersion,
			record.Data, record.CreatedAt, record.UpdatedAt, record.Deleted)

		if err != nil {
			s.log.Error("Failed to insert/update observation", "error", err, "observationId", record.ObservationID)
			failedRecords = append(failedRecords, map[string]interface{}{
				"index":  i,
				"error":  fmt.Sprintf("database error: %v", err),
				"record": record,
			})
			continue
		}

		successCount++
	}

	// Get the current version WITHIN the transaction to ensure consistency
	var currentVersion int64
	err = tx.QueryRowContext(ctx, "SELECT current_version FROM sync_version ORDER BY id DESC LIMIT 1").Scan(&currentVersion)
	if err != nil {
		s.log.Error("Failed to get current version within transaction", "error", err)
		return nil, fmt.Errorf("failed to get current version: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		s.log.Error("Failed to commit transaction", "error", err)
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}
	committed = true

	result := &SyncPushResult{
		CurrentVersion: currentVersion,
		SuccessCount:   successCount,
		FailedRecords:  failedRecords,
		Warnings:       warnings,
	}

	s.log.Info("Processed pushed records",
		"transmissionId", transmissionID,
		"clientId", clientID,
		"totalRecords", len(records),
		"successCount", successCount,
		"failedCount", len(failedRecords),
		"warningCount", len(warnings),
		"currentVersion", currentVersion)

	return result, nil
}
