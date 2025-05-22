package appbundle

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
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
	// Initialize the service with test configuration
	tempDir := t.TempDir()
	logger := logger.NewLogger()
	service := NewService(Config{
		BundlePath:   filepath.Join(tempDir, "bundle"),
		VersionsPath: filepath.Join(tempDir, "versions"),
		MaxVersions:  5,
	}, logger)

	// Initialize the service
	err := service.Initialize(context.Background())
	require.NoError(t, err, "Failed to initialize service")

	// First, upload the initial bundle (valid_bundle01.zip)
	bundle01Path := filepath.Join("..", "..", "testdata", "bundles", "valid_bundle01.zip")
	bundle01File, err := os.Open(bundle01Path)
	require.NoError(t, err, "Failed to open bundle01")
	defer bundle01File.Close()

	_, err = service.PushBundle(context.Background(), bundle01File)
	require.NoError(t, err, "Failed to push initial bundle")

	// Get the version number of the first bundle
	versions, err := service.GetVersions(context.Background())
	require.NoError(t, err, "Failed to get versions")
	require.GreaterOrEqual(t, len(versions), 1, "Expected at least one version")
	version1 := strings.TrimSuffix(versions[0], " *") // Remove the " *" if it's the current version

	// Then upload the second bundle (valid_bundle02.zip)
	bundle02Path := filepath.Join("..", "..", "testdata", "bundles", "valid_bundle02.zip")
	bundle02File, err := os.Open(bundle02Path)
	require.NoError(t, err, "Failed to open bundle02")
	defer bundle02File.Close()

	_, err = service.PushBundle(context.Background(), bundle02File)
	require.NoError(t, err, "Failed to push second bundle")

	// Get the version number of the second bundle
	versions, err = service.GetVersions(context.Background())
	require.NoError(t, err, "Failed to get versions")
	require.GreaterOrEqual(t, len(versions), 2, "Expected at least two versions")
	version2 := strings.TrimSuffix(versions[0], " *") // Get the latest version

	// Compare the two versions
	changeLog, err := service.CompareAppInfos(context.Background(), version1, version2)
	require.NoError(t, err, "Failed to compare app infos")

	// Verify that the changes include the addition of the "lastname" field
	foundLastnameAddition := false
	for _, modifiedForm := range changeLog.ModifiedForms {
		for _, addedField := range modifiedForm.AddedFields {
			if addedField.Name == "lastname" {
				foundLastnameAddition = true
				break
			}
		}
		if foundLastnameAddition {
			break
		}
	}

	assert.True(t, foundLastnameAddition, "Expected to find 'lastname' field addition in changes")

	// Verify the ChangeLog structure is as expected
	// Convert version numbers to integers for comparison (e.g., "0001" -> 1, "0002" -> 2)
	version1Num, _ := strconv.Atoi(version1)
	version2Num, _ := strconv.Atoi(version2)
	compareVersionANum, _ := strconv.Atoi(changeLog.CompareVersionA)
	compareVersionBNum, _ := strconv.Atoi(changeLog.CompareVersionB)
	
	assert.Equal(t, version1Num, compareVersionANum, "CompareVersionA should match the first version")
	assert.Equal(t, version2Num, compareVersionBNum, "CompareVersionB should match the second version")
	assert.True(t, changeLog.FormChanges, "Expected form changes between versions")

	// Verify we have exactly one modified form
	assert.Len(t, changeLog.ModifiedForms, 1, "Expected exactly one modified form")
	if len(changeLog.ModifiedForms) > 0 {
		modifiedForm := changeLog.ModifiedForms[0]
		assert.True(t, modifiedForm.SchemaChange, "Expected schema changes in the modified form")
		assert.False(t, modifiedForm.CoreChange, "Did not expect core field changes")
	}
}

func TestPushBundleGeneratesAppInfo(t *testing.T) {
	tests := []struct {
		name       string
		bundlePath string
		assertions func(t *testing.T, appInfo *AppInfo)
	}{
		{
			name:       "valid bundle 01",
			bundlePath: filepath.Join("..", "..", "testdata", "bundles", "valid_bundle01.zip"),
			assertions: func(t *testing.T, appInfo *AppInfo) {
				assert.NotEmpty(t, appInfo.Version, "Version should not be empty")
				assert.NotEmpty(t, appInfo.Forms, "Should have forms")
				assert.Equal(t, 7, len(appInfo.Forms["test_form"].Fields), "Should have 7 fields")
			},
		},
		{
			name:       "valid bundle 02",
			bundlePath: filepath.Join("..", "..", "testdata", "bundles", "valid_bundle02.zip"),
			assertions: func(t *testing.T, appInfo *AppInfo) {
				assert.NotEmpty(t, appInfo.Version, "Version should not be empty")
				assert.NotEmpty(t, appInfo.Forms, "Should have forms")
				assert.Equal(t, 8, len(appInfo.Forms["test_form"].Fields), "Should have 8 fields")
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create a temporary directory for testing
			tempDir := t.TempDir()

			// Initialize the service with test configuration
			config := Config{
				BundlePath:   filepath.Join(tempDir, "bundle"),
				VersionsPath: filepath.Join(tempDir, "versions"),
				MaxVersions:  5,
			}

			service := NewService(config, logger.NewLogger())

			// Initialize the service
			err := service.Initialize(context.Background())
			require.NoError(t, err, "Failed to initialize service")

			// Open the test bundle
			bundleFile, err := os.Open(tc.bundlePath)
			require.NoError(t, err, "Failed to open test bundle")
			defer bundleFile.Close()

			// Push the bundle
			_, err = service.PushBundle(context.Background(), bundleFile)
			require.NoError(t, err, "Failed to push bundle")

			// Get the app info for the pushed bundle
			versions, err := service.GetVersions(context.Background())
			require.NoError(t, err, "Failed to get versions")
			require.NotEmpty(t, versions, "Expected at least one version")

			version := versions[0]
			// Remove the " *" suffix if present (indicates current version)
			version = strings.TrimSuffix(version, " *")

			appInfo, err := service.GetAppInfo(context.Background(), version)
			require.NoError(t, err, "Failed to get app info")

			// Run test-specific assertions
			tc.assertions(t, appInfo)

			// Common assertions
			assert.NotEmpty(t, appInfo.Version, "App version should not be empty")
			assert.NotEmpty(t, appInfo.Timestamp, "Timestamp should be set")

			// Log the generated app info for debugging
			t.Logf("Generated app info: %+v", appInfo)

			// Verify the APP_INFO.json file exists in the version directory
			appInfoPath := filepath.Join(config.VersionsPath, version, "APP_INFO.json")
			_, err = os.Stat(appInfoPath)
			assert.NoError(t, err, "APP_INFO.json should exist in the version directory")
		})
	}
}
