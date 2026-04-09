package attachment

import (
	"os"
	"path/filepath"

	"github.com/opendataensemble/synkronus/pkg/config"
)

// WipeStoredFiles removes all files under the attachment storage directories and recreates empty dirs.
func WipeStoredFiles(cfg *config.Config) error {
	dirs := []string{
		filepath.Join(cfg.DataDir, "attachments"),
		filepath.Join(cfg.DataDir, "attachments_uncompressed"),
	}
	for _, d := range dirs {
		if err := os.RemoveAll(d); err != nil && !os.IsNotExist(err) {
			return err
		}
		if err := os.MkdirAll(d, 0o755); err != nil {
			return err
		}
	}
	return nil
}
