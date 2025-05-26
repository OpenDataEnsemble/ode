package appbundle

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// PushBundle uploads a new app bundle from a zip file
func (s *Service) PushBundle(ctx context.Context, zipReader io.Reader) (*Manifest, error) {
	// Create a temporary file to store the zip content
	tempZipFile, err := os.CreateTemp("", "appbundle-*.zip")
	if err != nil {
		return nil, fmt.Errorf("failed to create temporary file: %w", err)
	}
	defer os.Remove(tempZipFile.Name())
	defer tempZipFile.Close()

	// Copy the zip content to the temporary file
	if _, err := io.Copy(tempZipFile, zipReader); err != nil {
		return nil, fmt.Errorf("failed to copy zip content: %w", err)
	}

	// Rewind the file for reading
	if _, err := tempZipFile.Seek(0, 0); err != nil {
		return nil, fmt.Errorf("failed to rewind temporary file: %w", err)
	}

	// Open the zip file for validation
	zipFile, err := zip.OpenReader(tempZipFile.Name())
	if err != nil {
		return nil, fmt.Errorf("failed to open zip file: %w", err)
	}
	defer zipFile.Close()

	// Validate the bundle structure
	if err := s.validateBundleStructure(&zipFile.Reader); err != nil {
		return nil, fmt.Errorf("bundle validation failed: %w", err)
	}

	// Get the next version number after validation passes
	versionNumber, err := s.getNextVersionNumber()
	if err != nil {
		return nil, fmt.Errorf("failed to get next version number: %w", err)
	}

	// Create version name with leading zeros for sorting (e.g., 0001, 0002, etc.)
	versionName := fmt.Sprintf("%04d", versionNumber)
	versionPath := filepath.Join(s.versionsPath, versionName)

	// Create the version directory
	s.log.Info("Creating new app bundle version", "version", versionName)
	if err := os.MkdirAll(versionPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create version directory: %w", err)
	}

	// Generate app info with the new version number
	appInfoData, err := s.generateAppInfo(&zipFile.Reader, fmt.Sprint(versionNumber))
	if err != nil {
		return nil, fmt.Errorf("failed to generate app info: %w", err)
	}

	// Write APP_INFO.json directly to the version directory
	appInfoPath := filepath.Join(versionPath, "APP_INFO.json")
	if err := os.WriteFile(appInfoPath, appInfoData, 0644); err != nil {
		return nil, fmt.Errorf("failed to write APP_INFO.json: %w", err)
	}

	// Rewind the zip file for extraction
	if _, err := tempZipFile.Seek(0, 0); err != nil {
		return nil, fmt.Errorf("failed to rewind temporary file: %w", err)
	}

	// Extract the zip file to the version directory (using the original zip file)
	for _, file := range zipFile.File {
		// Skip directories and files with paths containing ".."
		if file.FileInfo().IsDir() || strings.Contains(file.Name, "..") {
			continue
		}

		// Clean the file path and ensure it's safe
		cleanPath := filepath.Clean(file.Name)
		cleanPath = filepath.ToSlash(cleanPath)

		// Create the target file path
		targetPath := filepath.Join(versionPath, cleanPath)

		// Ensure the parent directory exists
		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return nil, fmt.Errorf("failed to create directory for file %s: %w", cleanPath, err)
		}

		// Open the file from the zip
		srcFile, err := file.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to open file %s from zip: %w", cleanPath, err)
		}

		// Create the target file
		dstFile, err := os.Create(targetPath)
		if err != nil {
			srcFile.Close()
			return nil, fmt.Errorf("failed to create file %s: %w", cleanPath, err)
		}

		// Copy the content
		if _, err := io.Copy(dstFile, srcFile); err != nil {
			srcFile.Close()
			dstFile.Close()
			return nil, fmt.Errorf("failed to copy file %s: %w", cleanPath, err)
		}

		// Close the files
		srcFile.Close()
		dstFile.Close()
	}

	// Clean up old versions if needed
	if err := s.cleanupOldVersions(); err != nil {
		s.log.Error("Failed to clean up old versions", "error", err)
		// Continue even if cleanup fails
	}

	// Return a minimal manifest with just the version
	return &Manifest{
		Version:     versionName,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		// Files will be populated when the manifest is generated
	}, nil
}

// GetVersions returns a list of available app bundle versions
// The current version is marked with an asterisk (*) at the end
func (s *Service) GetVersions(ctx context.Context) ([]string, error) {
	// Read the versions directory
	entries, err := os.ReadDir(s.versionsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("failed to read versions directory: %w", err)
	}

	// Get current version
	currentVersion, err := s.getCurrentVersion()
	if err != nil {
		return nil, fmt.Errorf("failed to get current version: %w", err)
	}

	// Filter directories and collect versions
	versions := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			version := entry.Name()
			// Mark current version with an asterisk
			if version == currentVersion {
				version += " *"
			}
			versions = append(versions, version)
		}
	}

	// Sort versions in descending order (newest first)
	sort.Slice(versions, func(i, j int) bool {
		// Remove asterisks for comparison
		a := strings.TrimSuffix(versions[i], " *")
		b := strings.TrimSuffix(versions[j], " *")
		return a > b
	})

	return versions, nil
}

// getCurrentVersion returns the name of the currently active version
func (s *Service) getCurrentVersion() (string, error) {
	s.versionMutex.Lock()
	defer s.versionMutex.Unlock()

	// Read the current version from the version file
	versionFile := filepath.Join(s.versionsPath, "CURRENT_VERSION")
	data, err := os.ReadFile(versionFile)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil // No current version set
		}
		return "", fmt.Errorf("failed to read current version: %w", err)
	}

	// Clean and validate the version
	version := strings.TrimSpace(string(data))
	if version == "" {
		return "", nil
	}

	// Verify the version directory exists
	versionPath := filepath.Join(s.versionsPath, version)
	if _, err := os.Stat(versionPath); err != nil {
		if os.IsNotExist(err) {
			s.log.Warn("Current version directory not found", "version", version)
			return "", nil
		}
		return "", fmt.Errorf("failed to verify version directory: %w", err)
	}

	return version, nil
}

// SwitchVersion switches to a specific app bundle version
func (s *Service) SwitchVersion(ctx context.Context, version string) error {
	s.versionMutex.Lock()
	defer s.versionMutex.Unlock()

	// Validate the version
	versionPath := filepath.Join(s.versionsPath, version)
	if _, err := os.Stat(versionPath); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("version %s does not exist", version)
		}
		return fmt.Errorf("failed to stat version directory: %w", err)
	}

	// Clear the current bundle directory
	if err := s.clearDirectory(s.bundlePath); err != nil {
		return fmt.Errorf("failed to clear bundle directory: %w", err)
	}

	// Copy the version to the bundle directory
	if err := s.copyDirectory(versionPath, s.bundlePath); err != nil {
		return fmt.Errorf("failed to copy version to bundle directory: %w", err)
	}

	// Update the current version file atomically
	versionFile := filepath.Join(s.versionsPath, "CURRENT_VERSION")
	tempFile := versionFile + ".tmp"

	// Write to a temporary file first
	if err := os.WriteFile(tempFile, []byte(version), 0644); err != nil {
		return fmt.Errorf("failed to write version file: %w", err)
	}

	// Atomic rename (works across all platforms)
	if err := os.Rename(tempFile, versionFile); err != nil {
		// Clean up temp file if rename fails
		os.Remove(tempFile)
		return fmt.Errorf("failed to update current version: %w", err)
	}

	// Update in-memory state
	s.currentVersion = version
	s.manifest = nil // Force regeneration of manifest

	s.log.Info("Switched to app bundle version", "version", version)
	return nil
}

// clearDirectory removes all files and subdirectories in a directory
func (s *Service) clearDirectory(dir string) error {
	// Read the directory
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("failed to read directory: %w", err)
	}

	// Remove each entry
	for _, entry := range entries {
		path := filepath.Join(dir, entry.Name())
		if err := os.RemoveAll(path); err != nil {
			return fmt.Errorf("failed to remove %s: %w", path, err)
		}
	}

	return nil
}

// copyDirectory copies all files and subdirectories from src to dst
func (s *Service) copyDirectory(src, dst string) error {
	// Walk the source directory
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Get the relative path
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return fmt.Errorf("failed to get relative path: %w", err)
		}

		// Skip the root directory
		if relPath == "." {
			return nil
		}

		// Create the destination path
		dstPath := filepath.Join(dst, relPath)

		// If it's a directory, create it
		if info.IsDir() {
			if err := os.MkdirAll(dstPath, info.Mode()); err != nil {
				return fmt.Errorf("failed to create directory %s: %w", dstPath, err)
			}
			return nil
		}

		// Copy the file
		return s.copyFile(path, dstPath, info.Mode())
	})
}

// copyFile copies a file from src to dst
func (s *Service) copyFile(src, dst string, mode os.FileMode) error {
	// Open the source file
	srcFile, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer srcFile.Close()

	// Create the destination file
	dstFile, err := os.OpenFile(dst, os.O_RDWR|os.O_CREATE|os.O_TRUNC, mode)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dstFile.Close()

	// Copy the content
	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return fmt.Errorf("failed to copy file content: %w", err)
	}

	return nil
}

func (s *Service) getNextVersionNumber() (int, error) {
	s.versionMutex.Lock()
	defer s.versionMutex.Unlock()

	// Ensure versions directory exists
	if err := os.MkdirAll(s.versionsPath, 0755); err != nil {
		return 0, fmt.Errorf("failed to create versions directory: %w", err)
	}

	// List all version directories
	entries, err := os.ReadDir(s.versionsPath)
	if err != nil {
		return 0, fmt.Errorf("failed to read versions directory: %w", err)
	}

	// Find the highest version number
	highestVersion := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		// Parse version number from directory name
		version, err := strconv.Atoi(entry.Name())
		if err != nil {
			// Skip non-numeric directories
			continue
		}

		if version > highestVersion {
			highestVersion = version
		}
	}

	// Return the next version number
	return highestVersion + 1, nil
}

// GetAppInfo retrieves the app info for a specific version
func (s *Service) GetAppInfo(ctx context.Context, version string) (*AppInfo, error) {
	versionDir := filepath.Join(s.versionsPath, version)
	appInfoPath := filepath.Join(versionDir, "APP_INFO.json")

	data, err := os.ReadFile(appInfoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read APP_INFO.json: %w", err)
	}

	var appInfo AppInfo
	if err := json.Unmarshal(data, &appInfo); err != nil {
		return nil, fmt.Errorf("failed to parse APP_INFO.json: %w", err)
	}
	appInfo.Timestamp = time.Now().Format(time.RFC3339)

	return &appInfo, nil
}

// GetLatestAppInfo retrieves the app info for the latest version (including unreleased)
func (s *Service) GetLatestAppInfo(ctx context.Context) (*AppInfo, error) {
	// First check for an unreleased version
	tempAppInfoPath := filepath.Join(s.versionsPath, "temp_APP_INFO.json")
	if _, err := os.Stat(tempAppInfoPath); err == nil {
		// Found an unreleased version
		return s.GetAppInfo(ctx, "temp")
	}

	// Otherwise, get the latest released version
	versions, err := s.GetVersions(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get versions: %w", err)
	}

	if len(versions) == 0 {
		return nil, fmt.Errorf("no versions available")
	}

	// Versions are returned in descending order, so the first one is the latest
	// Remove asterisk from the version if present
	latestVersion := strings.TrimSuffix(versions[0], " *")
	return s.GetAppInfo(ctx, latestVersion)
}

// CompareAppInfos compares two versions and returns the change log
func (s *Service) CompareAppInfos(ctx context.Context, versionA, versionB string) (*ChangeLog, error) {
	var appInfoA, appInfoB *AppInfo
	var err error

	// Handle special "latest" version
	if versionA == "latest" {
		appInfoA, err = s.GetLatestAppInfo(ctx)
	} else {
		appInfoA, err = s.GetAppInfo(ctx, versionA)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get app info for version %s: %w", versionA, err)
	}

	if versionB == "latest" {
		appInfoB, err = s.GetLatestAppInfo(ctx)
	} else {
		appInfoB, err = s.GetAppInfo(ctx, versionB)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get app info for version %s: %w", versionB, err)
	}

	return CompareAppInfos(appInfoA, appInfoB)
}

// cleanupOldVersions removes old versions to keep only the maximum number of versions
func (s *Service) cleanupOldVersions() error {
	// Get all versions
	versions, err := s.GetVersions(context.Background())
	if err != nil {
		return fmt.Errorf("failed to get versions: %w", err)
	}

	// If we have fewer versions than the maximum, do nothing
	if len(versions) <= s.maxVersions {
		return nil
	}

	// Remove the oldest versions
	for i := s.maxVersions; i < len(versions); i++ {
		// Remove asterisk from the version if present
		version := strings.TrimSuffix(versions[i], " *")
		versionPath := filepath.Join(s.versionsPath, version)
		s.log.Info("Removing old app bundle version", "version", version)
		if err := os.RemoveAll(versionPath); err != nil {
			return fmt.Errorf("failed to remove old version %s: %w", version, err)
		}
	}

	return nil
}
