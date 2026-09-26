package attachment

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"errors"
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

	// SaveUpload streams an attachment and optionally performs bounded image processing.
	SaveUpload(ctx context.Context, attachmentID string, file io.Reader, contentType string) (SaveUploadResult, error)

	// RemoveUpload rolls back a newly stored attachment and any retained original.
	RemoveUpload(ctx context.Context, attachmentID string) error

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

var ErrAttachmentTooLarge = errors.New("attachment too large")

const maxAttachmentIDBytes = 512

type service struct {
	storagePath               string
	originalsPath             string
	maxUploadBytes            int64
	imageSemaphore            chan struct{}
	maxDecodedImageDimension  int
	maxDecodedImagePixels     int64
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

	maxUploadBytes := cfg.MaxAttachmentUploadBytes
	if maxUploadBytes <= 0 {
		maxUploadBytes = config.DefaultMaxAttachmentUploadBytes
	}
	maxImageWorkers := cfg.MaxConcurrentImageProcessing
	if maxImageWorkers <= 0 {
		maxImageWorkers = config.DefaultMaxConcurrentImageProcessing
	}
	maxDimension := cfg.MaxDecodedImageDimensionPx
	if maxDimension <= 0 {
		maxDimension = config.DefaultMaxDecodedImageDimensionPx
	}
	maxPixels := cfg.MaxDecodedImagePixels
	if maxPixels <= 0 {
		maxPixels = config.DefaultMaxDecodedImagePixels
	}

	return &service{
		storagePath:               storagePath,
		originalsPath:             originalsPath,
		maxUploadBytes:            maxUploadBytes,
		imageSemaphore:            make(chan struct{}, maxImageWorkers),
		maxDecodedImageDimension:  maxDimension,
		maxDecodedImagePixels:     maxPixels,
		imageCompressionLevel:     cfg.ImageCompressionLevel,
		imageMaxWidthPx:           cfg.ImageMaxWidthPx,
		imageMaxHeightPx:          cfg.ImageMaxHeightPx,
		imageApplyExifOrientation: cfg.ImageApplyExifOrientation,
	}, nil
}

func ValidateAttachmentID(attachmentID string) error {
	if attachmentID == "" || len(attachmentID) > maxAttachmentIDBytes || filepath.IsAbs(attachmentID) || filepath.VolumeName(attachmentID) != "" || strings.Contains(attachmentID, `\\`) {
		return os.ErrInvalid
	}
	for _, segment := range strings.Split(attachmentID, "/") {
		if segment == "" || segment == "." || segment == ".." {
			return os.ErrInvalid
		}
		for _, r := range segment {
			if !(r >= 'a' && r <= 'z') && !(r >= 'A' && r <= 'Z') && !(r >= '0' && r <= '9') && r != '.' && r != '_' && r != '-' {
				return os.ErrInvalid
			}
		}
	}
	return nil
}

func containedPath(root, attachmentID string) (string, error) {
	if err := ValidateAttachmentID(attachmentID); err != nil {
		return "", err
	}
	path := filepath.Join(root, filepath.FromSlash(attachmentID))
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", os.ErrInvalid
	}
	return path, nil
}

func (s *service) getAttachmentPath(attachmentID string) (string, error) {
	return containedPath(s.storagePath, attachmentID)
}

func (s *service) getOriginalAttachmentPath(attachmentID string) (string, error) {
	return containedPath(s.originalsPath, attachmentID)
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

func (s *service) SaveUpload(ctx context.Context, attachmentID string, file io.Reader, contentType string) (SaveUploadResult, error) {
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

	buffered := bufio.NewReader(file)
	sniff, _ := buffered.Peek(512)
	processedType := normalizeContentType(contentType, sniff)
	if !strings.HasPrefix(processedType, "image/jpeg") && !strings.HasPrefix(processedType, "image/png") {
		size, err := writeReaderAtomicNoReplace(path, io.LimitReader(buffered, s.maxUploadBytes+1), s.maxUploadBytes)
		if err != nil {
			return SaveUploadResult{}, err
		}
		return SaveUploadResult{ServedSize: int(size), ServedContentType: processedType}, nil
	}

	select {
	case s.imageSemaphore <- struct{}{}:
		defer func() { <-s.imageSemaphore }()
	case <-ctx.Done():
		return SaveUploadResult{}, ctx.Err()
	}

	data, err := readAllLimited(buffered, s.maxUploadBytes)
	if err != nil {
		return SaveUploadResult{}, err
	}
	processed := data
	shouldPersistOriginal := false
	result, err := processImageForStorage(data, imageProcessOptions{
		CompressionLevel:     s.imageCompressionLevel,
		MaxWidthPx:           s.imageMaxWidthPx,
		MaxHeightPx:          s.imageMaxHeightPx,
		ApplyExifOrientation: s.imageApplyExifOrientation,
		MaxDimensionPx:       s.maxDecodedImageDimension,
		MaxPixels:            s.maxDecodedImagePixels,
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
		if err := writeFileAtomicNoReplace(originalPath, data); err != nil {
			return SaveUploadResult{}, err
		}
		if err := writeFileAtomicNoReplace(path, processed); err != nil {
			_ = os.Remove(originalPath)
			return SaveUploadResult{}, err
		}
	} else {
		if err := writeFileAtomicNoReplace(path, processed); err != nil {
			return SaveUploadResult{}, err
		}
	}

	return SaveUploadResult{
		ServedSize:        len(processed),
		ServedContentType: processedType,
	}, nil
}

func (s *service) RemoveUpload(ctx context.Context, attachmentID string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	path, err := s.getAttachmentPath(attachmentID)
	if err != nil {
		return err
	}
	originalPath, err := s.getOriginalAttachmentPath(attachmentID)
	if err != nil {
		return err
	}
	var removalError error
	for _, candidate := range []string{path, originalPath} {
		if err := os.Remove(candidate); err != nil && !os.IsNotExist(err) {
			removalError = errors.Join(removalError, err)
		}
	}
	return removalError
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

func readAllLimited(r io.Reader, maxBytes int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(r, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, ErrAttachmentTooLarge
	}
	return data, nil
}

func writeFileAtomicNoReplace(path string, data []byte) error {
	_, err := writeReaderAtomicNoReplace(path, bytes.NewReader(data), int64(len(data)))
	return err
}

func writeReaderAtomic(path string, r io.Reader) error {
	_, err := writeReaderAtomicNoReplace(path, r, -1)
	return err
}

func writeReaderAtomicNoReplace(path string, r io.Reader, maxBytes int64) (int64, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return 0, err
	}
	tmpFile, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".*.tmp")
	if err != nil {
		return 0, err
	}
	tmpPath := tmpFile.Name()
	cleanup := func() {
		_ = tmpFile.Close()
		_ = os.Remove(tmpPath)
	}

	reader := r
	if maxBytes >= 0 {
		reader = io.LimitReader(r, maxBytes+1)
	}
	written, err := io.Copy(tmpFile, reader)
	if err != nil {
		cleanup()
		return 0, err
	}
	if maxBytes >= 0 && written > maxBytes {
		cleanup()
		return 0, ErrAttachmentTooLarge
	}
	if err := tmpFile.Sync(); err != nil {
		cleanup()
		return 0, err
	}
	if err := tmpFile.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return 0, err
	}
	// Linking within the destination directory atomically fails if path exists;
	// unlike Rename, it cannot replace a concurrent upload.
	if err := os.Link(tmpPath, path); err != nil {
		_ = os.Remove(tmpPath)
		return 0, err
	}
	if err := os.Remove(tmpPath); err != nil {
		return 0, err
	}
	return written, nil
}
