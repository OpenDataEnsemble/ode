package config

import (
	"os"
	"path/filepath"
	"strconv"

	"github.com/joho/godotenv"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

// Config holds all configuration for the application
type Config struct {
	// Server settings
	Port string

	// Database settings
	DatabaseURL string

	// Authentication
	JWTSecret string

	// Logging
	LogLevel string

	// File storage
	DataDir string // Base directory for file storage (attachments, etc.)

	// App Bundle settings
	AppBundlePath   string
	MaxVersionsKept int

	// Internal tracking
	Source string // Source of the configuration (env, .env file path, etc.)
}

// Load loads the configuration from environment variables
// and .env file if it exists
func Load(log *logger.Logger) (*Config, error) {
	// Try to load .env file from multiple locations
	// 1. Current working directory
	// 2. Executable directory
	// 3. Parent of executable directory
	loadedEnv := false
	configSource := "environment variables"

	// 1. Try current working directory first
	cwd, _ := os.Getwd()
	cwdEnvPath := filepath.Join(cwd, ".env")
	if log != nil {
		log.Debug("Searching for .env file", "path", cwdEnvPath)
	}
	if _, err := os.Stat(cwdEnvPath); err == nil {
		if log != nil {
			log.Debug("Found .env file", "path", cwdEnvPath)
		}
		if err := godotenv.Load(cwdEnvPath); err == nil {
			loadedEnv = true
			configSource = "file: " + cwdEnvPath
			if log != nil {
				log.Info("Successfully loaded .env file", "path", cwdEnvPath)
			}
		} else {
			if log != nil {
				log.Error("Error loading .env file", "path", cwdEnvPath, "error", err)
			}
		}
	}

	// 2. Try executable directory if not loaded yet
	if !loadedEnv {
		exePath, err := os.Executable()
		if err == nil {
			exeDir := filepath.Dir(exePath)
			envPath := filepath.Join(exeDir, ".env")
			if log != nil {
				log.Debug("Searching for .env file", "path", envPath)
			}
			if _, err := os.Stat(envPath); err == nil {
				if log != nil {
					log.Debug("Found .env file", "path", envPath)
				}
				if err := godotenv.Load(envPath); err == nil {
					loadedEnv = true
					configSource = "file: " + envPath
					if log != nil {
						log.Info("Successfully loaded .env file", "path", envPath)
					}
				} else {
					if log != nil {
						log.Error("Error loading .env file", "path", envPath, "error", err)
					}
				}
			}
		} else {
			if log != nil {
				log.Error("Error getting executable path", "error", err)
			}
		}
	}

	// 3. Try parent of executable directory if not loaded yet
	if !loadedEnv {
		exePath, err := os.Executable()
		if err == nil {
			exeDir := filepath.Dir(exePath)
			parentDir := filepath.Dir(exeDir)
			envPath := filepath.Join(parentDir, ".env")
			if log != nil {
				log.Debug("Searching for .env file", "path", envPath)
			}
			if _, err := os.Stat(envPath); err == nil {
				if log != nil {
					log.Debug("Found .env file", "path", envPath)
				}
				if err := godotenv.Load(envPath); err == nil {
					configSource = "file: " + envPath
					if log != nil {
						log.Info("Successfully loaded .env file", "path", envPath)
					}
				} else {
					if log != nil {
						log.Error("Error loading .env file", "path", envPath, "error", err)
					}
				}
			}
		}
	}

	// Print a summary of where configuration was loaded from
	if log != nil {
		log.Info("Configuration loaded", "source", configSource)
	}

	return &Config{
		Port:            getEnvOrDefault("PORT", "8080"),
		DatabaseURL:     getEnvOrDefault("DB_CONNECTION", "postgres://user:password@localhost:5432/synkronus"),
		JWTSecret:       getEnvOrDefault("JWT_SECRET", ""),
		LogLevel:        getEnvOrDefault("LOG_LEVEL", "info"),
		AppBundlePath:   getEnvOrDefault("APP_BUNDLE_PATH", "./data/app-bundles"),
		MaxVersionsKept: getEnvIntOrDefault("MAX_VERSIONS_KEPT", 5),
		Source:          configSource,
	}, nil
}

// getEnvOrDefault retrieves an environment variable or returns a default value
func getEnvOrDefault(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// getEnvIntOrDefault retrieves an environment variable as an integer or returns a default value
func getEnvIntOrDefault(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
