package appbundle

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createTestZip(t *testing.T, files map[string]string) (*bytes.Buffer, error) {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	for name, content := range files {
		f, err := w.Create(name)
		require.NoError(t, err, "failed to create zip entry")
		_, err = f.Write([]byte(content))
		require.NoError(t, err, "failed to write zip entry content")
	}

	err := w.Close()
	require.NoError(t, err, "failed to close zip writer")

	return buf, nil
}

func TestValidateBundleStructure(t *testing.T) {
	tests := []struct {
		name    string
		files   map[string]string
		wantErr bool
		err     error
	}{
		{
			name: "valid bundle",
			files: map[string]string{
				"app/index.html":         "<html></html>",
				"forms/user/schema.json": `{"core_id": "user", "fields": []}`,
				"forms/user/ui.json":     "{}",
				"cells/button/cell.jsx":  "export default function Button() {}",
			},
			wantErr: false,
		},
		{
			name: "missing app/index.html",
			files: map[string]string{
				"forms/user/schema.json": "{}",
				"cells/button/cell.jsx":  "",
			},
			wantErr: true,
			err:     ErrMissingAppIndex,
		},
		{
			name: "invalid top-level directory",
			files: map[string]string{
				"app/index.html":       "<html></html>",
				"invalid-dir/file.txt": "should not be here",
			},
			wantErr: true,
			err:     ErrInvalidStructure,
		},
		{
			name: "invalid form structure - missing schema.json",
			files: map[string]string{
				"app/index.html":     "<html></html>",
				"forms/user/ui.json": "{}", // Missing schema.json
			},
			wantErr: true,
			err:     ErrInvalidFormStructure,
		},
		{
			name: "invalid cell structure - wrong extension",
			files: map[string]string{
				"app/index.html":       "<html></html>",
				"cells/button/cell.js": "should be .jsx",
			},
			wantErr: true,
			err:     ErrInvalidCellStructure,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			zipData, err := createTestZip(t, tt.files)
			require.NoError(t, err, "failed to create test zip")

			tempFile, err := os.CreateTemp("", "test-bundle-*.zip")
			require.NoError(t, err, "failed to create temp file")
			defer os.Remove(tempFile.Name())

			_, err = tempFile.Write(zipData.Bytes())
			require.NoError(t, err, "failed to write zip data")
			tempFile.Close()

			zipFile, err := zip.OpenReader(tempFile.Name())
			require.NoError(t, err, "failed to open zip file")
			defer zipFile.Close()

			service := &Service{
				bundlePath:   filepath.Join(t.TempDir(), "bundle"),
				versionsPath: filepath.Join(t.TempDir(), "versions"),
				maxVersions:  5,
			}

			err = service.validateBundleStructure(&zipFile.Reader)

			if tt.wantErr {
				require.Error(t, err, "expected error but got none")
				if tt.err != nil {
					assert.ErrorIs(t, err, tt.err, "unexpected error type")
				}
			} else {
				assert.NoError(t, err, "unexpected error")
			}
		})
	}
}

func TestValidateFormCellReferences(t *testing.T) {
	tests := []struct {
		name    string
		files   map[string]string
		wantErr bool
		err     error
	}{
		{
			name: "valid cell reference",
			files: map[string]string{
				"app/index.html": "<html></html>",
				"forms/user/schema.json": `{
					"core_id": "user",
					"fields": [
						{
							"name": "button",
							"cellType": "button"
						}
					]
				}`,
				"cells/button/cell.jsx": "export default function Button() {}",
			},
			wantErr: false,
		},
		{
			name: "missing cell reference",
			files: map[string]string{
				"app/index.html": "<html></html>",
				"forms/user/schema.json": `{
					"core_id": "user",
					"fields": [
						{
							"name": "button",
							"cellType": "missing-button"
						}
					]
				}`,
			},
			wantErr: true,
			err:     ErrMissingCellReference,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			zipData, err := createTestZip(t, tt.files)
			require.NoError(t, err, "failed to create test zip")

			tempFile, err := os.CreateTemp("", "test-bundle-*.zip")
			require.NoError(t, err, "failed to create temp file")
			defer os.Remove(tempFile.Name())

			_, err = tempFile.Write(zipData.Bytes())
			require.NoError(t, err, "failed to write zip data")
			tempFile.Close()

			zipFile, err := zip.OpenReader(tempFile.Name())
			require.NoError(t, err, "failed to open zip file")
			defer zipFile.Close()

			service := &Service{
				bundlePath:   filepath.Join(t.TempDir(), "bundle"),
				versionsPath: filepath.Join(t.TempDir(), "versions"),
				maxVersions:  5,
			}

			err = service.validateFormCellReferences(&zipFile.Reader)

			if tt.wantErr {
				require.Error(t, err, "expected error but got none")
				if tt.err != nil {
					assert.ErrorIs(t, err, tt.err, "unexpected error type")
				}
			} else {
				assert.NoError(t, err, "unexpected error")
			}
		})
	}
}

func TestValidateCoreFields(t *testing.T) {
	tests := []struct {
		name          string
		schema        string
		hasCoreFields bool
		shouldError   bool
	}{
		{
			name: "no core fields",
			schema: `{
				"fields": [
					{"name": "regularField", "type": "string"}
				]
			}`,
			hasCoreFields: false,
			shouldError:   false,
		},
		{
			name: "with core fields",
			schema: `{
				"core_id": "test",
				"core_version": 1,
				"fields": []
			}`,
			hasCoreFields: true,
			shouldError:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var schema map[string]interface{}
			err := json.Unmarshal([]byte(tt.schema), &schema)
			require.NoError(t, err, "failed to unmarshal test schema")

			coreFields, _ := extractCoreFields(schema)
			if tt.hasCoreFields {
				assert.NotEmpty(t, coreFields, "expected core fields but found none")
			} else {
				assert.Empty(t, coreFields, "expected no core fields but found some")
			}

			if tt.hasCoreFields {
				hash1, err := hashCoreFields(coreFields)
				require.NoError(t, err, "failed to hash core fields")
				assert.NotEmpty(t, hash1, "hash should not be empty")

				coreFields2, _ := extractCoreFields(schema)
				hash2, err := hashCoreFields(coreFields2)
				require.NoError(t, err, "failed to hash core fields")
				assert.Equal(t, hash1, hash2, "hashes should be equal for same input")
			}
		})
	}
}

func TestExtractFields(t *testing.T) {
	tests := []struct {
		name   string
		schema map[string]interface{}
		want   []FieldInfo
	}{
		{
			name: "no fields",
			schema: map[string]interface{}{
				"$schema":    "http://json-schema.org/draft/2020-12/schema",
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
			},
			want: []FieldInfo{},
		},
		{
			name: "single field",
			schema: map[string]interface{}{
				"$schema": "http://json-schema.org/draft/2020-12/schema",
				"type":    "object",
				"properties": map[string]interface{}{
					"username": map[string]interface{}{
						"type":       "string",
						"x-cellType": "text",
						"title":      "Username",
					},
				},
				"required": []string{"username"},
			},
			want: []FieldInfo{{
				Name:     "username",
				Type:     "string",
				CellType: "text",
				Default:  nil,
				Required: true,
			}},
		},
		{
			name: "single core field",
			schema: map[string]interface{}{
				"$schema": "http://json-schema.org/draft/2020-12/schema",
				"type":    "object",
				"properties": map[string]interface{}{
					"username": map[string]interface{}{
						"type":   "string",
						"x-core": true,
						"title":  "Username",
					},
				},
				"required": []string{"username"},
			},
			want: []FieldInfo{{
				Name:     "username",
				Type:     "string",
				Default:  nil,
				Core:     true,
				Required: true,
			}},
		},
		{
			name: "implicit core field",
			schema: map[string]interface{}{
				"$schema": "http://json-schema.org/draft/2020-12/schema",
				"type":    "object",
				"properties": map[string]interface{}{
					"core_id": map[string]interface{}{
						"type": "string",
					},
				},
				"required": []string{"core_id"},
			},
			want: []FieldInfo{{
				Name:     "core_id",
				Type:     "string",
				Default:  nil,
				Core:     true,
				Required: true,
			}},
		},
		{
			name: "multiple fields with defaults",
			schema: map[string]interface{}{
				"$schema": "http://json-schema.org/draft/2020-12/schema",
				"type":    "object",
				"properties": map[string]interface{}{
					"age": map[string]interface{}{
						"type":    "integer",
						"title":   "Age",
						"minimum": 0,
						"maximum": 150,
						"default": 30,
					},
					"active": map[string]interface{}{
						"type":    "boolean",
						"title":   "Active Status",
						"default": true,
					},
				},
				"required": []string{"age", "active"},
			},
			want: []FieldInfo{
				{
					Name:     "age",
					Type:     "integer",
					Default:  float64(30), // JSON numbers are unmarshaled as float64
					Required: true,
				},
				{
					Name:     "active",
					Type:     "boolean",
					Default:  true,
					Required: true,
				},
			},
		},
		{
			name: "nested fields structure",
			schema: map[string]interface{}{
				"$schema": "http://json-schema.org/draft/2020-12/schema",
				"type":    "object",
				"properties": map[string]interface{}{
					"address": map[string]interface{}{
						"type":  "object",
						"title": "Mailing Address",
						"properties": map[string]interface{}{
							"street": map[string]interface{}{
								"type":  "string",
								"title": "Street Address",
							},
							"city": map[string]interface{}{
								"type":  "string",
								"title": "City",
							},
							"postalCode": map[string]interface{}{
								"type":    "string",
								"title":   "Postal Code",
								"pattern": "^[0-9]{5}(-[0-9]{4})?$",
							},
						},
						"required": []string{"street", "city", "postalCode"},
					},
				},
			},
			// Note: The current implementation doesn't handle nested fields,
			// so we only expect the top-level field
			want: []FieldInfo{{
				Name:    "address",
				Type:    "object",
				Default: nil,
			}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Convert the schema to JSON and back to ensure it matches the expected format
			jsonData, err := json.Marshal(tt.schema)
			require.NoError(t, err, "failed to marshal test schema")

			var schema map[string]interface{}
			err = json.Unmarshal(jsonData, &schema)
			require.NoError(t, err, "failed to unmarshal test schema")

			got := extractFields(schema)

			assert.ElementsMatch(t, tt.want, got, "extracted fields do not match expected")
		})
	}
}

func TestExtractCoreFields(t *testing.T) {
	tests := []struct {
		name      string
		schema    map[string]interface{}
		wantCore  map[string]interface{}
		wantPaths []string
	}{
		{
			name: "no core fields",
			schema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name": map[string]interface{}{
						"type": "string",
					},
				},
			},
			wantCore:  map[string]interface{}{},
			wantPaths: []string{},
		},
		{
			name: "top level x-core",
			schema: map[string]interface{}{
				"x-core": true,
				"type":   "object",
				"properties": map[string]interface{}{
					"name": map[string]interface{}{
						"type": "string",
					},
					"age": map[string]interface{}{
						"type": "integer",
					},
				},
			},
			wantCore: map[string]interface{}{
				"name": map[string]interface{}{"type": "string"},
				"age":  map[string]interface{}{"type": "integer"},
			},
			wantPaths: []string{"name", "age"},
		},
		{
			name: "core_ prefixed fields",
			schema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"core_id": map[string]interface{}{
						"type": "string",
					},
					"core_name": map[string]interface{}{
						"type": "string",
					},
					"regular_field": map[string]interface{}{
						"type": "string",
					},
				},
			},
			wantCore: map[string]interface{}{
				"core_id":   map[string]interface{}{"type": "string"},
				"core_name": map[string]interface{}{"type": "string"},
			},
			wantPaths: []string{"core_id", "core_name"},
		},
		{
			name: "nested properties with x-core",
			schema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"user": map[string]interface{}{
						"type":   "object",
						"x-core": true,
						"properties": map[string]interface{}{
							"id": map[string]interface{}{
								"type": "string",
							},
							"name": map[string]interface{}{
								"type": "string",
							},
						},
					},
					"metadata": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"createdAt": map[string]interface{}{
								"type":   "string",
								"format": "date-time",
							},
						},
					},
				},
			},
			wantCore: map[string]interface{}{
				"user": map[string]interface{}{
					"type":   "object",
					"x-core": true,
					"properties": map[string]interface{}{
						"id":   map[string]interface{}{"type": "string"},
						"name": map[string]interface{}{"type": "string"},
					},
				},
			},
			wantPaths: []string{"user"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotCore, gotPaths := extractCoreFields(tt.schema)

			// Convert both maps to JSON for better comparison in test output
			gotJSON, _ := json.MarshalIndent(gotCore, "", "  ")
			wantJSON, _ := json.MarshalIndent(tt.wantCore, "", "  ")

			assert.JSONEq(t, string(wantJSON), string(gotJSON), "core fields mismatch")
			assert.ElementsMatch(t, tt.wantPaths, gotPaths, "field paths mismatch")
		})
	}
}

func TestValidateFormSchema(t *testing.T) {
	tests := []struct {
		name    string
		schema  string
		isValid bool
	}{
		{
			name: "valid schema",
			schema: `{
				"core_id": "test",
				"fields": []
			}`,
			isValid: true,
		},
		{
			name:    "invalid JSON",
			schema:  `{invalid: json}`,
			isValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a test zip file with the schema
			files := map[string]string{
				"app/index.html":         "<html></html>",
				"forms/test/schema.json": tt.schema,
				"forms/test/ui.json":     "{}",
			}

			zipData, err := createTestZip(t, files)
			require.NoError(t, err, "failed to create test zip")

			// Create a temporary file for the zip
			tempFile, err := os.CreateTemp("", "test-bundle-*.zip")
			require.NoError(t, err, "failed to create temp file")
			defer os.Remove(tempFile.Name())

			_, err = tempFile.Write(zipData.Bytes())
			require.NoError(t, err, "failed to write zip data")
			tempFile.Close()

			// Open the zip file
			zipFile, err := zip.OpenReader(tempFile.Name())
			require.NoError(t, err, "failed to open zip file")
			defer zipFile.Close()

			// Create a test service
			service := &Service{
				bundlePath:   filepath.Join(t.TempDir(), "bundle"),
				versionsPath: filepath.Join(t.TempDir(), "versions"),
				maxVersions:  5,
			}

			// Find the schema file
			for _, file := range zipFile.File {
				if file.Name == "forms/test/schema.json" {
					err = service.validateFormFile(file)
					if tt.isValid {
						assert.NoError(t, err, "expected no error for valid schema")
					} else {
						assert.Error(t, err, "expected error for invalid schema")
					}
					return
				}
			}
			t.Fatal("schema file not found in test zip")
		})
	}
}
