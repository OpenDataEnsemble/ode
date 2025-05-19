package database

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"time"

	"github.com/collectakit/synkronus/pkg/logger"
	_ "github.com/lib/pq"           // PostgreSQL driver
	_ "github.com/mattn/go-sqlite3" // SQLite driver
	"github.com/pressly/goose/v3"
)

// Config contains database configuration
type Config struct {
	// ConnectionString is the connection string
	ConnectionString string
	// MigrationsFS is the embedded filesystem containing migration files
	MigrationsFS fs.FS
	// MaxOpenConns is the maximum number of open connections
	MaxOpenConns int
	// MaxIdleConns is the maximum number of idle connections
	MaxIdleConns int
	// ConnMaxLifetime is the maximum lifetime of a connection
	ConnMaxLifetime time.Duration
}

// DefaultConfig returns a default configuration
func DefaultConfig() Config {
	return Config{
		ConnectionString: "postgresql://username:password@localhost:5432/default_database",
		MigrationsFS:     nil,
		MaxOpenConns:     10,
		MaxIdleConns:     5,
		ConnMaxLifetime:  time.Hour,
	}
}

// Database represents a database connection
type Database struct {
	db     *sql.DB
	config Config
	log    *logger.Logger
}

// New creates a new database connection
func New(config Config, log *logger.Logger) (*Database, error) {
	// Open database connection
	db, err := sql.Open("postgres", config.ConnectionString)
	if err != nil {
		log.Error("Failed to open database connection", "error", err)
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(config.MaxOpenConns)
	db.SetMaxIdleConns(config.MaxIdleConns)
	db.SetConnMaxLifetime(config.ConnMaxLifetime)

	// Check connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &Database{
		db:     db,
		config: config,
		log:    log,
	}, nil
}

// Close closes the database connection
func (d *Database) Close() error {
	return d.db.Close()
}

// DB returns the underlying sql.DB
func (d *Database) DB() *sql.DB {
	return d.db
}

// Migrate runs database migrations
func (d *Database) Migrate() error {
	d.log.Info("Running database migrations")

	// Set migration provider
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("failed to set goose dialect: %w", err)
	}

	if d.config.MigrationsFS != nil {
		// Run migrations
		goose.SetBaseFS(d.config.MigrationsFS)
		if err := goose.Up(d.db, "."); err != nil {
			return fmt.Errorf("failed to run migrations: %w", err)
		}
	} else {
		return fmt.Errorf("Database migration configuration error: migrationsFS is nil")
	}

	d.log.Info("Database migrations completed")
	return nil
}
