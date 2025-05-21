package appbundle

import (
	"archive/zip"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBundleWithTestData(t *testing.T) {
	// Get the path to the testdata directory
	testDataDir := filepath.Join("..", "..", "testdata")

	// Create a test bundle from the testdata directory
	bundlePath, err := createTestBundleFromDir(t, testDataDir)
	require.NoError(t, err, "Failed to create test bundle")
	defer cleanupTestBundle(t, bundlePath)

	// Open the zip file
	zipFile, err := zip.OpenReader(bundlePath)
	require.NoError(t, err, "Failed to open test bundle")
	defer zipFile.Close()

	// Create a test service
	service := &Service{
		bundlePath:   t.TempDir(),
		versionsPath: t.TempDir(),
		maxVersions:  5,
	}

	// Test bundle structure validation
	t.Run("ValidateBundleStructure", func(t *testing.T) {
		err := service.validateBundleStructure(&zipFile.Reader)
		require.NoError(t, err, "Bundle structure validation failed")
	})

	// Test form cell references
	t.Run("ValidateFormCellReferences", func(t *testing.T) {
		err := service.validateFormCellReferences(&zipFile.Reader)
		require.NoError(t, err, "Form cell references validation failed")
	})

	// Test individual form validation
	for _, file := range zipFile.File {
		if strings.HasSuffix(file.Name, "/schema.json") {
			t.Run("ValidateForm_"+filepath.Base(filepath.Dir(file.Name)), func(t *testing.T) {
				err := service.validateFormFile(file)
				require.NoError(t, err, "Form validation failed for %s", file.Name)
			})
		}
	}
}
