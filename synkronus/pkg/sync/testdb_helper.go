package sync

import (
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"
)

// TestDBConfig holds configuration for test database setup
type TestDBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// DefaultTestDBConfig returns default test database configuration
func DefaultTestDBConfig() TestDBConfig {
	return TestDBConfig{
		Host:     getEnvOrDefault("TEST_DB_HOST", "localhost"),
		Port:     getEnvOrDefault("TEST_DB_PORT", "5432"),
		User:     getEnvOrDefault("TEST_DB_USER", "synkronus_test"),
		Password: getEnvOrDefault("TEST_DB_PASSWORD", "synkronus_test"),
		DBName:   getEnvOrDefault("TEST_DB_NAME", "synkronus_test"),
		SSLMode:  getEnvOrDefault("TEST_DB_SSLMODE", "disable"),
	}
}

// getEnvOrDefault returns environment variable value or default
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// BuildTestDBURL constructs database URL from config
func (c TestDBConfig) BuildTestDBURL() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.DBName, c.SSLMode)
}

// SetupTestDatabase creates a test database connection and ensures schema exists
func SetupTestDatabase(t *testing.T) (*sql.DB, func()) {
	config := DefaultTestDBConfig()
	dbURL := config.BuildTestDBURL()

	// Try environment variable first
	if envURL := os.Getenv("TEST_DATABASE_URL"); envURL != "" {
		dbURL = envURL
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Skipf("Failed to connect to test database: %v\nTo run integration tests, set up PostgreSQL and configure:\n"+
			"  TEST_DATABASE_URL=postgres://user:pass@host:port/dbname?sslmode=disable\n"+
			"Or set individual environment variables:\n"+
			"  TEST_DB_HOST, TEST_DB_PORT, TEST_DB_USER, TEST_DB_PASSWORD, TEST_DB_NAME", err)
	}

	// Test connection with timeout
	if err := pingWithTimeout(db, 5*time.Second); err != nil {
		db.Close()
		t.Skipf("Test database not available: %v\nEnsure PostgreSQL is running and accessible", err)
	}

	// Ensure clean test environment
	if err := ensureTestSchema(db); err != nil {
		db.Close()
		t.Fatalf("Failed to setup test schema: %v", err)
	}

	cleanup := func() {
		if db != nil {
			if err := ResetTestData(db); err != nil {
				t.Errorf("Failed to reset test data: %v", err)
			}
			db.Close()
		}
	}

	return db, cleanup
}

// pingWithTimeout tests database connection with timeout
func pingWithTimeout(db *sql.DB, timeout time.Duration) error {
	done := make(chan error, 1)
	go func() {
		done <- db.Ping()
	}()

	select {
	case err := <-done:
		return err
	case <-time.After(timeout):
		return fmt.Errorf("database ping timeout after %v", timeout)
	}
}

// ensureTestSchema creates or updates test database schema
func ensureTestSchema(db *sql.DB) error {
	// Drop existing tables to ensure clean state
	dropQueries := []string{
		"DROP TRIGGER IF EXISTS observations_version_trigger ON observations",
		"DROP FUNCTION IF EXISTS update_sync_version()",
		"DROP TABLE IF EXISTS observations",
		"DROP TABLE IF EXISTS sync_version",
	}

	for _, query := range dropQueries {
		if _, err := db.Exec(query); err != nil {
			// Log but don't fail on drop errors
			fmt.Printf("Warning: %v\n", err)
		}
	}

	// Create sync_version table
	syncVersionSQL := `
		CREATE TABLE sync_version (
			id SERIAL PRIMARY KEY,
			current_version BIGINT NOT NULL DEFAULT 1,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`
	if _, err := db.Exec(syncVersionSQL); err != nil {
		return fmt.Errorf("failed to create sync_version table: %w", err)
	}

	// Insert initial version
	if _, err := db.Exec("INSERT INTO sync_version (current_version) VALUES (1)"); err != nil {
		return fmt.Errorf("failed to insert initial version: %w", err)
	}

	// Enable UUID extension
	_, err := db.Exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
	if err != nil {
		return fmt.Errorf("failed to enable uuid-ossp extension: %w", err)
	}

	// Create observations table
	observationsSQL := `
		CREATE TABLE observations (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			observation_id VARCHAR(255) UNIQUE NOT NULL,
			form_type VARCHAR(255) NOT NULL,
			form_version VARCHAR(50) NOT NULL,
			data JSONB NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			synced_at TIMESTAMP WITH TIME ZONE,
			deleted BOOLEAN NOT NULL DEFAULT FALSE,
			version BIGINT NOT NULL DEFAULT 1
		)
	`
	if _, err := db.Exec(observationsSQL); err != nil {
		return fmt.Errorf("failed to create observations table: %w", err)
	}

	// Create trigger function
	triggerFunctionSQL := `
		CREATE OR REPLACE FUNCTION update_sync_version() RETURNS TRIGGER AS $$
		BEGIN
			UPDATE sync_version SET current_version = current_version + 1, updated_at = CURRENT_TIMESTAMP;
			NEW.version = (SELECT current_version FROM sync_version ORDER BY id DESC LIMIT 1);
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
	`
	if _, err := db.Exec(triggerFunctionSQL); err != nil {
		return fmt.Errorf("failed to create trigger function: %w", err)
	}

	// Create trigger
	triggerSQL := `
		CREATE TRIGGER observations_version_trigger
			BEFORE INSERT OR UPDATE ON observations
			FOR EACH ROW EXECUTE FUNCTION update_sync_version();
	`
	if _, err := db.Exec(triggerSQL); err != nil {
		return fmt.Errorf("failed to create trigger: %w", err)
	}

	return nil
}

// ResetTestData cleans all test data and resets version to 1
func ResetTestData(db *sql.DB) error {
	// Clean observations
	if _, err := db.Exec("DELETE FROM observations"); err != nil {
		return fmt.Errorf("failed to clean observations: %w", err)
	}

	// Reset sync version
	if _, err := db.Exec("UPDATE sync_version SET current_version = 1, updated_at = CURRENT_TIMESTAMP"); err != nil {
		return fmt.Errorf("failed to reset sync version: %w", err)
	}

	return nil
}

// GetTestDatabaseInfo returns information about the test database setup
func GetTestDatabaseInfo() string {
	config := DefaultTestDBConfig()
	return fmt.Sprintf(`Test Database Configuration:
  Host: %s
  Port: %s  
  User: %s
  Database: %s
  SSL Mode: %s

Environment Variables (optional):
  TEST_DATABASE_URL - Complete database URL
  TEST_DB_HOST - Database host (default: localhost)
  TEST_DB_PORT - Database port (default: 5432)
  TEST_DB_USER - Database user (default: postgres)
  TEST_DB_PASSWORD - Database password (default: password)
  TEST_DB_NAME - Database name (default: synkronus_test)
  TEST_DB_SSLMODE - SSL mode (default: disable)

To run integration tests:
1. Ensure PostgreSQL is running
2. Create test database: CREATE DATABASE synkronus_test;
3. Set environment variables or use defaults
4. Run: go test -v ./pkg/sync -run Integration`,
		config.Host, config.Port, config.User, config.DBName, config.SSLMode)
}
