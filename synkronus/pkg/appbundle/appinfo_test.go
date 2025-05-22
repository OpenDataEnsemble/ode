package appbundle

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
				// Add more specific assertions based on your bundle's expected content
			},
		},
		{
			name:       "valid bundle 02",
			bundlePath: filepath.Join("..", "..", "testdata", "bundles", "valid_bundle02.zip"),
			assertions: func(t *testing.T, appInfo *AppInfo) {
				assert.NotEmpty(t, appInfo.Version, "Version should not be empty")
				assert.NotEmpty(t, appInfo.Forms, "Should have forms")
				// Add more specific assertions based on your bundle's expected content
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
