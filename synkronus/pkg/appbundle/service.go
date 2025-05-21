package appbundle

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/collectakit/synkronus/pkg/logger"
)

// Service provides app bundle functionality
type Service struct {
	bundlePath     string
	versionsPath   string
	currentVersion string
	maxVersions    int
	log            *logger.Logger
	manifest       *Manifest
	versionMutex   sync.Mutex
}

// Config contains app bundle configuration
type Config struct {
	// BundlePath is the path to the app bundle directory
	BundlePath string
	// VersionsPath is the path to store versioned app bundles
	VersionsPath string
	// MaxVersions is the maximum number of versions to keep
	MaxVersions int
}

// DefaultConfig returns a default configuration
func DefaultConfig() Config {
	return Config{
		BundlePath:   "./app-bundle",
		VersionsPath: "./app-bundle-versions",
		MaxVersions:  5,
	}
}

// NewService creates a new app bundle service
func NewService(config Config, log *logger.Logger) *Service {
	return &Service{
		bundlePath:     config.BundlePath,
		versionsPath:   config.VersionsPath,
		maxVersions:    config.MaxVersions,
		currentVersion: "current", // Default version name
		log:            log,
	}
}

// Initialize sets up the app bundle service
func (s *Service) Initialize(ctx context.Context) error {
	// Ensure the bundle directory exists
	if _, err := os.Stat(s.bundlePath); os.IsNotExist(err) {
		s.log.Info("Creating app bundle directory", "path", s.bundlePath)
		if err := os.MkdirAll(s.bundlePath, 0755); err != nil {
			return fmt.Errorf("failed to create app bundle directory: %w", err)
		}
	}

	// Ensure the versions directory exists
	if _, err := os.Stat(s.versionsPath); os.IsNotExist(err) {
		s.log.Info("Creating app bundle versions directory", "path", s.versionsPath)
		if err := os.MkdirAll(s.versionsPath, 0755); err != nil {
			return fmt.Errorf("failed to create app bundle versions directory: %w", err)
		}
	}

	// Generate the initial manifest
	if _, err := s.GetManifest(ctx); err != nil {
		return fmt.Errorf("failed to generate initial manifest: %w", err)
	}

	return nil
}

// GetManifest retrieves the current app bundle manifest
func (s *Service) GetManifest(ctx context.Context) (*Manifest, error) {
	// If we already have a manifest, return it
	if s.manifest != nil {
		return s.manifest, nil
	}

	// Generate a new manifest
	manifest, err := s.generateManifest()
	if err != nil {
		return nil, fmt.Errorf("failed to generate manifest: %w", err)
	}

	s.manifest = manifest
	return manifest, nil
}

// GetFile retrieves a specific file from the app bundle
func (s *Service) GetFile(ctx context.Context, path string) (io.ReadCloser, *File, error) {
	// Clean and validate the path
	cleanPath := filepath.Clean(path)
	if strings.Contains(cleanPath, "..") {
		return nil, nil, fmt.Errorf("invalid path: %s", path)
	}

	// Get the full path
	fullPath := filepath.Join(s.bundlePath, cleanPath)

	// Check if the file exists
	fileInfo, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil, fmt.Errorf("file not found: %s", path)
		}
		return nil, nil, fmt.Errorf("failed to stat file: %w", err)
	}

	// Ensure it's a file, not a directory
	if fileInfo.IsDir() {
		return nil, nil, fmt.Errorf("path is a directory, not a file: %s", path)
	}

	// Open the file
	file, err := os.Open(fullPath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open file: %w", err)
	}

	// Get the file hash
	hash, err := s.hashFile(fullPath)
	if err != nil {
		file.Close()
		return nil, nil, fmt.Errorf("failed to hash file: %w", err)
	}

	// Determine the MIME type
	mimeType := mime.TypeByExtension(filepath.Ext(fullPath))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	// Create the file metadata
	fileMetadata := &File{
		Path:     path,
		Size:     fileInfo.Size(),
		Hash:     hash,
		MimeType: mimeType,
		ModTime:  fileInfo.ModTime(),
	}

	return file, fileMetadata, nil
}

// GetLatestVersionFile gets a file from the latest version
func (s *Service) GetLatestVersionFile(ctx context.Context, path string) (io.ReadCloser, *File, error) {
    // Get all versions
    versions, err := s.GetVersions(ctx)
    if err != nil {
        return nil, nil, fmt.Errorf("failed to get versions: %w", err)
    }
    
    if len(versions) == 0 {
        return nil, nil, os.ErrNotExist
    }
    
    // Get the latest version
    latestVersion := versions[0]
    latestPath := filepath.Join(s.versionsPath, latestVersion, path)
    
    // Get file info
    fileInfo, err := os.Stat(latestPath)
    if err != nil {
        return nil, nil, err
    }
    
    // Ensure it's a file, not a directory
    if fileInfo.IsDir() {
        return nil, nil, fmt.Errorf("path is a directory: %s", path)
    }
    
    // Open the file
    file, err := os.Open(latestPath)
    if err != nil {
        return nil, nil, fmt.Errorf("failed to open file: %w", err)
    }
    
    // Get file hash
    hash, err := s.hashFile(latestPath)
    if err != nil {
        file.Close()
        return nil, nil, fmt.Errorf("failed to hash file: %w", err)
    }
    
    // Determine MIME type
    mimeType := mime.TypeByExtension(filepath.Ext(latestPath))
    if mimeType == "" {
        mimeType = "application/octet-stream"
    }
    
    fileMetadata := &File{
        Path:     path,
        Size:     fileInfo.Size(),
        Hash:     hash,
        MimeType: mimeType,
        ModTime:  fileInfo.ModTime(),
    }
    
    return file, fileMetadata, nil
}

// GetFileHash returns the hash for a specific file, optionally from the latest version
func (s *Service) GetFileHash(ctx context.Context, path string, useLatest bool) (string, error) {
    var filePath string
    
    if useLatest {
        // Get all versions
        versions, err := s.GetVersions(ctx)
        if err != nil {
            return "", fmt.Errorf("failed to get versions: %w", err)
        }
        
        if len(versions) == 0 {
            return "", os.ErrNotExist
        }
        
        // Get the latest version
        latestVersion := versions[0]
        filePath = filepath.Join(s.versionsPath, latestVersion, path)
    } else {
        // Clean and validate the path
        cleanPath := filepath.Clean(path)
        if strings.Contains(cleanPath, "..") {
            return "", fmt.Errorf("invalid path: %s", path)
        }
        filePath = filepath.Join(s.bundlePath, cleanPath)
    }
    
    // Hash the file
    return s.hashFile(filePath)
}

// generateManifest generates a new manifest for the app bundle
func (s *Service) generateManifest() (*Manifest, error) {
	manifest := &Manifest{
		Files:       []File{},
		Version:     "1.0.0", // This could be dynamic in a real implementation
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	}

	// Walk the bundle directory
	err := filepath.WalkDir(s.bundlePath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip directories
		if d.IsDir() {
			return nil
		}

		// Get the relative path
		relPath, err := filepath.Rel(s.bundlePath, path)
		if err != nil {
			return fmt.Errorf("failed to get relative path: %w", err)
		}

		// Use forward slashes for consistency across platforms
		relPath = filepath.ToSlash(relPath)

		// Get file info
		fileInfo, err := d.Info()
		if err != nil {
			return fmt.Errorf("failed to get file info: %w", err)
		}

		// Hash the file
		hash, err := s.hashFile(path)
		if err != nil {
			return fmt.Errorf("failed to hash file: %w", err)
		}

		// Determine the MIME type
		mimeType := mime.TypeByExtension(filepath.Ext(path))
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}

		// Add to the manifest
		manifest.Files = append(manifest.Files, File{
			Path:     relPath,
			Size:     fileInfo.Size(),
			Hash:     hash,
			MimeType: mimeType,
			ModTime:  fileInfo.ModTime(),
		})

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk bundle directory: %w", err)
	}

	// Sort files by path for consistent ordering
	sort.Slice(manifest.Files, func(i, j int) bool {
		return manifest.Files[i].Path < manifest.Files[j].Path
	})

	// Generate a hash for the entire manifest
	manifestHash, err := s.hashManifest(manifest)
	if err != nil {
		return nil, fmt.Errorf("failed to hash manifest: %w", err)
	}
	manifest.Hash = manifestHash

	return manifest, nil
}

// hashFile generates a SHA-256 hash for a file
func (s *Service) hashFile(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("failed to open file for hashing: %w", err)
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", fmt.Errorf("failed to hash file: %w", err)
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

// hashManifest generates a SHA-256 hash for the manifest
func (s *Service) hashManifest(manifest *Manifest) (string, error) {
	// Create a string representation of the manifest files
	var sb strings.Builder
	for _, file := range manifest.Files {
		sb.WriteString(file.Path)
		sb.WriteString(file.Hash)
		sb.WriteString(fmt.Sprintf("%d", file.Size))
	}
	sb.WriteString(manifest.Version)
	sb.WriteString(manifest.GeneratedAt)

	// Hash the string
	hash := sha256.New()
	hash.Write([]byte(sb.String()))
	return hex.EncodeToString(hash.Sum(nil)), nil
}

// RefreshManifest forces a refresh of the manifest
func (s *Service) RefreshManifest() error {
	manifest, err := s.generateManifest()
	if err != nil {
		return fmt.Errorf("failed to refresh manifest: %w", err)
	}

	s.manifest = manifest
	return nil
}
