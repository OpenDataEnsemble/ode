package dataexport

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestPostgresDB_GetFormTypes(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("Failed to create mock database: %v", err)
	}
	defer db.Close()

	pgDB := NewPostgresDB(db)

	tests := []struct {
		name          string
		mockRows      *sqlmock.Rows
		expectedTypes []string
		expectError   bool
	}{
		{
			name: "successful query with multiple form types",
			mockRows: sqlmock.NewRows([]string{"form_type"}).
				AddRow("survey").
				AddRow("inspection").
				AddRow("report"),
			expectedTypes: []string{"survey", "inspection", "report"},
			expectError:   false,
		},
		{
			name:          "empty result",
			mockRows:      sqlmock.NewRows([]string{"form_type"}),
			expectedTypes: []string{},
			expectError:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			expectedQuery := `SELECT DISTINCT form_type FROM observations WHERE deleted = false ORDER BY form_type`
			mock.ExpectQuery(expectedQuery).WillReturnRows(tt.mockRows)

			formTypes, err := pgDB.GetFormTypes(context.Background())

			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if len(formTypes) != len(tt.expectedTypes) {
				t.Errorf("Expected %d form types, got %d", len(tt.expectedTypes), len(formTypes))
			}

			for i, expected := range tt.expectedTypes {
				if i >= len(formTypes) || formTypes[i] != expected {
					t.Errorf("Expected form type %d to be %s, got %s", i, expected, formTypes[i])
				}
			}

			if err := mock.ExpectationsWereMet(); err != nil {
				t.Errorf("Unfulfilled expectations: %v", err)
			}
		})
	}
}

func TestPostgresDB_GetFormTypeSchema(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("Failed to create mock database: %v", err)
	}
	defer db.Close()

	pgDB := NewPostgresDB(db)

	tests := []struct {
		name            string
		formType        string
		mockRows        *sqlmock.Rows
		expectedColumns []FormTypeColumn
		expectError     bool
	}{
		{
			name:     "successful schema analysis",
			formType: "survey",
			mockRows: sqlmock.NewRows([]string{"key", "types_found", "type_count", "sql_type"}).
				AddRow("question", "string", 1, "text").
				AddRow("rating", "number", 1, "numeric").
				AddRow("completed", "boolean", 1, "boolean"),
			expectedColumns: []FormTypeColumn{
				{Key: "question", DataType: "string", SQLType: "text"},
				{Key: "rating", DataType: "number", SQLType: "numeric"},
				{Key: "completed", DataType: "boolean", SQLType: "boolean"},
			},
			expectError: false,
		},
		{
			name:            "empty schema",
			formType:        "empty_form",
			mockRows:        sqlmock.NewRows([]string{"key", "types_found", "type_count", "sql_type"}),
			expectedColumns: []FormTypeColumn{},
			expectError:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock.ExpectQuery(`WITH key_types AS`).WithArgs(tt.formType).WillReturnRows(tt.mockRows)

			schema, err := pgDB.GetFormTypeSchema(context.Background(), tt.formType)

			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if schema == nil {
				t.Fatal("Expected schema but got nil")
			}

			if schema.FormType != tt.formType {
				t.Errorf("Expected form type %s, got %s", tt.formType, schema.FormType)
			}

			if len(schema.Columns) != len(tt.expectedColumns) {
				t.Errorf("Expected %d columns, got %d", len(tt.expectedColumns), len(schema.Columns))
			}

			for i, expected := range tt.expectedColumns {
				if i >= len(schema.Columns) {
					t.Errorf("Missing expected column %d: %+v", i, expected)
					continue
				}
				actual := schema.Columns[i]
				if actual.Key != expected.Key || actual.DataType != expected.DataType || actual.SQLType != expected.SQLType {
					t.Errorf("Column %d mismatch: expected %+v, got %+v", i, expected, actual)
				}
			}

			if err := mock.ExpectationsWereMet(); err != nil {
				t.Errorf("Unfulfilled expectations: %v", err)
			}
		})
	}
}

func TestPostgresDB_GetObservationsForFormType(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("Failed to create mock database: %v", err)
	}
	defer db.Close()

	pgDB := NewPostgresDB(db)

	schema := &FormTypeSchema{
		FormType: "survey",
		Columns: []FormTypeColumn{
			{Key: "question", DataType: "string", SQLType: "text"},
			{Key: "rating", DataType: "number", SQLType: "numeric"},
		},
	}

	tests := []struct {
		name             string
		formType         string
		mockRows         *sqlmock.Rows
		expectedObsCount int
		expectError      bool
	}{
		{
			name:     "successful observations query",
			formType: "survey",
			mockRows: sqlmock.NewRows([]string{
				"observation_id", "form_type", "form_version", "created_at", "updated_at",
				"synced_at", "deleted", "version", "geolocation", "data_question", "data_rating",
			}).AddRow(
				"obs1", "survey", "1.0", "2023-01-01T00:00:00Z", "2023-01-01T00:00:00Z",
				nil, false, int64(1), nil, "Good service", 4.5,
			).AddRow(
				"obs2", "survey", "1.0", "2023-01-02T00:00:00Z", "2023-01-02T00:00:00Z",
				nil, false, int64(2), nil, "Poor service", 2.0,
			),
			expectedObsCount: 2,
			expectError:      false,
		},
		{
			name:     "empty observations",
			formType: "survey",
			mockRows: sqlmock.NewRows([]string{
				"observation_id", "form_type", "form_version", "created_at", "updated_at",
				"synced_at", "deleted", "version", "geolocation", "data_question", "data_rating",
			}),
			expectedObsCount: 0,
			expectError:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock.ExpectQuery(`SELECT`).WithArgs(tt.formType).WillReturnRows(tt.mockRows)

			observations, err := pgDB.GetObservationsForFormType(context.Background(), tt.formType, schema)

			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if len(observations) != tt.expectedObsCount {
				t.Errorf("Expected %d observations, got %d", tt.expectedObsCount, len(observations))
			}

			// Verify structure of first observation if any
			if len(observations) > 0 {
				obs := observations[0]
				if obs.ObservationID == "" {
					t.Error("Expected observation ID to be set")
				}
				if obs.FormType != tt.formType {
					t.Errorf("Expected form type %s, got %s", tt.formType, obs.FormType)
				}
				if obs.DataFields == nil {
					t.Error("Expected data fields to be initialized")
				}
			}

			if err := mock.ExpectationsWereMet(); err != nil {
				t.Errorf("Unfulfilled expectations: %v", err)
			}
		})
	}
}
