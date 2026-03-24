package appbundle

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// createAppInfoTestZip creates an in-memory zip file with the given files for testing app info generation
func createAppInfoTestZip(t *testing.T, files map[string]string) *zip.Reader {
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	for name, content := range files {
		w, err := zipWriter.Create(name)
		require.NoError(t, err)
		_, err = w.Write([]byte(content))
		require.NoError(t, err)
	}

	err := zipWriter.Close()
	require.NoError(t, err)

	zipReader, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	require.NoError(t, err)

	return zipReader
}

func TestGenerateAppInfo(t *testing.T) {
	tests := []struct {
		name        string
		version     string
		files       map[string]string
		setup       func(*testing.T, *Service)
		expectError bool
		validate    func(*testing.T, *AppInfo, *Service)
	}{
		{
			name:    "empty zip file",
			version: "1.0.0",
			files:   map[string]string{},
			validate: func(t *testing.T, info *AppInfo, s *Service) {
				assert.Equal(t, "1.0.0", info.Version)
				assert.Empty(t, info.Forms)
			},
		},
		{
			name:    "single form with schema only",
			version: "1.2.3",
			files: map[string]string{
				"forms/test_form/schema.json": `{
					"type": "object",
					"properties": {
						"name": {
							"type": "string",
							"x-question-type": "text"
						}
					}
				}`,
			},
			validate: func(t *testing.T, info *AppInfo, s *Service) {
				assert.Len(t, info.Forms, 1)
				formInfo, exists := info.Forms["test_form"]
				require.True(t, exists)
				require.NotEmpty(t, formInfo.FormHash)
				assert.Empty(t, formInfo.UIHash) // No UI schema provided
				assert.Len(t, formInfo.Fields, 1)
				assert.Equal(t, "name", formInfo.Fields[0].Name)
				assert.Equal(t, "string", formInfo.Fields[0].Type)
				assert.Equal(t, "text", formInfo.Fields[0].QuestionType)
			},
		},
		{
			name:    "form with core fields",
			version: "2.0.0",
			files: map[string]string{
				"forms/test_form/schema.json": `{
					"type": "object",
					"properties": {
						"core_id": {
							"type": "string"
						},
						"core_field": {
							"type": "string",
							"x-core": true
						},
						"regular_field": {
							"type": "string"
						}
					}
				}`,
			},
			validate: func(t *testing.T, info *AppInfo, s *Service) {
				formInfo, exists := info.Forms["test_form"]
				require.True(t, exists)

				// Should have core fields
				coreHash, exists := s.getCoreFieldsHash("test_form")
				assert.True(t, exists)
				assert.NotEmpty(t, coreHash)
				assert.Equal(t, coreHash, formInfo.CoreHash)
			},
		},
		{
			name:    "form with UI schema and renderers",
			version: "3.0.0",
			files: map[string]string{
				"forms/test_form/schema.json":        `{"type":"object","properties":{"name":{"type":"string"}}}`,
				"forms/test_form/ui.json":            `{"type":"Control","scope":"#/properties/name","options":{"format":"customField"}}`,
				"renderers/customField/renderer.jsx": "// Custom renderer component",
			},
			validate: func(t *testing.T, info *AppInfo, s *Service) {
				formInfo, exists := info.Forms["test_form"]
				require.True(t, exists)
				require.NotEmpty(t, formInfo.UIHash)
				assert.Contains(t, formInfo.QuestionTypes, "customField")
			},
		},
		{
			name:    "multiple forms",
			version: "4.0.0",
			files: map[string]string{
				"forms/form1/schema.json": `{"type":"object","properties":{"field1":{"type":"string"}}}`,
				"forms/form2/schema.json": `{"type":"object","properties":{"field2":{"type":"number"}}}`,
			},
			validate: func(t *testing.T, info *AppInfo, s *Service) {
				assert.Len(t, info.Forms, 2)
				assert.Contains(t, info.Forms, "form1")
				assert.Contains(t, info.Forms, "form2")
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Setup service
			service := &Service{
				coreFieldHashes: make(map[string]string),
				coreFieldMutex:  sync.RWMutex{},
			}

			// Create test zip
			zipReader := createAppInfoTestZip(t, tc.files)

			// Call the method under test
			result, err := service.generateAppInfo(zipReader, tc.version)

			// Validate results
			if tc.expectError {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result)

				// Parse the result back to AppInfo
				var appInfo AppInfo
				err = json.Unmarshal(result, &appInfo)
				require.NoError(t, err)

				// Run custom validations
				if tc.validate != nil {
					tc.validate(t, &appInfo, service)
				}
			}
		})
	}
}

func TestGenerateAppInfo_ErrorCases(t *testing.T) {
	tests := []struct {
		name    string
		files   map[string]string
		wantErr string
	}{
		{
			name: "invalid JSON in schema",
			files: map[string]string{
				"forms/test_form/schema.json": "{invalid-json",
			},
			wantErr: "invalid JSON in form schema",
		},
		{
			name: "invalid JSON in UI schema",
			files: map[string]string{
				"forms/test_form/schema.json": "{}",
				"forms/test_form/ui.json":     "{invalid-json",
			},
			wantErr: "failed to parse UI schema",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			service := &Service{
				coreFieldHashes: make(map[string]string),
				coreFieldMutex:  sync.RWMutex{},
			}

			zipReader := createAppInfoTestZip(t, tc.files)
			_, err := service.generateAppInfo(zipReader, "1.0.0")

			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.wantErr)
		})
	}
}
