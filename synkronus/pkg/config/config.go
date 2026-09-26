package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

// Config holds all configuration for the application
const (
	DefaultMaxAttachmentUploadBytes       int64 = 128 << 20
	DefaultMaxConcurrentAttachmentUploads       = 4
	DefaultMaxConcurrentImageProcessing         = 2
	DefaultMaxDecodedImageDimensionPx           = 16384
	DefaultMaxDecodedImagePixels          int64 = 40_000_000
	DefaultAuthMaxBodyBytes               int64 = 16 << 10
	DefaultAuthIPAttempts                       = 60
	DefaultAuthIPWindowSeconds                  = 60
	DefaultAuthLoginAttempts                    = 10
	DefaultAuthLoginWindowSeconds               = 300
	DefaultAuthAccountAttempts                  = 100
	DefaultAuthAccountWindowSeconds             = 900
	DefaultAuthLimiterMaxKeys                   = 10_000
)

type Config struct {
	// Server settings
	Port string

	// Database settings
	DatabaseURL string

	// Authentication
	JWTSecret                string
	AuthMaxBodyBytes         int64
	AuthIPAttempts           int
	AuthIPWindowSeconds      int
	AuthLoginAttempts        int
	AuthLoginWindowSeconds   int
	AuthAccountAttempts      int
	AuthAccountWindowSeconds int
	AuthLimiterMaxKeys       int
	AuthTrustedProxyCIDRs    []string

	// Logging
	LogLevel string

	// File storage root: absolute path to <directory-of-executable>/data (see resolvedMutableDataDir).
	DataDir string

	// App bundle storage: filepath.Join(DataDir, "app-bundle", "active" | "versions").
	AppBundlePath         string
	AppBundleVersionsPath string
	MaxVersionsKept       int

	// Attachment upload and image-processing limits.
	MaxAttachmentUploadBytes       int64
	MaxConcurrentAttachmentUploads int
	MaxConcurrentImageProcessing   int
	MaxDecodedImageDimensionPx     int
	MaxDecodedImagePixels          int64
	ImageCompressionLevel          int  // 0..10; 0 disables compression
	ImageMaxWidthPx                int  // 0 disables width limit
	ImageMaxHeightPx               int  // 0 disables height limit
	ImageApplyExifOrientation      bool // true enables EXIF orientation normalization

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

	authMaxBodyBytes := getEnvPositiveInt64WithWarnings(log, "SYNKRONUS_AUTH_MAX_BODY_BYTES", DefaultAuthMaxBodyBytes)
	authIPAttempts := getEnvPositiveIntWithWarnings(log, "SYNKRONUS_AUTH_IP_ATTEMPTS", DefaultAuthIPAttempts)
	authIPWindowSeconds := getEnvPositiveIntWithWarnings(log, "SYNKRONUS_AUTH_IP_WINDOW_SECONDS", DefaultAuthIPWindowSeconds)
	authLoginAttempts := getEnvPositiveIntWithWarnings(log, "SYNKRONUS_AUTH_LOGIN_ATTEMPTS", DefaultAuthLoginAttempts)
	authLoginWindowSeconds := getEnvPositiveIntWithWarnings(log, "SYNKRONUS_AUTH_LOGIN_WINDOW_SECONDS", DefaultAuthLoginWindowSeconds)
	authAccountAttempts := getEnvPositiveIntWithWarnings(log, "SYNKRONUS_AUTH_ACCOUNT_ATTEMPTS", DefaultAuthAccountAttempts)
	authAccountWindowSeconds := getEnvPositiveIntWithWarnings(log, "SYNKRONUS_AUTH_ACCOUNT_WINDOW_SECONDS", DefaultAuthAccountWindowSeconds)
	authLimiterMaxKeys := getEnvPositiveIntWithWarnings(log, "SYNKRONUS_AUTH_LIMITER_MAX_KEYS", DefaultAuthLimiterMaxKeys)
	authTrustedProxyCIDRs := splitCommaSeparated(getEnvOrDefault("SYNKRONUS_AUTH_TRUSTED_PROXY_CIDRS", ""))

	maxAttachmentUploadBytes := getEnvPositiveInt64WithWarnings(log, "SYNKRONUS_MAX_ATTACHMENT_UPLOAD_BYTES", DefaultMaxAttachmentUploadBytes)
	maxConcurrentAttachmentUploads := getEnvPositiveIntWithWarnings(log, "SYNKRONUS_MAX_CONCURRENT_ATTACHMENT_UPLOADS", DefaultMaxConcurrentAttachmentUploads)
	maxConcurrentImageProcessing := getEnvPositiveIntWithWarnings(log, "SYNKRONUS_MAX_CONCURRENT_IMAGE_PROCESSING", DefaultMaxConcurrentImageProcessing)
	maxDecodedImageDimensionPx := getEnvPositiveIntWithWarnings(log, "SYNKRONUS_MAX_DECODED_IMAGE_DIMENSION_PX", DefaultMaxDecodedImageDimensionPx)
	maxDecodedImagePixels := getEnvPositiveInt64WithWarnings(log, "SYNKRONUS_MAX_DECODED_IMAGE_PIXELS", DefaultMaxDecodedImagePixels)
	imageCompressionLevel := getEnvClampedIntWithWarnings(log, "SYNKRONUS_IMAGE_COMPRESSION_LEVEL", 0, 0, 10)
	imageMaxWidthPx := getEnvNonNegativeIntWithWarnings(log, "SYNKRONUS_IMAGE_MAX_WIDTH_PX", 0)
	imageMaxHeightPx := getEnvNonNegativeIntWithWarnings(log, "SYNKRONUS_IMAGE_MAX_HEIGHT_PX", 0)
	imageApplyExifOrientation := getEnvBoolWithWarnings(log, "SYNKRONUS_IMAGE_APPLY_EXIF_ORIENTATION", true)

	return &Config{
		Port:                           getEnvOrDefault("PORT", "8080"),
		DatabaseURL:                    getEnvOrDefault("DB_CONNECTION", "postgres://user:password@localhost:5432/synkronus"),
		JWTSecret:                      getEnvOrDefault("JWT_SECRET", ""),
		AuthMaxBodyBytes:               authMaxBodyBytes,
		AuthIPAttempts:                 authIPAttempts,
		AuthIPWindowSeconds:            authIPWindowSeconds,
		AuthLoginAttempts:              authLoginAttempts,
		AuthLoginWindowSeconds:         authLoginWindowSeconds,
		AuthAccountAttempts:            authAccountAttempts,
		AuthAccountWindowSeconds:       authAccountWindowSeconds,
		AuthLimiterMaxKeys:             authLimiterMaxKeys,
		AuthTrustedProxyCIDRs:          authTrustedProxyCIDRs,
		LogLevel:                       getEnvOrDefault("LOG_LEVEL", "info"),
		DataDir:                        dataDir,
		AppBundlePath:                  appBundlePath,
		AppBundleVersionsPath:          appBundleVersionsPath,
		MaxVersionsKept:                getEnvIntOrDefault("MAX_VERSIONS_KEPT", 5),
		MaxAttachmentUploadBytes:       maxAttachmentUploadBytes,
		MaxConcurrentAttachmentUploads: maxConcurrentAttachmentUploads,
		MaxConcurrentImageProcessing:   maxConcurrentImageProcessing,
		MaxDecodedImageDimensionPx:     maxDecodedImageDimensionPx,
		MaxDecodedImagePixels:          maxDecodedImagePixels,
		ImageCompressionLevel:          imageCompressionLevel,
		ImageMaxWidthPx:                imageMaxWidthPx,
		ImageMaxHeightPx:               imageMaxHeightPx,
		ImageApplyExifOrientation:      imageApplyExifOrientation,
		Source:                         configSource,
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

func splitCommaSeparated(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func getEnvPositiveIntWithWarnings(log *logger.Logger, key string, defaultValue int) int {
	value := getEnvPositiveInt64WithWarnings(log, key, int64(defaultValue))
	if value > int64(^uint(0)>>1) {
		if log != nil {
			log.Warn("Integer environment variable is too large, using default", "key", key, "value", value, "default", defaultValue)
		}
		return defaultValue
	}
	return int(value)
}

func getEnvPositiveInt64WithWarnings(log *logger.Logger, key string, defaultValue int64) int64 {
	value, exists := os.LookupEnv(key)
	if !exists || value == "" {
		return defaultValue
	}
	intValue, err := strconv.ParseInt(value, 10, 64)
	if err != nil || intValue <= 0 {
		if log != nil {
			log.Warn("Environment variable must be a positive integer, using default", "key", key, "value", value, "default", defaultValue)
		}
		return defaultValue
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
