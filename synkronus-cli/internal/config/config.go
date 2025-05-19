package config

import (
	"path/filepath"
)

// DefaultConfig returns the default configuration map
func DefaultConfig() map[string]interface{} {
	return map[string]interface{}{
		"api.url":     "http://localhost:8080",
		"api.version": "1.0.0",
		"auth.token":  "",
	}
}

// TokenFilePath returns the path to the token file
func TokenFilePath(homeDir string) string {
	return filepath.Join(homeDir, ".synkronus_token")
}
