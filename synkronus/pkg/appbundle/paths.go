package appbundle

import "path/filepath"

// BundleDirsFromDataDir returns the conventional active bundle directory and versions
// directory under a single data root (filesystem source of truth for app bundles).
func BundleDirsFromDataDir(dataDir string) (activeDir string, versionsDir string) {
	return filepath.Join(dataDir, "app-bundle", "active"),
		filepath.Join(dataDir, "app-bundle", "versions")
}
