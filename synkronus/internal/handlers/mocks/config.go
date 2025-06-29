package mocks

import "github.com/opendataensemble/synkronus/pkg/config"

// NewTestConfig creates a new test configuration
func NewTestConfig() *config.Config {
	return &config.Config{
		AppBundlePath: "./testdata/appbundles",
		Port:          "8080",
		DatabaseURL:   "postgres://postgres:postgres@localhost:5432/synkronus_test?sslmode=disable",
		JWTSecret:     "test-secret",
		LogLevel:      "debug",
		DataDir:       "./testdata",
	}
}
