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
				"app/index.html": "<html></html>",
				"forms/user/schema.json": `{"core_id": "user", "fields": []}`,
				"forms/user/ui.json": "{}",
				"cells/button/cell.jsx": "export default function Button() {}",
			},
			wantErr: false,
		},
		{
			name: "missing app/index.html",
			files: map[string]string{
				"forms/user/schema.json": "{}",
				"cells/button/cell.jsx": "",
			},
			wantErr: true,
			err:     ErrMissingAppIndex,
		},
		{
			name: "invalid top-level directory",
			files: map[string]string{
				"app/index.html": "<html></html>",
				"invalid-dir/file.txt": "should not be here",
			},
			wantErr: true,
			err:     ErrInvalidStructure,
		},
		{
			name: "invalid form structure - missing schema.json",
			files: map[string]string{
				"app/index.html": "<html></html>",
				"forms/user/ui.json": "{}", // Missing schema.json
			},
			wantErr: true,
			err:     ErrInvalidFormStructure,
		},
		{
			name: "invalid cell structure - wrong extension",
			files: map[string]string{
				"app/index.html": "<html></html>",
				"cells/button/cell.js": "should be .jsx",
			},
			wantErr: true,
			err:     ErrInvalidCellStructure,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a test zip file
			zipData, err := createTestZip(t, tt.files)
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

			// Test the validation
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
			// Create a test zip file
			zipData, err := createTestZip(t, tt.files)
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

			// Test the validation
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
		name        string
		schema     string
		hasCoreFields bool
		shouldError bool
	}{
		{
			name: "no core fields",
			schema: `{
				"fields": [
					{"name": "regularField", "type": "string"}
				]
			}`,
			hasCoreFields: false,
			shouldError: false,
		},
		{
			name: "with core fields",
			schema: `{
				"core_id": "test",
				"core_version": 1,
				"fields": []
			}`,
			hasCoreFields: true,
			shouldError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var schema map[string]interface{}
			err := json.Unmarshal([]byte(tt.schema), &schema)
			require.NoError(t, err, "failed to unmarshal test schema")

			coreFields := extractCoreFields(schema)
			if tt.hasCoreFields {
				assert.NotEmpty(t, coreFields, "expected core fields but found none")
			} else {
				assert.Empty(t, coreFields, "expected no core fields but found some")
			}

			// Test core field hashing
			if tt.hasCoreFields {
				hash1 := hashCoreFields(coreFields)
				assert.NotEmpty(t, hash1, "hash should not be empty")

				// Hash should be deterministic
				coreFields2 := extractCoreFields(schema)
				hash2 := hashCoreFields(coreFields2)
				assert.Equal(t, hash1, hash2, "hashes should be equal for same input")
			}
		})
	}
}

func TestValidateFormSchema(t *testing.T) {
	tests := []struct {
		name    string
		schema string
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
			schema: `{invalid: json}`,
			isValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a test zip file with the schema
			files := map[string]string{
				"app/index.html": "<html></html>",
				"forms/test/schema.json": tt.schema,
				"forms/test/ui.json": "{}",
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
