package attachment

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/opendataensemble/synkronus/pkg/config"
)

// WipeStorageDirectories removes all files under the configured attachment directories
// (data/attachments and data/attachments_uncompressed), then recreates empty dirs.
// Used after a hard repository reset so the filesystem matches the emptied manifest.
func WipeStorageDirectories(cfg *config.Config) error {
	if cfg == nil || cfg.DataDir == "" {
		return fmt.Errorf("invalid config for attachment wipe")
	}
	for _, sub := range []string{"attachments", "attachments_uncompressed"} {
		root := filepath.Join(cfg.DataDir, sub)
		if err := os.RemoveAll(root); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("remove %s: %w", root, err)
		}
		if err := os.MkdirAll(root, 0o755); err != nil {
			return fmt.Errorf("mkdir %s: %w", root, err)
		}
	}
	return nil
}
