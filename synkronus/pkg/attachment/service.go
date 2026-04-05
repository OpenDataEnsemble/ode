package attachment

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/opendataensemble/synkronus/pkg/config"
)

type Service interface {
	// Save stores the attachment with the given ID
	Save(ctx context.Context, attachmentID string, file io.Reader) error

	// SaveUpload stores attachment bytes and optionally performs image processing.
	SaveUpload(ctx context.Context, attachmentID string, data []byte, contentType string) (SaveUploadResult, error)

	// Get retrieves the attachment with the given ID
	Get(ctx context.Context, attachmentID string) (io.ReadCloser, error)

	// Exists checks if an attachment with the given ID exists
	Exists(ctx context.Context, attachmentID string) (bool, error)

	// OpenForDownload opens the best attachment payload for client download.
	OpenForDownload(ctx context.Context, attachmentID string, preferOriginal bool) (io.ReadCloser, error)

	// ExistsForDownload checks if a download payload exists with optional original preference.
	ExistsForDownload(ctx context.Context, attachmentID string, preferOriginal bool) (bool, error)

	// WriteZip streams a ZIP archive containing each attachment ID as one entry (streaming, no full-archive buffer).
	WriteZip(ctx context.Context, w io.Writer, ids []string) error
}

type SaveUploadResult struct {
	ServedSize        int
	ServedContentType string
}

type service struct {
	storagePath               string
	originalsPath             string
	imageCompressionLevel     int
	imageMaxWidthPx           int
	imageMaxHeightPx          int
	imageApplyExifOrientation bool
}

func NewService(cfg *config.Config) (Service, error) {
	// Ensure storage directory exists
	storagePath := filepath.Join(cfg.DataDir, "attachments")
	if err := os.MkdirAll(storagePath, 0755); err != nil {
		return nil, err
	}
	originalsPath := filepath.Join(cfg.DataDir, "attachments_uncompressed")
	if err := os.MkdirAll(originalsPath, 0755); err != nil {
		return nil, err
	}

	return &service{
		storagePath:               storagePath,
		originalsPath:             originalsPath,
		imageCompressionLevel:     cfg.ImageCompressionLevel,
		imageMaxWidthPx:           cfg.ImageMaxWidthPx,
		imageMaxHeightPx:          cfg.ImageMaxHeightPx,
		imageApplyExifOrientation: cfg.ImageApplyExifOrientation,
	}, nil
}

func (s *service) getAttachmentPath(attachmentID string) (string, error) {
	// Basic path traversal protection
	if filepath.IsAbs(attachmentID) || filepath.VolumeName(attachmentID) != "" {
		return "", os.ErrInvalid
	}

	// Clean the path to prevent directory traversal
	cleanPath := filepath.Clean(attachmentID)
	if cleanPath == "." || cleanPath == ".." {
		return "", os.ErrInvalid
	}

	return filepath.Join(s.storagePath, cleanPath), nil
}

func (s *service) getOriginalAttachmentPath(attachmentID string) (string, error) {
	if filepath.IsAbs(attachmentID) || filepath.VolumeName(attachmentID) != "" {
		return "", os.ErrInvalid
	}
	cleanPath := filepath.Clean(attachmentID)
	if cleanPath == "." || cleanPath == ".." {
		return "", os.ErrInvalid
	}
	return filepath.Join(s.originalsPath, cleanPath), nil
}

func (s *service) Save(ctx context.Context, attachmentID string, file io.Reader) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	path, err := s.getAttachmentPath(attachmentID)
	if err != nil {
		return err
	}

	// Check if file already exists
	if _, err := os.Stat(path); err == nil {
		return os.ErrExist
	} else if !os.IsNotExist(err) {
		return err
	}

	// Create all parent directories
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	return writeReaderAtomic(path, file)
}

func (s *service) SaveUpload(ctx context.Context, attachmentID string, data []byte, contentType string) (SaveUploadResult, error) {
	if err := ctx.Err(); err != nil {
		return SaveUploadResult{}, err
	}
	path, err := s.getAttachmentPath(attachmentID)
	if err != nil {
		return SaveUploadResult{}, err
	}
	originalPath, err := s.getOriginalAttachmentPath(attachmentID)
	if err != nil {
		return SaveUploadResult{}, err
	}

	if _, err := os.Stat(path); err == nil {
		return SaveUploadResult{}, os.ErrExist
	} else if !os.IsNotExist(err) {
		return SaveUploadResult{}, err
	}

	processed := data
	processedType := normalizeContentType(contentType, data)
	shouldPersistOriginal := false

	result, err := processImageForStorage(data, imageProcessOptions{
		CompressionLevel:     s.imageCompressionLevel,
		MaxWidthPx:           s.imageMaxWidthPx,
		MaxHeightPx:          s.imageMaxHeightPx,
		ApplyExifOrientation: s.imageApplyExifOrientation,
	})
	if err != nil {
		return SaveUploadResult{}, err
	}
	if result.Processed && len(result.Data) < len(data) {
		processed = result.Data
		if result.ContentType != "" {
			processedType = result.ContentType
		}
		shouldPersistOriginal = true
	}

	if shouldPersistOriginal {
		if _, err := os.Stat(originalPath); err == nil {
			return SaveUploadResult{}, os.ErrExist
		} else if !os.IsNotExist(err) {
			return SaveUploadResult{}, err
		}
		if err := writeFileAtomic(originalPath, data); err != nil {
			return SaveUploadResult{}, err
		}
		if err := writeFileAtomic(path, processed); err != nil {
			_ = os.Remove(originalPath)
			return SaveUploadResult{}, err
		}
	} else {
		if err := writeFileAtomic(path, processed); err != nil {
			return SaveUploadResult{}, err
		}
	}

	return SaveUploadResult{
		ServedSize:        len(processed),
		ServedContentType: processedType,
	}, nil
}

func (s *service) Get(ctx context.Context, attachmentID string) (io.ReadCloser, error) {
	path, err := s.getAttachmentPath(attachmentID)
	if err != nil {
		return nil, err
	}

	return os.Open(path)
}

func (s *service) Exists(ctx context.Context, attachmentID string) (bool, error) {
	path, err := s.getAttachmentPath(attachmentID)
	if err != nil {
		return false, err
	}

	_, err = os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func (s *service) OpenForDownload(ctx context.Context, attachmentID string, preferOriginal bool) (io.ReadCloser, error) {
	if !preferOriginal {
		return s.Get(ctx, attachmentID)
	}

	originalPath, err := s.getOriginalAttachmentPath(attachmentID)
	if err != nil {
		return nil, err
	}
	rc, err := os.Open(originalPath)
	if err == nil {
		return rc, nil
	}
	if os.IsNotExist(err) {
		return s.Get(ctx, attachmentID)
	}
	return nil, err
}

func (s *service) ExistsForDownload(ctx context.Context, attachmentID string, preferOriginal bool) (bool, error) {
	if !preferOriginal {
		return s.Exists(ctx, attachmentID)
	}

	originalPath, err := s.getOriginalAttachmentPath(attachmentID)
	if err != nil {
		return false, err
	}
	_, err = os.Stat(originalPath)
	if err == nil {
		return true, nil
	}
	if !os.IsNotExist(err) {
		return false, err
	}
	return s.Exists(ctx, attachmentID)
}

// zipEntryNameForAttachment maps a logical attachment ID to a safe path inside a ZIP archive.
func zipEntryNameForAttachment(attachmentID string) string {
	name := strings.ReplaceAll(attachmentID, `\`, "/")
	name = strings.TrimPrefix(name, "/")
	if strings.Contains(name, "..") {
		return strings.ReplaceAll(strings.ReplaceAll(attachmentID, "/", "_"), `\`, "_")
	}
	return name
}

// WriteZip writes one file per attachment ID into a ZIP stream. Missing files return an error.
func (s *service) WriteZip(ctx context.Context, w io.Writer, ids []string) error {
	zw := zip.NewWriter(w)
	defer zw.Close()

	for _, id := range ids {
		if err := ctx.Err(); err != nil {
			return err
		}
		rc, err := s.OpenForDownload(ctx, id, true)
		if err != nil {
			return fmt.Errorf("open attachment %q: %w", id, err)
		}
		entry, err := zw.Create(zipEntryNameForAttachment(id))
		if err != nil {
			rc.Close()
			return fmt.Errorf("zip entry for %q: %w", id, err)
		}
		_, err = io.Copy(entry, rc)
		rc.Close()
		if err != nil {
			return fmt.Errorf("write attachment %q: %w", id, err)
		}
	}
	return nil
}

func normalizeContentType(declared string, data []byte) string {
	if declared != "" {
		parts := strings.Split(declared, ";")
		if len(parts) > 0 {
			trimmed := strings.TrimSpace(parts[0])
			if trimmed != "" {
				return trimmed
			}
		}
	}
	return http.DetectContentType(data)
}

func writeFileAtomic(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	tmpFile, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmpFile.Name()

	cleanup := func() {
		_ = tmpFile.Close()
		_ = os.Remove(tmpPath)
	}

	if _, err := tmpFile.Write(data); err != nil {
		cleanup()
		return err
	}
	if err := tmpFile.Sync(); err != nil {
		cleanup()
		return err
	}
	if err := tmpFile.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	return nil
}

func writeReaderAtomic(path string, r io.Reader) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	tmpFile, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmpFile.Name()

	cleanup := func() {
		_ = tmpFile.Close()
		_ = os.Remove(tmpPath)
	}

	if _, err := io.Copy(tmpFile, r); err != nil {
		cleanup()
		return err
	}
	if err := tmpFile.Sync(); err != nil {
		cleanup()
		return err
	}
	if err := tmpFile.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	return nil
}
