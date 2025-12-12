package dataexport

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

// postgresDB implements DatabaseInterface for PostgreSQL
type postgresDB struct {
	db *sql.DB
}

// NewPostgresDB creates a new PostgreSQL database adapter
func NewPostgresDB(db *sql.DB) DatabaseInterface {
	return &postgresDB{db: db}
}

// GetFormTypes returns all distinct form types in the observations table
func (p *postgresDB) GetFormTypes(ctx context.Context) ([]string, error) {
	query := `
		SELECT DISTINCT form_type 
		FROM observations 
		WHERE deleted = false 
		ORDER BY form_type
	`

	rows, err := p.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query form types: %w", err)
	}
	defer rows.Close()

	var formTypes []string
	for rows.Next() {
		var formType string
		if err := rows.Scan(&formType); err != nil {
			return nil, fmt.Errorf("failed to scan form type: %w", err)
		}
		formTypes = append(formTypes, formType)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating form types: %w", err)
	}

	return formTypes, nil
}

// GetFormTypeSchema analyzes the JSON data structure for a form type and returns column definitions
func (p *postgresDB) GetFormTypeSchema(ctx context.Context, formType string) (*FormTypeSchema, error) {
	// Use the provided SQL query to analyze the data structure
	query := `
		WITH key_types AS (
			SELECT
				form_type,
				key,
				jsonb_typeof(data -> key) AS type
			FROM
				public.observations,
				LATERAL jsonb_object_keys(data) AS key
			WHERE
				form_type = $1 AND deleted = false
		),
		agg_types AS (
			SELECT
				form_type,
				key,
				string_agg(DISTINCT type, ', ') AS types_found,
				count(DISTINCT type) AS type_count
			FROM
				key_types
			GROUP BY
				form_type,
				key
		)
		SELECT
			key,
			types_found,
			type_count,
			CASE
				WHEN type_count > 1 THEN 'text'
				WHEN types_found = 'number' THEN 'numeric'
				WHEN types_found = 'string' THEN 'text'
				WHEN types_found = 'boolean' THEN 'boolean'
				ELSE 'text'
			END AS sql_type
		FROM
			agg_types
		ORDER BY key
	`

	rows, err := p.db.QueryContext(ctx, query, formType)
	if err != nil {
		return nil, fmt.Errorf("failed to analyze form type schema: %w", err)
	}
	defer rows.Close()

	var columns []FormTypeColumn
	for rows.Next() {
		var key, typesFound, sqlType string
		var typeCount int

		if err := rows.Scan(&key, &typesFound, &typeCount, &sqlType); err != nil {
			return nil, fmt.Errorf("failed to scan column info: %w", err)
		}

		columns = append(columns, FormTypeColumn{
			Key:      key,
			DataType: typesFound,
			SQLType:  sqlType,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating column info: %w", err)
	}

	return &FormTypeSchema{
		FormType: formType,
		Columns:  columns,
	}, nil
}

// GetObservationsForFormType returns all observations for a specific form type with flattened data
func (p *postgresDB) GetObservationsForFormType(ctx context.Context, formType string, schema *FormTypeSchema) ([]ObservationRow, error) {
	// Build the dynamic SELECT clause for data fields
	var selectParts []string
	for _, col := range schema.Columns {
		switch col.SQLType {
		case "numeric":
			selectParts = append(selectParts, fmt.Sprintf("(data ->> '%s')::numeric AS data_%s", col.Key, col.Key))
		case "boolean":
			selectParts = append(selectParts, fmt.Sprintf("(data ->> '%s')::boolean AS data_%s", col.Key, col.Key))
		default:
			selectParts = append(selectParts, fmt.Sprintf("(data ->> '%s')::text AS data_%s", col.Key, col.Key))
		}
	}

	selectClause := ""
	if len(selectParts) > 0 {
		selectClause = ", " + strings.Join(selectParts, ", ")
	}

	query := fmt.Sprintf(`
		SELECT 
			observation_id,
			form_type,
			form_version,
			created_at,
			updated_at,
			synced_at,
			deleted,
			version,
			geolocation
			%s
		FROM observations 
		WHERE form_type = $1 AND deleted = false
		ORDER BY created_at
	`, selectClause)

	rows, err := p.db.QueryContext(ctx, query, formType)
	if err != nil {
		return nil, fmt.Errorf("failed to query observations for form type %s: %w", formType, err)
	}
	defer rows.Close()

	var observations []ObservationRow
	for rows.Next() {
		var obs ObservationRow
		var geolocationBytes []byte

		// Create slice for scanning - base columns plus data fields
		scanArgs := make([]interface{}, 9+len(schema.Columns))
		scanArgs[0] = &obs.ObservationID
		scanArgs[1] = &obs.FormType
		scanArgs[2] = &obs.FormVersion
		scanArgs[3] = &obs.CreatedAt
		scanArgs[4] = &obs.UpdatedAt
		scanArgs[5] = &obs.SyncedAt
		scanArgs[6] = &obs.Deleted
		scanArgs[7] = &obs.Version
		scanArgs[8] = &geolocationBytes

		// Add data field scan targets
		dataValues := make([]interface{}, len(schema.Columns))
		for i := range schema.Columns {
			scanArgs[9+i] = &dataValues[i]
		}

		if err := rows.Scan(scanArgs...); err != nil {
			return nil, fmt.Errorf("failed to scan observation: %w", err)
		}

		// Handle geolocation
		if geolocationBytes != nil {
			obs.Geolocation = json.RawMessage(geolocationBytes)
		}

		// Build data fields map
		obs.DataFields = make(map[string]interface{})
		for i, col := range schema.Columns {
			if dataValues[i] != nil {
				obs.DataFields["data_"+col.Key] = dataValues[i]
			}
		}

		observations = append(observations, obs)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating observations: %w", err)
	}

	return observations, nil
}
