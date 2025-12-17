package attachment

import (
	"context"
	"io"
	"os"
	"path/filepath"

	"github.com/opendataensemble/synkronus/pkg/config"
)

type Service interface {
	// Save stores the attachment with the given ID
	Save(ctx context.Context, attachmentID string, file io.Reader) error

	// Get retrieves the attachment with the given ID
	Get(ctx context.Context, attachmentID string) (io.ReadCloser, error)

	// Exists checks if an attachment with the given ID exists
	Exists(ctx context.Context, attachmentID string) (bool, error)
}

type service struct {
	storagePath string
}

func NewService(cfg *config.Config) (Service, error) {
	// Ensure storage directory exists
	storagePath := filepath.Join(cfg.DataDir, "attachments")
	if err := os.MkdirAll(storagePath, 0755); err != nil {
		return nil, err
	}

	return &service{
		storagePath: storagePath,
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

func (s *service) Save(ctx context.Context, attachmentID string, file io.Reader) error {
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

	// Create new file
	dst, err := os.Create(path)
	if err != nil {
		return err
	}
	defer dst.Close()

	// Copy file content
	_, err = io.Copy(dst, file)
	return err
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
