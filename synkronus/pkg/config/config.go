package config

import (
	"fmt"
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

	// File storage root: absolute path to <directory-of-executable>/data (see resolvedMutableDataDir).
	DataDir string

	// App bundle storage: filepath.Join(DataDir, "app-bundle", "active" | "versions").
	AppBundlePath         string
	AppBundleVersionsPath string
	MaxVersionsKept       int

	// Attachment image processing (all optional).
	ImageCompressionLevel     int  // 0..10; 0 disables compression
	ImageMaxWidthPx           int  // 0 disables width limit
	ImageMaxHeightPx          int  // 0 disables height limit
	ImageApplyExifOrientation bool // true enables EXIF orientation normalization

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

	dataDir, err := resolvedMutableDataDir()
	if err != nil {
		return nil, fmt.Errorf("mutable data directory: %w", err)
	}

	appBundlePath := filepath.Join(dataDir, "app-bundle", "active")
	appBundleVersionsPath := filepath.Join(dataDir, "app-bundle", "versions")

	imageCompressionLevel := getEnvClampedIntWithWarnings(log, "SYNKRONUS_IMAGE_COMPRESSION_LEVEL", 0, 0, 10)
	imageMaxWidthPx := getEnvNonNegativeIntWithWarnings(log, "SYNKRONUS_IMAGE_MAX_WIDTH_PX", 0)
	imageMaxHeightPx := getEnvNonNegativeIntWithWarnings(log, "SYNKRONUS_IMAGE_MAX_HEIGHT_PX", 0)
	imageApplyExifOrientation := getEnvBoolWithWarnings(log, "SYNKRONUS_IMAGE_APPLY_EXIF_ORIENTATION", true)

	return &Config{
		Port:                      getEnvOrDefault("PORT", "8080"),
		DatabaseURL:               getEnvOrDefault("DB_CONNECTION", "postgres://user:password@localhost:5432/synkronus"),
		JWTSecret:                 getEnvOrDefault("JWT_SECRET", ""),
		LogLevel:                  getEnvOrDefault("LOG_LEVEL", "info"),
		DataDir:                   dataDir,
		AppBundlePath:             appBundlePath,
		AppBundleVersionsPath:     appBundleVersionsPath,
		MaxVersionsKept:           getEnvIntOrDefault("MAX_VERSIONS_KEPT", 5),
		ImageCompressionLevel:     imageCompressionLevel,
		ImageMaxWidthPx:           imageMaxWidthPx,
		ImageMaxHeightPx:          imageMaxHeightPx,
		ImageApplyExifOrientation: imageApplyExifOrientation,
		Source:                    configSource,
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

func getEnvClampedIntWithWarnings(log *logger.Logger, key string, defaultValue, minValue, maxValue int) int {
	value, exists := os.LookupEnv(key)
	if !exists || value == "" {
		return defaultValue
	}
	intValue, err := strconv.Atoi(value)
	if err != nil {
		if log != nil {
			log.Warn("Invalid integer environment variable, using default", "key", key, "value", value, "default", defaultValue)
		}
		return defaultValue
	}
	if intValue < minValue {
		if log != nil {
			log.Warn("Environment variable below minimum, clamping", "key", key, "value", intValue, "min", minValue)
		}
		return minValue
	}
	if intValue > maxValue {
		if log != nil {
			log.Warn("Environment variable above maximum, clamping", "key", key, "value", intValue, "max", maxValue)
		}
		return maxValue
	}
	return intValue
}

func getEnvNonNegativeIntWithWarnings(log *logger.Logger, key string, defaultValue int) int {
	value, exists := os.LookupEnv(key)
	if !exists || value == "" {
		return defaultValue
	}
	intValue, err := strconv.Atoi(value)
	if err != nil {
		if log != nil {
			log.Warn("Invalid integer environment variable, using default", "key", key, "value", value, "default", defaultValue)
		}
		return defaultValue
	}
	if intValue < 0 {
		if log != nil {
			log.Warn("Environment variable cannot be negative, using default", "key", key, "value", intValue, "default", defaultValue)
		}
		return defaultValue
	}
	return intValue
}

func getEnvBoolWithWarnings(log *logger.Logger, key string, defaultValue bool) bool {
	value, exists := os.LookupEnv(key)
	if !exists || value == "" {
		return defaultValue
	}
	boolValue, err := strconv.ParseBool(value)
	if err != nil {
		if log != nil {
			log.Warn("Invalid boolean environment variable, using default", "key", key, "value", value, "default", defaultValue)
		}
		return defaultValue
	}
	return boolValue
}
