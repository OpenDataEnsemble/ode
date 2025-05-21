package appbundle

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestBundleWithTestData tests validation with the full test data directory
func TestBundleWithTestData(t *testing.T) {
	testDataDir := filepath.Join("..", "..", "testdata")

	// Create a test bundle from the testdata directory
	bundlePath, err := createTestBundleFromDir(t, testDataDir)
	require.NoError(t, err, "Failed to create test bundle")
	defer cleanupTestBundle(t, bundlePath)

	// Open the zip file
	zipFile, err := zip.OpenReader(bundlePath)
	require.NoError(t, err, "Failed to open test bundle")
	defer zipFile.Close()

	service := &Service{
		bundlePath:   t.TempDir(),
		versionsPath: t.TempDir(),
		maxVersions:  5,
	}

	t.Run("ValidateBundleStructure", func(t *testing.T) {
		err := service.validateBundleStructure(&zipFile.Reader)
		require.NoError(t, err, "Bundle structure validation failed")
	})

	t.Run("ValidateFormCellReferences", func(t *testing.T) {
		err := service.validateFormCellReferences(&zipFile.Reader)
		require.NoError(t, err, "Form cell references validation failed")
	})
}

// TestBundleWithoutCells tests that a bundle without a cells directory is valid
func TestBundleWithoutCells(t *testing.T) {
	service := &Service{
		bundlePath:   t.TempDir(),
		versionsPath: t.TempDir(),
		maxVersions:  5,
	}

	// Create a bundle with app and forms but no cells
	bundlePath, err := createTestBundle(t, true, true, false)
	require.NoError(t, err, "Failed to create test bundle")
	defer cleanupTestBundle(t, bundlePath)

	// Open the zip file
	zipFile, err := zip.OpenReader(bundlePath)
	require.NoError(t, err, "Failed to open test bundle")
	defer zipFile.Close()

	t.Run("ValidateBundleStructure", func(t *testing.T) {
		err := service.validateBundleStructure(&zipFile.Reader)
		require.NoError(t, err, "Bundle without cells should be valid")
	})
}

// TestInvalidBundles tests various invalid bundle scenarios
func TestInvalidBundles(t *testing.T) {
	tests := []struct {
		name          string
		includeApp    bool
		includeForms  bool
		expectedError error
	}{
		{
			name:          "MissingApp",
			includeApp:    false,
			includeForms:  true,
			expectedError: ErrMissingAppIndex,
		},
		{
			name:          "MissingForms",
			includeApp:    true,
			includeForms:  false,
			expectedError: nil, // Forms are optional
		},
		{
			name:          "EmptyBundle",
			includeApp:    false,
			includeForms:  false,
			expectedError: ErrMissingAppIndex,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			service := &Service{
				bundlePath:   t.TempDir(),
				versionsPath: t.TempDir(),
				maxVersions:  5,
			}

			bundlePath, err := createTestBundle(t, tc.includeApp, tc.includeForms, false)
			require.NoError(t, err, "Failed to create test bundle")
			defer cleanupTestBundle(t, bundlePath)

			zipFile, err := zip.OpenReader(bundlePath)
			require.NoError(t, err, "Failed to open test bundle")
			defer zipFile.Close()

			err = service.validateBundleStructure(&zipFile.Reader)
			if tc.expectedError != nil {
				require.ErrorIs(t, err, tc.expectedError, "Expected error not returned")
			} else {
				require.NoError(t, err, "Unexpected error during validation")
			}
		})
	}
}

// createFormSchema creates a form schema with the given fields
func createFormSchema(fields map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": fields,
	}
}

// createTestFormBundle creates a test bundle with the specified form schemas
func createTestFormBundle(t *testing.T, forms map[string]map[string]interface{}) (string, error) {
	t.Helper()

	tmpFile, err := os.CreateTemp("", "test-bundle-*.zip")
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %v", err)
	}

	w := zip.NewWriter(tmpFile)

	// Add required directories
	for _, dir := range []string{"app/", "forms/"} {
		if _, err := w.Create(dir); err != nil {
			w.Close()
			tmpFile.Close()
			os.Remove(tmpFile.Name())
			return "", fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	// Add app/index.html
	fw, err := w.Create("app/index.html")
	if err != nil {
		w.Close()
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("failed to create app/index.html: %w", err)
	}
	fw.Write([]byte("<html><body>Test App</body></html>"))

	// Add forms
	for formName, schema := range forms {
		// Create form directory
		formDir := fmt.Sprintf("forms/%s/", formName)
		if _, err := w.Create(formDir); err != nil {
			w.Close()
			tmpFile.Close()
			os.Remove(tmpFile.Name())
			return "", fmt.Errorf("failed to create form directory: %w", err)
		}

		// Add schema.json
		schemaData, err := json.Marshal(schema)
		if err != nil {
			w.Close()
			tmpFile.Close()
			os.Remove(tmpFile.Name())
			return "", fmt.Errorf("failed to marshal schema: %w", err)
		}

		schemaPath := fmt.Sprintf("forms/%s/schema.json", formName)
		fw, err := w.Create(schemaPath)
		if err != nil {
			w.Close()
			tmpFile.Close()
			os.Remove(tmpFile.Name())
			return "", fmt.Errorf("failed to create schema.json: %w", err)
		}
		fw.Write(schemaData)

		// Add minimal ui.json
		uiPath := fmt.Sprintf("forms/%s/ui.json", formName)
		fw, err = w.Create(uiPath)
		if err != nil {
			w.Close()
			tmpFile.Close()
			os.Remove(tmpFile.Name())
			return "", fmt.Errorf("failed to create ui.json: %w", err)
		}
		fw.Write([]byte(`{"ui:order":[]}`))
	}

	if err := w.Close(); err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("failed to close zip writer: %w", err)
	}

	if err := tmpFile.Close(); err != nil {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("failed to close temp file: %w", err)
	}

	return tmpFile.Name(), nil
}

// TestFormVersionChanges tests validation of form version changes
func TestFormVersionChanges(t *testing.T) {
	service := &Service{
		bundlePath:   t.TempDir(),
		versionsPath: t.TempDir(),
		maxVersions:  5,
	}

	// Initial bundle with one form
	bundle1, err := createTestFormBundle(t, map[string]map[string]interface{}{
		"user": createFormSchema(map[string]interface{}{
			"name": map[string]interface{}{
				"type": "string",
			},
		}),
	})
	require.NoError(t, err, "Failed to create initial test bundle")
	defer cleanupTestBundle(t, bundle1)

	// Process the first version
	zip1, err := zip.OpenReader(bundle1)
	require.NoError(t, err)
	defer zip1.Close()

	// Validate first version
	err = service.validateBundleStructure(&zip1.Reader)
	require.NoError(t, err, "Initial bundle validation failed")

	// Create a second version with an added field
	bundle2, err := createTestFormBundle(t, map[string]map[string]interface{}{
		"user": createFormSchema(map[string]interface{}{
			"name": map[string]interface{}{
				"type": "string",
			},
			"email": map[string]interface{}{
				"type": "string",
				"format": "email",
			},
		}),
	})
	require.NoError(t, err, "Failed to create second test bundle")
	defer cleanupTestBundle(t, bundle2)

	// Process the second version
	zip2, err := zip.OpenReader(bundle2)
	require.NoError(t, err)
	defer zip2.Close()

	t.Run("ValidateFieldAddition", func(t *testing.T) {
		err = service.validateBundleStructure(&zip2.Reader)
		require.NoError(t, err, "Adding a field should be allowed")
	})

	// Create a third version with a removed field
	bundle3, err := createTestFormBundle(t, map[string]map[string]interface{}{
		"user": createFormSchema(map[string]interface{}{
			// name field is removed
			"email": map[string]interface{}{
				"type": "string",
				"format": "email",
			},
		}),
	})
	require.NoError(t, err, "Failed to create third test bundle")
	defer cleanupTestBundle(t, bundle3)

	// Process the third version
	zip3, err := zip.OpenReader(bundle3)
	require.NoError(t, err)
	defer zip3.Close()

	t.Run("ValidateFieldRemoval", func(t *testing.T) {
		err = service.validateBundleStructure(&zip3.Reader)
		require.NoError(t, err, "Removing a field should be allowed")
	})

	// Create a fourth version with a new form
	bundle4, err := createTestFormBundle(t, map[string]map[string]interface{}{
		"user": createFormSchema(map[string]interface{}{
			"email": map[string]interface{}{
				"type": "string",
				"format": "email",
			},
		}),
		"profile": createFormSchema(map[string]interface{}{
			"bio": map[string]interface{}{
				"type": "string",
			},
		}),
	})
	require.NoError(t, err, "Failed to create fourth test bundle")
	defer cleanupTestBundle(t, bundle4)

	// Process the fourth version
	zip4, err := zip.OpenReader(bundle4)
	require.NoError(t, err)
	defer zip4.Close()

	t.Run("ValidateNewForm", func(t *testing.T) {
		err = service.validateBundleStructure(&zip4.Reader)
		require.NoError(t, err, "Adding a new form should be allowed")
	})
}

// createFormWithCellReference creates a form schema that references a cell
func createFormWithCellReference(cellName string) map[string]interface{} {
	return map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"field1": map[string]interface{}{
				"type": "string",
				"x-cell": cellName,
			},
		},
	}
}

// TestMissingCellReferences tests validation of forms with missing cell references
func TestMissingCellReferences(t *testing.T) {
	service := &Service{
		bundlePath:   t.TempDir(),
		versionsPath: t.TempDir(),
		maxVersions:  5,
	}

	t.Run("BuiltInCellReference", func(t *testing.T) {
		// Create a bundle with a form that references a built-in cell
		bundle, err := createTestFormBundle(t, map[string]map[string]interface{}{
			"user": createFormWithCellReference("builtin-text"),
		})
		require.NoError(t, err, "Failed to create test bundle")
		defer cleanupTestBundle(t, bundle)

		zipFile, err := zip.OpenReader(bundle)
		require.NoError(t, err)
		defer zipFile.Close()

		err = service.validateFormCellReferences(&zipFile.Reader)
		require.NoError(t, err, "Built-in cell reference should be valid")
	})

	t.Run("MissingCustomCellReference", func(t *testing.T) {
		// Create a bundle with a form that references a non-existent custom cell
		bundle, err := createTestFormBundle(t, map[string]map[string]interface{}{
			"user": createFormWithCellReference("custom-cell"),
		})
		require.NoError(t, err, "Failed to create test bundle")
		defer cleanupTestBundle(t, bundle)

		zipFile, err := zip.OpenReader(bundle)
		require.NoError(t, err)
		defer zipFile.Close()

		err = service.validateFormCellReferences(&zipFile.Reader)
		require.Error(t, err, "Should fail with missing cell reference")
		require.Contains(t, err.Error(), "references non-existent cell", "Error should mention missing cell")
	})

	t.Run("ValidCustomCellReference", func(t *testing.T) {
		// Create a temporary file for the zip
		tmpFile, err := os.CreateTemp("", "test-bundle-*.zip")
		require.NoError(t, err, "Failed to create temp file")
		defer os.Remove(tmpFile.Name())

		w := zip.NewWriter(tmpFile)

		// Add required directories
		for _, dir := range []string{"app/", "forms/", "cells/custom-cell/"} {
			_, err := w.Create(dir)
			require.NoError(t, err, "Failed to create directory")
		}

		// Add app/index.html
		fw, err := w.Create("app/index.html")
		require.NoError(t, err, "Failed to create app/index.html")
		fw.Write([]byte("<html><body>Test App</body></html>"))

		// Add form with cell reference
		formSchema := createFormWithCellReference("custom-cell")
		schemaData, err := json.Marshal(formSchema)
		require.NoError(t, err, "Failed to marshal form schema")

		fw, err = w.Create("forms/user/schema.json")
		require.NoError(t, err, "Failed to create form schema")
		fw.Write(schemaData)

		// Add minimal ui.json
		fw, err = w.Create("forms/user/ui.json")
		require.NoError(t, err, "Failed to create UI schema")
		fw.Write([]byte(`{"ui:order":[]}`))

		// Add cell implementation
		fw, err = w.Create("cells/custom-cell/cell.jsx")
		require.NoError(t, err, "Failed to create cell implementation")
		fw.Write([]byte("export default function CustomCell() { return null; }"))

		require.NoError(t, w.Close(), "Failed to close zip writer")
		require.NoError(t, tmpFile.Close(), "Failed to close temp file")

		// Reopen for reading
		zipFile, err := zip.OpenReader(tmpFile.Name())
		require.NoError(t, err, "Failed to open test bundle")
		defer zipFile.Close()

		err = service.validateFormCellReferences(&zipFile.Reader)
		require.NoError(t, err, "Valid custom cell reference should pass validation")
	})
}

// TestCoreFieldsValidation tests validation of core fields in forms
func TestCoreFieldsValidation(t *testing.T) {
	service := &Service{
		bundlePath:   t.TempDir(),
		versionsPath: t.TempDir(),
		maxVersions:  5,
	}

	t.Run("CoreFieldModification", func(t *testing.T) {
		// Create a new service for this test case to avoid cache pollution
		service = &Service{
			bundlePath:   t.TempDir(),
			versionsPath: t.TempDir(),
			maxVersions:  5,
		}
		// Initial bundle with a form containing core fields
		bundle1, err := createTestFormBundle(t, map[string]map[string]interface{}{
			"user": {
				"type": "object",
				"x-core": true,
				"properties": map[string]interface{}{
					"id": map[string]interface{}{
						"type": "string",
					},
				},
			},
		})
		require.NoError(t, err, "Failed to create initial bundle")
		defer cleanupTestBundle(t, bundle1)

		// Process the first version to extract and store core field hashes
		zip1, err := zip.OpenReader(bundle1)
		require.NoError(t, err)
		defer zip1.Close()

		// Generate app info to store core field hashes
		_, err = service.generateAppInfo(&zip1.Reader, "1.0.0")
		require.NoError(t, err, "Failed to generate app info")

		// Verify the core field hash was stored
		hash, exists := service.getCoreFieldsHash("user")
		require.True(t, exists, "Core field hash should be stored")
		require.NotEmpty(t, hash, "Core field hash should not be empty")

		// Create a second version that modifies a core field
		bundle2, err := createTestFormBundle(t, map[string]map[string]interface{}{
			"user": {
				"type": "object",
				"x-core": true,
				"properties": map[string]interface{}{
					"id": map[string]interface{}{
						"type": "number", // Changed from string to number
					},
				},
			},
		})
		require.NoError(t, err, "Failed to create second bundle")
		defer cleanupTestBundle(t, bundle2)


		// Process the second version
		zip2, err := zip.OpenReader(bundle2)
		require.NoError(t, err)
		defer zip2.Close()

		err = service.validateBundleStructure(&zip2.Reader)
		require.Error(t, err, "Should fail when modifying core field type")
		require.Contains(t, err.Error(), "core field", "Error should mention core field")
	})

	t.Run("NonCoreFieldModification", func(t *testing.T) {
		// Create a new service for this test case to avoid cache pollution
		service = &Service{
			bundlePath:   t.TempDir(),
			versionsPath: t.TempDir(),
			maxVersions:  5,
		}

		// Create a bundle with a non-core form
		bundle, err := createTestFormBundle(t, map[string]map[string]interface{}{
			"user": {
				"type": "object",
				"properties": map[string]interface{}{
					"name": map[string]interface{}{
						"type": "string",
					},
				},
			},
		})
		require.NoError(t, err, "Failed to create test bundle")
		defer cleanupTestBundle(t, bundle)

		zipFile, err := zip.OpenReader(bundle)
		require.NoError(t, err)
		defer zipFile.Close()

		err = service.validateBundleStructure(&zipFile.Reader)
		require.NoError(t, err, "Non-core form validation should pass")
	})
}
