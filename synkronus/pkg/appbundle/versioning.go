package appbundle

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// PushBundle uploads a new app bundle from a zip file
func (s *Service) PushBundle(ctx context.Context, zipReader io.Reader) (*Manifest, error) {
	// Get the next version number
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

	// Open the zip file
	zipFile, err := zip.OpenReader(tempZipFile.Name())
	if err != nil {
		return nil, fmt.Errorf("failed to open zip file: %w", err)
	}
	defer zipFile.Close()

	// Extract the zip file to the version directory
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

	// Switch to the new version
	if err := s.SwitchVersion(ctx, versionName); err != nil {
		return nil, fmt.Errorf("failed to switch to new version: %w", err)
	}

	// Clean up old versions
	if err := s.cleanupOldVersions(); err != nil {
		s.log.Warn("Failed to clean up old versions", "error", err)
		// Continue anyway, this is not critical
	}

	// Generate and return the new manifest
	s.manifest = nil // Force regeneration
	manifest, err := s.GetManifest(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to generate manifest for new version: %w", err)
	}

	return manifest, nil
}

// GetVersions returns a list of available app bundle versions
func (s *Service) GetVersions(ctx context.Context) ([]string, error) {
	// Read the versions directory
	entries, err := os.ReadDir(s.versionsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("failed to read versions directory: %w", err)
	}

	// Filter directories and sort by name (which is timestamp-based)
	versions := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			versions = append(versions, entry.Name())
		}
	}

	// Sort versions in descending order (newest first)
	sort.Sort(sort.Reverse(sort.StringSlice(versions)))

	return versions, nil
}

// SwitchVersion switches to a specific app bundle version
func (s *Service) SwitchVersion(ctx context.Context, version string) error {
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

	// Update the current version
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

// getNextVersionNumber gets the next version number by finding the highest existing version and incrementing it
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
		versionPath := filepath.Join(s.versionsPath, versions[i])
		s.log.Info("Removing old app bundle version", "version", versions[i])
		if err := os.RemoveAll(versionPath); err != nil {
			return fmt.Errorf("failed to remove old version %s: %w", versions[i], err)
		}
	}

	return nil
}
