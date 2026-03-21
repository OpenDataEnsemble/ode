package appbundle

import (
	"path/filepath"
	"testing"
)

func TestBundleDirsFromDataDir(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	active, versions := BundleDirsFromDataDir(root)
	wantActive := filepath.Join(root, "app-bundle", "active")
	wantVersions := filepath.Join(root, "app-bundle", "versions")
	if active != wantActive {
		t.Fatalf("active = %q, want %q", active, wantActive)
	}
	if versions != wantVersions {
		t.Fatalf("versions = %q, want %q", versions, wantVersions)
	}
}
