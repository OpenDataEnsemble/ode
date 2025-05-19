package mocks

import (
	"bytes"
	"context"
	"io"
	"time"

	"github.com/collectakit/synkronus/pkg/appbundle"
)

// MockAppBundleService is a mock implementation of the appbundle.AppBundleServiceInterface for testing
type MockAppBundleService struct {
	manifest *appbundle.Manifest
	files    map[string]*mockFile
}

type mockFile struct {
	content  []byte
	fileInfo appbundle.File
}

// NewMockAppBundleService creates a new mock app bundle service
func NewMockAppBundleService() *MockAppBundleService {
	now := time.Now()

	// Create a mock service with some test files
	mock := &MockAppBundleService{
		files: make(map[string]*mockFile),
	}

	// Add some test files
	mock.AddFile("index.html", []byte("<html><body>Hello World</body></html>"), "text/html", now)
	mock.AddFile("styles.css", []byte("body { font-family: Arial; }"), "text/css", now)
	mock.AddFile("app.js", []byte("console.log('Hello World');"), "application/javascript", now)

	// Generate the manifest
	mock.generateManifest()

	return mock
}

// AddFile adds a file to the mock service
func (m *MockAppBundleService) AddFile(path string, content []byte, mimeType string, modTime time.Time) {
	m.files[path] = &mockFile{
		content: content,
		fileInfo: appbundle.File{
			Path:     path,
			Size:     int64(len(content)),
			Hash:     "mock-hash-" + path, // Simple mock hash
			MimeType: mimeType,
			ModTime:  modTime,
		},
	}
}

// generateManifest generates a manifest for the mock service
func (m *MockAppBundleService) generateManifest() {
	files := make([]appbundle.File, 0, len(m.files))
	for _, file := range m.files {
		files = append(files, file.fileInfo)
	}

	m.manifest = &appbundle.Manifest{
		Files:       files,
		Version:     "1.0.0",
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		Hash:        "mock-manifest-hash",
	}
}

// GetManifest retrieves the current app bundle manifest
func (m *MockAppBundleService) GetManifest(ctx context.Context) (*appbundle.Manifest, error) {
	return m.manifest, nil
}

// GetFile retrieves a specific file from the app bundle
func (m *MockAppBundleService) GetFile(ctx context.Context, path string) (io.ReadCloser, *appbundle.File, error) {
	file, exists := m.files[path]
	if !exists {
		return nil, nil, appbundle.ErrFileNotFound
	}

	return io.NopCloser(bytes.NewReader(file.content)), &file.fileInfo, nil
}

// GetFileHash returns the hash for a specific file
func (m *MockAppBundleService) GetFileHash(ctx context.Context, path string) (string, error) {
	file, exists := m.files[path]
	if !exists {
		return "", appbundle.ErrFileNotFound
	}

	return file.fileInfo.Hash, nil
}

// PushBundle uploads a new app bundle from a zip file
func (m *MockAppBundleService) PushBundle(ctx context.Context, zipReader io.Reader) (*appbundle.Manifest, error) {
	// For testing, just return the current manifest
	return m.manifest, nil
}

// GetVersions returns a list of available app bundle versions
func (m *MockAppBundleService) GetVersions(ctx context.Context) ([]string, error) {
	// For testing, just return a static list of versions
	return []string{"20250101-000000", "20250102-000000"}, nil
}

// SwitchVersion switches to a specific app bundle version
func (m *MockAppBundleService) SwitchVersion(ctx context.Context, version string) error {
	// For testing, just return nil
	return nil
}
