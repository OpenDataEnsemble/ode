package appbundle

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/opendataensemble/synkronus/pkg/logger"
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

func TestBundleChanges_FieldAddition(t *testing.T) {
	tempDir := t.TempDir()
	service := NewService(Config{
		BundlePath:   filepath.Join(tempDir, "bundle"),
		VersionsPath: filepath.Join(tempDir, "versions"),
		MaxVersions:  5,
	}, logger.NewLogger())

	require.NoError(t, service.Initialize(context.Background()))

	bundle1 := createAppInfoFixtureBundle(t, false)

	_, err := service.PushBundle(context.Background(), bundle1)
	require.NoError(t, err)

	versions, err := service.GetVersions(context.Background())
	require.NoError(t, err)
	require.Contains(t, versions, "0001")

	require.NoError(t, service.SwitchVersion(context.Background(), "0001"))

	manifest, err := service.GetManifest(context.Background())
	require.NoError(t, err)
	require.Equal(t, "0001", manifest.Version)

	bundle2 := createAppInfoFixtureBundle(t, true)

	_, err = service.PushBundle(context.Background(), bundle2)
	require.NoError(t, err)

	manifest, err = service.GetManifest(context.Background())
	require.NoError(t, err)
	require.Equal(t, "0001", manifest.Version)
	require.False(t, slices.ContainsFunc(manifest.Files, func(file File) bool {
		return file.Path == "app/THIS_IS_VERSION_2.txt"
	}))

	_, _, err = service.GetFile(context.Background(), "app/THIS_IS_VERSION_2.txt")
	require.Error(t, err)

	versions, err = service.GetVersions(context.Background())
	require.NoError(t, err)
	require.Contains(t, versions, "0001 *")
	require.Contains(t, versions, "0002")

	require.NoError(t, service.SwitchVersion(context.Background(), "0002"))

	manifest, err = service.GetManifest(context.Background())
	require.NoError(t, err)
	require.Equal(t, "0002", manifest.Version)
	require.True(t, slices.ContainsFunc(manifest.Files, func(file File) bool {
		return file.Path == "app/THIS_IS_VERSION_2.txt"
	}))

	marker, _, err := service.GetFile(context.Background(), "app/THIS_IS_VERSION_2.txt")
	require.NoError(t, err)
	defer marker.Close()

	content, err := io.ReadAll(marker)
	require.NoError(t, err)
	require.Equal(t, "Something...", string(content))

	changeLog, err := service.CompareAppInfos(context.Background(), "0001", "0002")
	require.NoError(t, err)

	version1, err := strconv.Atoi(changeLog.CompareVersionA)
	require.NoError(t, err)

	version2, err := strconv.Atoi(changeLog.CompareVersionB)
	require.NoError(t, err)

	assert.Equal(t, 1, version1)
	assert.Equal(t, 2, version2)
	assert.True(t, changeLog.FormChanges)
	require.Len(t, changeLog.ModifiedForms, 1)

	modifiedForm := changeLog.ModifiedForms[0]
	assert.True(t, modifiedForm.SchemaChange)
	assert.False(t, modifiedForm.CoreChange)
	assert.True(t, slices.ContainsFunc(modifiedForm.AddedFields, func(field FieldChange) bool {
		return field.Name == "lastname"
	}), "expected lastname field addition")
}

func TestPushBundleGeneratesAppInfo(t *testing.T) {
	tests := []struct {
		name       string
		versionTwo bool
		fieldCount int
	}{
		{
			name:       "valid bundle 01",
			versionTwo: false,
			fieldCount: 7,
		},
		{
			name:       "valid bundle 02",
			versionTwo: true,
			fieldCount: 8,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			tempDir := t.TempDir()
			config := Config{
				BundlePath:   filepath.Join(tempDir, "bundle"),
				VersionsPath: filepath.Join(tempDir, "versions"),
				MaxVersions:  5,
			}

			service := NewService(config, logger.NewLogger())
			require.NoError(t, service.Initialize(context.Background()))

			bundle := createAppInfoFixtureBundle(t, test.versionTwo)

			_, err := service.PushBundle(context.Background(), bundle)
			require.NoError(t, err)

			versions, err := service.GetVersions(context.Background())
			require.NoError(t, err)
			require.NotEmpty(t, versions)

			version := strings.TrimSuffix(versions[0], " *")
			appInfo, err := service.GetAppInfo(context.Background(), version)
			require.NoError(t, err)

			exampleForm, exists := appInfo.Forms["example"]
			require.True(t, exists)

			assert.Len(t, exampleForm.Fields, test.fieldCount)
			assert.NotEmpty(t, appInfo.Version)
			assert.NotEmpty(t, appInfo.Timestamp)

			appInfoPath := filepath.Join(config.VersionsPath, version, "APP_INFO.json")
			_, err = os.Stat(appInfoPath)
			assert.NoError(t, err)
		})
	}
}
