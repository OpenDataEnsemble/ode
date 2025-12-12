package dataexport

import (
	"archive/zip"
	"bytes"
	"context"
	"io"
	"testing"

	"github.com/opendataensemble/synkronus/pkg/config"
)

// MockDatabaseInterface is a mock implementation of DatabaseInterface for testing
type MockDatabaseInterface struct {
	FormTypes            []string
	FormTypeSchemas      map[string]*FormTypeSchema
	ObservationsData     map[string][]ObservationRow
	GetFormTypesError    error
	GetSchemaError       error
	GetObservationsError error
}

func (m *MockDatabaseInterface) GetFormTypes(ctx context.Context) ([]string, error) {
	if m.GetFormTypesError != nil {
		return nil, m.GetFormTypesError
	}
	return m.FormTypes, nil
}

func (m *MockDatabaseInterface) GetFormTypeSchema(ctx context.Context, formType string) (*FormTypeSchema, error) {
	if m.GetSchemaError != nil {
		return nil, m.GetSchemaError
	}
	schema, exists := m.FormTypeSchemas[formType]
	if !exists {
		return &FormTypeSchema{FormType: formType, Columns: []FormTypeColumn{}}, nil
	}
	return schema, nil
}

func (m *MockDatabaseInterface) GetObservationsForFormType(ctx context.Context, formType string, schema *FormTypeSchema) ([]ObservationRow, error) {
	if m.GetObservationsError != nil {
		return nil, m.GetObservationsError
	}
	observations, exists := m.ObservationsData[formType]
	if !exists {
		return []ObservationRow{}, nil
	}
	return observations, nil
}

func TestService_ExportParquetZip(t *testing.T) {
	tests := []struct {
		name          string
		mockDB        *MockDatabaseInterface
		expectedFiles []string
		expectError   bool
		errorContains string
	}{
		{
			name: "successful export with multiple form types",
			mockDB: &MockDatabaseInterface{
				FormTypes: []string{"survey", "inspection"},
				FormTypeSchemas: map[string]*FormTypeSchema{
					"survey": {
						FormType: "survey",
						Columns: []FormTypeColumn{
							{Key: "question1", DataType: "string", SQLType: "text"},
							{Key: "rating", DataType: "number", SQLType: "numeric"},
						},
					},
					"inspection": {
						FormType: "inspection",
						Columns: []FormTypeColumn{
							{Key: "status", DataType: "string", SQLType: "text"},
							{Key: "passed", DataType: "boolean", SQLType: "boolean"},
						},
					},
				},
				ObservationsData: map[string][]ObservationRow{
					"survey": {
						{
							ObservationID: "obs1",
							FormType:      "survey",
							FormVersion:   "1.0",
							CreatedAt:     "2023-01-01T00:00:00Z",
							UpdatedAt:     "2023-01-01T00:00:00Z",
							Deleted:       false,
							Version:       1,
							DataFields: map[string]interface{}{
								"data_question1": "Good service",
								"data_rating":    4.5,
							},
						},
					},
					"inspection": {
						{
							ObservationID: "obs2",
							FormType:      "inspection",
							FormVersion:   "1.0",
							CreatedAt:     "2023-01-01T00:00:00Z",
							UpdatedAt:     "2023-01-01T00:00:00Z",
							Deleted:       false,
							Version:       2,
							DataFields: map[string]interface{}{
								"data_status": "complete",
								"data_passed": true,
							},
						},
					},
				},
			},
			expectedFiles: []string{"survey.parquet", "inspection.parquet"},
			expectError:   false,
		},
		{
			name: "empty form types",
			mockDB: &MockDatabaseInterface{
				FormTypes:        []string{},
				FormTypeSchemas:  map[string]*FormTypeSchema{},
				ObservationsData: map[string][]ObservationRow{},
			},
			expectedFiles: []string{},
			expectError:   false,
		},
		{
			name: "form type with no observations",
			mockDB: &MockDatabaseInterface{
				FormTypes: []string{"empty_form"},
				FormTypeSchemas: map[string]*FormTypeSchema{
					"empty_form": {
						FormType: "empty_form",
						Columns:  []FormTypeColumn{},
					},
				},
				ObservationsData: map[string][]ObservationRow{
					"empty_form": {},
				},
			},
			expectedFiles: []string{},
			expectError:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &config.Config{}
			service := NewService(tt.mockDB, cfg)

			zipReader, err := service.ExportParquetZip(context.Background())

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
					return
				}
				if tt.errorContains != "" && !bytes.Contains([]byte(err.Error()), []byte(tt.errorContains)) {
					t.Errorf("Expected error to contain '%s', got: %s", tt.errorContains, err.Error())
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}
			defer zipReader.Close()

			// Read ZIP content
			zipData, err := io.ReadAll(zipReader)
			if err != nil {
				t.Errorf("Failed to read ZIP data: %v", err)
				return
			}

			// Parse ZIP file
			zipReader2, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
			if err != nil {
				t.Errorf("Failed to parse ZIP file: %v", err)
				return
			}

			// Check expected files
			foundFiles := make(map[string]bool)
			for _, file := range zipReader2.File {
				foundFiles[file.Name] = true
			}

			for _, expectedFile := range tt.expectedFiles {
				if !foundFiles[expectedFile] {
					t.Errorf("Expected file %s not found in ZIP", expectedFile)
				}
			}

			if len(foundFiles) != len(tt.expectedFiles) {
				t.Errorf("Expected %d files, found %d", len(tt.expectedFiles), len(foundFiles))
			}
		})
	}
}

func TestService_sanitizeFilename(t *testing.T) {
	cfg := &config.Config{}
	mockDB := &MockDatabaseInterface{}
	service := NewService(mockDB, cfg).(*service)

	tests := []struct {
		input    string
		expected string
	}{
		{"simple_form", "simple_form"},
		{"form/with/slashes", "form_with_slashes"},
		{"form\\with\\backslashes", "form_with_backslashes"},
		{"form:with:colons", "form_with_colons"},
		{"form*with*asterisks", "form_with_asterisks"},
		{"form?with?questions", "form_with_questions"},
		{"form\"with\"quotes", "form_with_quotes"},
		{"form<with>brackets", "form_with_brackets"},
		{"form|with|pipes", "form_with_pipes"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := service.sanitizeFilename(tt.input)
			if result != tt.expected {
				t.Errorf("sanitizeFilename(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestService_buildArrowSchema(t *testing.T) {
	cfg := &config.Config{}
	mockDB := &MockDatabaseInterface{}
	service := NewService(mockDB, cfg).(*service)

	schema := &FormTypeSchema{
		FormType: "test_form",
		Columns: []FormTypeColumn{
			{Key: "text_field", DataType: "string", SQLType: "text"},
			{Key: "number_field", DataType: "number", SQLType: "numeric"},
			{Key: "bool_field", DataType: "boolean", SQLType: "boolean"},
		},
	}

	arrowSchema := service.buildArrowSchema(schema)

	// Check that we have the expected number of fields (9 base + 3 data fields)
	expectedFieldCount := 9 + len(schema.Columns)
	if len(arrowSchema.Fields()) != expectedFieldCount {
		t.Errorf("Expected %d fields, got %d", expectedFieldCount, len(arrowSchema.Fields()))
	}

	// Check base fields
	baseFields := []string{
		"observation_id", "form_type", "form_version", "created_at",
		"updated_at", "synced_at", "deleted", "version", "geolocation",
	}

	for i, expectedName := range baseFields {
		if arrowSchema.Field(i).Name != expectedName {
			t.Errorf("Expected field %d to be %s, got %s", i, expectedName, arrowSchema.Field(i).Name)
		}
	}

	// Check data fields
	dataFields := []string{"data_text_field", "data_number_field", "data_bool_field"}
	for i, expectedName := range dataFields {
		fieldIndex := 9 + i
		if arrowSchema.Field(fieldIndex).Name != expectedName {
			t.Errorf("Expected field %d to be %s, got %s", fieldIndex, expectedName, arrowSchema.Field(fieldIndex).Name)
		}
	}
}
