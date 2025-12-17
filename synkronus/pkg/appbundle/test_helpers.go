package appbundle

import (
	"archive/zip"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// createTestBundleFromDir creates a zip bundle from a directory structure for testing
func createTestBundleFromDir(t *testing.T, srcDir string) (string, error) {
	t.Helper()

	// Create a temporary file for the zip
	tmpFile, err := os.CreateTemp("", "test-bundle-*.zip")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer tmpFile.Close()

	// Create a new zip writer
	w := zip.NewWriter(tmpFile)

	// Create required top-level directories
	for _, dir := range []string{"app/", "forms/", "renderers/"} {
		if _, err := w.Create(dir); err != nil {
			return "", fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	// Make sure we have the required app/index.html
	appIndexPath := filepath.Join(srcDir, "app", "index.html")
	if _, err := os.Stat(appIndexPath); err == nil {
		// Read the app/index.html file
		data, err := os.ReadFile(appIndexPath)
		if err != nil {
			return "", fmt.Errorf("failed to read app/index.html: %w", err)
		}

		// Create the app directory in the zip if it doesn't exist
		if _, err := w.Create("app/"); err != nil {
			return "", fmt.Errorf("failed to create app/ directory: %w", err)
		}

		// Add the index.html file to the zip
		fw, err := w.Create("app/index.html")
		if err != nil {
			return "", fmt.Errorf("failed to create app/index.html in zip: %w", err)
		}

		if _, err := fw.Write(data); err != nil {
			return "", fmt.Errorf("failed to write app/index.html to zip: %w", err)
		}
	}

	// Walk the source directory and add files to the zip
	err = filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories and app/index.html (already added)
		if info.IsDir() || (strings.HasSuffix(path, "app/index.html") && !strings.Contains(path, "testdata")) {
			return nil
		}

		// Calculate the relative path within the srcDir
		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}

		// Skip data.json files (test data, not part of bundle structure)
		if strings.HasSuffix(relPath, "data.json") {
			return nil
		}

		// Determine the target path in the zip based on the source directory
		var zipPath string
		switch {
		case strings.HasPrefix(relPath, "app/") && !strings.HasSuffix(relPath, "index.html"):
			// Other files from testdata/app/ go to app/ in the zip
			zipPath = relPath
		case strings.HasPrefix(relPath, "forms/"):
			// Files from testdata/forms/ go to forms/ in the zip
			zipPath = relPath
			// Rename uischema.json to ui.json to match validation expectations
			if strings.HasSuffix(zipPath, "uischema.json") {
				zipPath = strings.TrimSuffix(zipPath, "uischema.json") + "ui.json"
			}
		case strings.HasPrefix(relPath, "renderers/"):
			// Files from testdata/renderers/ go to renderers/ in the zip
			zipPath = relPath
		default:
			// Skip files not in the expected directories
			return nil
		}

		// Create parent directories in the zip if they don't exist
		if dir := filepath.Dir(zipPath); dir != "." {
			if _, err := w.Create(dir + "/"); err != nil {
				return err
			}
		}

		// Create a new file in the zip
		zipFile, err := w.Create(zipPath)
		if err != nil {
			return err
		}

		// Read the source file
		fileData, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		// Write the file data to the zip
		_, err = zipFile.Write(fileData)
		return err
	})

	if err != nil {
		t.Fatalf("Failed to walk directory: %v", err)
	}

	// Close the zip writer
	if err := w.Close(); err != nil {
		t.Fatalf("Failed to close zip writer: %v", err)
	}

	return tmpFile.Name(), nil
}

// createTestBundle creates a test bundle with the specified directories
func createTestBundle(t *testing.T, includeApp, includeForms, includeCells bool) (string, error) {
	t.Helper()

	// Create a temporary file for the zip
	tmpFile, err := os.CreateTemp("", "test-bundle-*.zip")
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %v", err)
	}

	// Create a new zip writer
	w := zip.NewWriter(tmpFile)

	// Add required files based on parameters
	if includeApp {
		// Add app/index.html
		fw, err := w.Create("app/index.html")
		if err != nil {
			tmpFile.Close()
			os.Remove(tmpFile.Name())
			return "", fmt.Errorf("failed to create app/index.html: %w", err)
		}
		_, err = fw.Write([]byte("<html><body>Test App</body></html>"))
		if err != nil {
			w.Close()
			tmpFile.Close()
			os.Remove(tmpFile.Name())
			return "", fmt.Errorf("failed to write app/index.html: %w", err)
		}

		// Create required directories
		dirs := []string{}
		if includeForms {
			dirs = append(dirs, "forms/")
		}
		if includeCells {
			dirs = append(dirs, "renderers/")
		}
		dirs = append(dirs, "app/")

		for _, dir := range dirs {
			if _, err := w.Create(dir); err != nil {
				w.Close()
				tmpFile.Close()
				os.Remove(tmpFile.Name())
				return "", fmt.Errorf("failed to create directory %s: %w", dir, err)
			}
		}

		// Add a sample form if needed
		if includeForms {
			fw, err := w.Create("forms/sample/schema.json")
			if err != nil {
				w.Close()
				tmpFile.Close()
				os.Remove(tmpFile.Name())
				return "", fmt.Errorf("failed to create sample form: %w", err)
			}
			_, err = fw.Write([]byte(`{"type":"object","properties":{"name":{"type":"string"}}}`))
			if err != nil {
				w.Close()
				tmpFile.Close()
				os.Remove(tmpFile.Name())
				return "", fmt.Errorf("failed to write sample form: %w", err)
			}

			fw, err = w.Create("forms/sample/ui.json")
			if err != nil {
				w.Close()
				tmpFile.Close()
				os.Remove(tmpFile.Name())
				return "", fmt.Errorf("failed to create sample UI: %w", err)
			}
			_, err = fw.Write([]byte(`{"ui:order":["name"]}`))
			if err != nil {
				w.Close()
				tmpFile.Close()
				os.Remove(tmpFile.Name())
				return "", fmt.Errorf("failed to write sample UI: %w", err)
			}
		}

		// Add a sample renderer if needed
		if includeCells {
			fw, err := w.Create("renderers/sample/renderer.jsx")
			if err != nil {
				w.Close()
				tmpFile.Close()
				os.Remove(tmpFile.Name())
				return "", fmt.Errorf("failed to create sample renderer: %w", err)
			}
			_, err = fw.Write([]byte("export default function SampleRenderer() { return null; }"))
			if err != nil {
				w.Close()
				tmpFile.Close()
				os.Remove(tmpFile.Name())
				return "", fmt.Errorf("failed to write sample renderer: %w", err)
			}
		}
	}

	// Close the zip writer
	if err := w.Close(); err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("failed to close zip writer: %w", err)
	}

	// Close the file
	if err := tmpFile.Close(); err != nil {
		os.Remove(tmpFile.Name())
		return "", fmt.Errorf("failed to close temp file: %w", err)
	}

	return tmpFile.Name(), nil
}

// cleanupTestBundle removes the test bundle file
func cleanupTestBundle(t *testing.T, path string) {
	t.Helper()
	if err := os.Remove(path); err != nil {
		t.Logf("Warning: Failed to clean up test bundle %s: %v", path, err)
	}
}
