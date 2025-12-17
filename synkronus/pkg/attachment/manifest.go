package attachment

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"strings"

	"github.com/opendataensemble/synkronus/pkg/config"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

// AttachmentOperation represents an operation to be performed on an attachment
type AttachmentOperation struct {
	Operation    string  `json:"operation" db:"operation"`
	AttachmentID string  `json:"attachment_id" db:"attachment_id"`
	DownloadURL  *string `json:"download_url,omitempty"`
	Size         *int    `json:"size,omitempty" db:"size"`
	ContentType  *string `json:"content_type,omitempty" db:"content_type"`
	Version      int64   `json:"version" db:"version"`
}

// AttachmentManifestRequest represents the request for attachment manifest
type AttachmentManifestRequest struct {
	ClientID     string `json:"client_id"`
	SinceVersion int64  `json:"since_version"`
}

// AttachmentManifestResponse represents the response containing attachment manifest
type AttachmentManifestResponse struct {
	CurrentVersion    int64                 `json:"current_version"`
	Operations        []AttachmentOperation `json:"operations"`
	TotalDownloadSize int64                 `json:"total_download_size"`
	OperationCount    OperationCount        `json:"operation_count"`
}

// OperationCount represents the count of operations by type
type OperationCount struct {
	Download int `json:"download"`
	Delete   int `json:"delete"`
}

// ManifestService defines the interface for attachment manifest operations
type ManifestService interface {
	// GetManifest returns attachment operations since the specified version
	GetManifest(ctx context.Context, req AttachmentManifestRequest) (*AttachmentManifestResponse, error)

	// RecordOperation records an attachment operation for sync tracking
	RecordOperation(ctx context.Context, attachmentID, operation, clientID string, size *int, contentType *string) error

	// Initialize initializes the manifest service
	Initialize(ctx context.Context) error
}

// manifestService implements ManifestService
type manifestService struct {
	db      *sql.DB
	cfg     *config.Config
	log     *logger.Logger
	baseURL string
}

// NewManifestService creates a new attachment manifest service
func NewManifestService(db *sql.DB, cfg *config.Config, log *logger.Logger) ManifestService {
	// Construct base URL from config port
	baseURL := fmt.Sprintf("http://localhost:%s", cfg.Port)

	return &manifestService{
		db:      db,
		cfg:     cfg,
		log:     log,
		baseURL: baseURL,
	}
}

// Initialize initializes the manifest service
func (s *manifestService) Initialize(ctx context.Context) error {
	// Check if attachment_operations table exists
	var exists bool
	err := s.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public' 
			AND table_name = 'attachment_operations'
		)
	`).Scan(&exists)

	if err != nil {
		return fmt.Errorf("failed to check attachment_operations table: %w", err)
	}

	if !exists {
		return fmt.Errorf("attachment_operations table does not exist - please run database migrations")
	}

	s.log.Info("Attachment manifest service initialized")
	return nil
}

// GetManifest returns attachment operations since the specified version
func (s *manifestService) GetManifest(ctx context.Context, req AttachmentManifestRequest) (*AttachmentManifestResponse, error) {
	// Get current version
	var currentVersion int64
	err := s.db.QueryRowContext(ctx, "SELECT current_version FROM sync_version WHERE id = 1").Scan(&currentVersion)
	if err != nil {
		return nil, fmt.Errorf("failed to get current version: %w", err)
	}

	// Query attachment operations since the specified version
	// We need to get the latest operation for each attachment_id
	query := `
		WITH latest_operations AS (
			SELECT DISTINCT ON (attachment_id) 
				attachment_id,
				operation,
				size,
				content_type,
				version
			FROM attachment_operations 
			WHERE version > $1 
				AND (client_id = $2 OR client_id IS NULL)
			ORDER BY attachment_id, version DESC
		)
		SELECT 
			attachment_id,
			operation,
			size,
			content_type,
			version
		FROM latest_operations
		ORDER BY version ASC
	`

	rows, err := s.db.QueryContext(ctx, query, req.SinceVersion, req.ClientID)
	if err != nil {
		return nil, fmt.Errorf("failed to query attachment operations: %w", err)
	}
	defer rows.Close()

	var operations []AttachmentOperation
	var totalDownloadSize int64
	downloadCount := 0
	deleteCount := 0

	for rows.Next() {
		var op AttachmentOperation
		var size sql.NullInt32
		var contentType sql.NullString

		err := rows.Scan(
			&op.AttachmentID,
			&op.Operation,
			&size,
			&contentType,
			&op.Version,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan attachment operation: %w", err)
		}

		// Set optional fields
		if size.Valid {
			sizeInt := int(size.Int32)
			op.Size = &sizeInt
		}
		if contentType.Valid {
			op.ContentType = &contentType.String
		}

		// Generate download URL for download operations
		if op.Operation == "create" || op.Operation == "update" {
			op.Operation = "download" // Normalize to download for client
			downloadURL := s.generateDownloadURL(op.AttachmentID)
			op.DownloadURL = &downloadURL

			if op.Size != nil {
				totalDownloadSize += int64(*op.Size)
			}
			downloadCount++
		} else if op.Operation == "delete" {
			deleteCount++
		}

		operations = append(operations, op)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating attachment operations: %w", err)
	}

	response := &AttachmentManifestResponse{
		CurrentVersion:    currentVersion,
		Operations:        operations,
		TotalDownloadSize: totalDownloadSize,
		OperationCount: OperationCount{
			Download: downloadCount,
			Delete:   deleteCount,
		},
	}

	s.log.Info("Generated attachment manifest",
		"clientId", req.ClientID,
		"sinceVersion", req.SinceVersion,
		"currentVersion", currentVersion,
		"operationCount", len(operations),
		"downloadCount", downloadCount,
		"deleteCount", deleteCount,
		"totalDownloadSize", totalDownloadSize)

	return response, nil
}

// RecordOperation records an attachment operation for sync tracking
func (s *manifestService) RecordOperation(ctx context.Context, attachmentID, operation, clientID string, size *int, contentType *string) error {
	query := `
		INSERT INTO attachment_operations (attachment_id, operation, client_id, size, content_type)
		VALUES ($1, $2, $3, $4, $5)
	`

	var sizeParam interface{}
	if size != nil {
		sizeParam = *size
	}

	var contentTypeParam interface{}
	if contentType != nil {
		contentTypeParam = *contentType
	}

	var clientIDParam interface{}
	if clientID != "" {
		clientIDParam = clientID
	}

	_, err := s.db.ExecContext(ctx, query, attachmentID, operation, clientIDParam, sizeParam, contentTypeParam)
	if err != nil {
		return fmt.Errorf("failed to record attachment operation: %w", err)
	}

	s.log.Debug("Recorded attachment operation",
		"attachmentId", attachmentID,
		"operation", operation,
		"clientId", clientID,
		"size", size,
		"contentType", contentType)

	return nil
}

// generateDownloadURL generates a download URL for an attachment
func (s *manifestService) generateDownloadURL(attachmentID string) string {
	baseURL := strings.TrimSuffix(s.baseURL, "/")
	escapedID := url.PathEscape(attachmentID)
	return fmt.Sprintf("%s/attachments/%s", baseURL, escapedID)
}
