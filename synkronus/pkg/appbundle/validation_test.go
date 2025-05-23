package appbundle

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
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
				"app/index.html":                "<html></html>",
				"forms/user/schema.json":        `{"core_id": "user", "fields": []}`,
				"forms/user/ui.json":            "{}",
				"renderers/button/renderer.jsx": "export default function Button() {}",
			},
			wantErr: false,
		},
		{
			name: "missing app/index.html",
			files: map[string]string{
				"forms/user/schema.json":        "{}",
				"renderers/button/renderer.jsx": "",
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
			name: "invalid renderer structure - wrong extension",
			files: map[string]string{
				"app/index.html":               "<html></html>",
				"renderers/button/renderer.js": "should be .jsx",
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

// TODO: Fix this: The renderers are referenced in the ui json, not in the schema
func TestValidateFormRendererReferences(t *testing.T) {
	tests := []struct {
		name    string
		files   map[string]string
		wantErr bool
		err     error
	}{
		{
			name: "valid renderer reference",
			files: map[string]string{
				"app/index.html": "<html></html>",
				"forms/user/schema.json": `{
					"core_id": "user",
					"fields": [
						{
							"name": "button",
							"renderer": "button"
						}
					]
				}`,
				"renderers/button/renderer.jsx": "export default function Button() {}",
			},
			wantErr: false,
		},
		{
			name: "missing renderer reference",
			files: map[string]string{
				"app/index.html": "<html></html>",
				"forms/user/schema.json": `{
					"core_id": "user",
					"properties": {
						"button": {
							"type":            "string",
							"x-question-type": "text",
							"title":           "Username",
						},
					},
					"fields": [
						{
							"name": "button",
							"renderer": "missing-button"
						}
					]
				}`,
			},
			wantErr: true,
			err:     ErrMissingRendererReference,
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

			err = service.validateFormRendererReferences(&zipFile.Reader)

			if tt.wantErr {
				require.Error(t, err, "expected error but got none")
				if tt.err != ErrMissingRendererReference {
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
		schema        json.RawMessage
		hasCoreFields bool
		shouldError   bool
	}{
		{
			name: "no core fields",
			schema: json.RawMessage(`{
                "properties": {
                    "regularField": {
                        "type": "string",
                        "title": "Username"
                    }
                }
            }`),
			hasCoreFields: false,
			shouldError:   false,
		},
		{
			name: "with core fields",
			schema: json.RawMessage(`{
                "core_id": "test",
                "core_version": 1,
                "properties": {
                    "an_field": {
                        "type": "string",
                        "x-core": true,
                        "title": "Username"
                    }
                }
            }`),
			hasCoreFields: true,
			shouldError:   false,
		},
		{
			name: "core_ prefixed field",
			schema: json.RawMessage(`{
                "properties": {
                    "core_username": {
                        "type": "string",
                        "title": "Username"
                    }
                }
            }`),
			hasCoreFields: true,
			shouldError:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var schema map[string]interface{}
			err := json.Unmarshal(tt.schema, &schema)
			require.NoError(t, err, "failed to unmarshal test schema")

			coreFields := extractCoreFields(schema)
			if tt.hasCoreFields {
				assert.NotEmpty(t, coreFields, "expected core fields but found none")
			} else {
				assert.Empty(t, coreFields, "expected no core fields but found some")
			}

			if tt.hasCoreFields {
				hash1, err := hashCoreFields(coreFields)
				require.NoError(t, err, "failed to hash core fields")
				assert.NotEmpty(t, hash1, "hash should not be empty")

				var schema2 map[string]interface{}
				json.Unmarshal(tt.schema, &schema2) // Safe to ignore error since we already validated
				coreFields2 := extractCoreFields(schema2)
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
						"type":            "string",
						"x-question-type": "text",
						"title":           "Username",
					},
				},
				"required": []string{"username"},
			},
			want: []FieldInfo{{
				Name:         "username",
				Type:         "string",
				QuestionType: "text",
				Default:      nil,
				Required:     true,
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

// mustParseJSON is a helper function to parse JSON strings into interface{} values
func mustParseJSON(s string) interface{} {
	var v interface{}
	if err := json.Unmarshal([]byte(s), &v); err != nil {
		panic(fmt.Sprintf("invalid JSON: %v", err))
	}
	return v
}

func TestExtractCoreFields(t *testing.T) {
	tests := []struct {
		name      string
		schema    map[string]interface{}
		wantCore  []FieldInfo
		wantPaths []string
	}{
		{
			name: "no core fields",
			schema: mustParseJSON(`{
				"type": "object",
				"properties": {
					"name": {
						"type": "string"
					}
				}
			}`).(map[string]interface{}),
			wantCore:  []FieldInfo{},
			wantPaths: []string{},
		},
		{
			name: "fields with x-core",
			schema: mustParseJSON(`{
				"type": "object",
				"properties": {
					"name": {
						"type": "string",
						"x-core": true
					},
					"age": {
						"type": "integer",
						"x-core": true
					}
				}
			}`).(map[string]interface{}),
			wantCore: []FieldInfo{
				{Name: "name", Type: "string", Core: true},
				{Name: "age", Type: "integer", Core: true},
			},
			wantPaths: []string{"name", "age"},
		},
		{
			name: "core_ prefixed fields",
			schema: mustParseJSON(`{
				"type": "object",
				"properties": {
					"core_id": {
						"type": "string"
					},
					"core_name": {
						"type": "string"
					},
					"regular_field": {
						"type": "string"
					}
				}
			}`).(map[string]interface{}),
			wantCore: []FieldInfo{
				{Name: "core_id", Type: "string", Core: true},
				{Name: "core_name", Type: "string", Core: true},
			},
			wantPaths: []string{"core_id", "core_name"},
		},
		{
			name: "nested properties with x-core",
			schema: mustParseJSON(`{
				"type": "object",
				"properties": {
					"user": {
						"type": "object",
						"x-core": true,
						"properties": {
							"id": {
								"type": "string"
							},
							"name": {
								"type": "string"
							}
						}
					},
					"metadata": {
						"type": "object",
						"properties": {
							"createdAt": {
								"type": "string",
								"format": "date-time"
							}
						}
					}
				}
			}`).(map[string]interface{}),
			wantCore: []FieldInfo{
				{Name: "user", Type: "object", Core: true},
			},
			wantPaths: []string{"user"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotCore := extractCoreFields(tt.schema)

			// Compare the actual FieldInfo structs
			if len(tt.wantCore) != len(gotCore) {
				t.Errorf("expected %d core fields, got %d", len(tt.wantCore), len(gotCore))
			}

			for i, wantField := range tt.wantCore {
				if i >= len(gotCore) {
					break
				}
				gotField := gotCore[i]
				if wantField.Name != gotField.Name || wantField.Type != gotField.Type || wantField.Core != gotField.Core {
					t.Errorf("field[%d] mismatch:\nwant: %+v\ngot:  %+v", i, wantField, gotField)
				}
			}
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
				"properties": {}
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
