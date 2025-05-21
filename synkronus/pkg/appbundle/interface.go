package appbundle

import (
	"context"
	"errors"
	"io"
	"time"
)

// ErrFileNotFound is returned when a requested file is not found
var ErrFileNotFound = errors.New("file not found")

// File represents a file in the app bundle
type File struct {
	Path     string    `json:"path"`
	Size     int64     `json:"size"`
	Hash     string    `json:"hash"`
	MimeType string    `json:"mimeType"`
	ModTime  time.Time `json:"modTime"`
}

// Manifest represents the app bundle manifest
type Manifest struct {
	Files       []File `json:"files"`
	Version     string `json:"version"`
	GeneratedAt string `json:"generatedAt"`
	Hash        string `json:"hash"` // Hash of the entire manifest for ETag
}

// AppBundleServiceInterface defines the interface for app bundle operations
type AppBundleServiceInterface interface {
	// GetManifest retrieves the current app bundle manifest
	GetManifest(ctx context.Context) (*Manifest, error)

	// GetFile retrieves a specific file from the app bundle
	GetFile(ctx context.Context, path string) (io.ReadCloser, *File, error)

	// GetLatestVersionFile gets a file from the latest version
	GetLatestVersionFile(ctx context.Context, path string) (io.ReadCloser, *File, error)

	// GetFileHash returns the hash for a specific file, optionally from the latest version
	GetFileHash(ctx context.Context, path string, useLatest bool) (string, error)

	// RefreshManifest forces a refresh of the manifest
	RefreshManifest() error

	// PushBundle uploads a new app bundle from a zip file
	PushBundle(ctx context.Context, zipReader io.Reader) (*Manifest, error)

	// GetVersions returns a list of available app bundle versions
	GetVersions(ctx context.Context) ([]string, error)

	// SwitchVersion switches to a specific app bundle version
	SwitchVersion(ctx context.Context, version string) error

	// GetAppInfo retrieves the app info for a specific version
	GetAppInfo(ctx context.Context, version string) (*AppInfo, error)

	// GetLatestAppInfo retrieves the app info for the latest version (including unreleased)
	GetLatestAppInfo(ctx context.Context) (*AppInfo, error)

	// CompareAppInfos compares two versions and returns the change log
	CompareAppInfos(ctx context.Context, versionA, versionB string) (*ChangeLog, error)
}
