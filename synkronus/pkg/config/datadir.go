package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// resolvedMutableDataDir returns an absolute path to the root directory for attachments,
// app-bundle trees, and other mutable files.
//
// Normally this is <directory-of-executable>/data, so it does not depend on the process
// working directory (e.g. Docker: /app/synkronus → /app/data).
//
// When the binary lives under a Go toolchain temp directory (go run, go test), the path
// would not be stable, so we fall back to ./data relative to the current working directory.
func resolvedMutableDataDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("os.Executable: %w", err)
	}
	resolved, err := filepath.EvalSymlinks(exe)
	if err != nil {
		resolved = exe
	}
	exeDir := filepath.Dir(resolved)

	var dataDir string
	if isGoToolchainEphemeralExeDir(exeDir) {
		cwd, err := os.Getwd()
		if err != nil {
			return "", fmt.Errorf("getwd for go run/test data dir fallback: %w", err)
		}
		dataDir = filepath.Join(cwd, "data")
	} else {
		dataDir = filepath.Join(exeDir, "data")
	}

	abs, err := filepath.Abs(dataDir)
	if err != nil {
		return "", fmt.Errorf("abs data dir: %w", err)
	}
	return filepath.Clean(abs), nil
}

// isGoToolchainEphemeralExeDir reports whether exeDir is a Go build cache / temp path where
// keeping data next to the binary would be wrong (new path every build).
func isGoToolchainEphemeralExeDir(exeDir string) bool {
	s := filepath.ToSlash(exeDir)
	return strings.Contains(s, "/go-build") || strings.Contains(s, "\\go-build")
}
