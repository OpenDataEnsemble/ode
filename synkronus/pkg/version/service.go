package version

import (
	"context"
	"database/sql"
	"runtime"
)

// Service provides version information
type Service interface {
	// GetVersion returns version and system information
	GetVersion(ctx context.Context) (*SystemVersionInfo, error)
}

type service struct {
	db *sql.DB
}

// NewService creates a new version service
func NewService(db *sql.DB) Service {
	return &service{db: db}
}

// SystemVersionInfo holds version and system information
type SystemVersionInfo struct {
	Server   ServerInfo   `json:"server"`
	Database DatabaseInfo `json:"database,omitempty"`
	System   SystemInfo   `json:"system"`
	Build    BuildInfo    `json:"build"`
}

type ServerInfo struct {
	Version string `json:"version"`
}

type DatabaseInfo struct {
	Type         string `json:"type"`
	Version      string `json:"version,omitempty"`
	DatabaseName string `json:"database_name,omitempty"`
}

type SystemInfo struct {
	OS           string `json:"os"`
	Architecture string `json:"architecture"`
	CPUs         int    `json:"cpus"`
}

type BuildInfo struct {
	Commit    string `json:"commit,omitempty"`
	BuildTime string `json:"build_time,omitempty"`
	GoVersion string `json:"go_version"`
}

// These will be set during build using -ldflags
var (
	version   = "dev"
	commit    = ""
	buildTime = ""
)

// GetVersion returns version and system information
func (s *service) GetVersion(ctx context.Context) (*SystemVersionInfo, error) {
	// Get database info
	dbInfo := DatabaseInfo{
		Type: "postgresql",
	}

	// Try to get PostgreSQL version
	if s.db != nil {
		var version string
		err := s.db.QueryRowContext(ctx, "SELECT version();").Scan(&version)
		if err == nil {
			dbInfo.Version = version
		}

		// Get database name if available
		err = s.db.QueryRowContext(ctx, "SELECT current_database();").Scan(&dbInfo.DatabaseName)
		if err != nil {
			// If we can't get the database name, just leave it empty
			dbInfo.DatabaseName = ""
		}
	}

	// Prepare response
	info := &SystemVersionInfo{
		Server: ServerInfo{
			Version: version,
		},
		Database: dbInfo,
		System: SystemInfo{
			OS:           runtime.GOOS,
			Architecture: runtime.GOARCH,
			CPUs:         runtime.NumCPU(),
		},
		Build: BuildInfo{
			Commit:    commit,
			BuildTime: buildTime,
			GoVersion: runtime.Version(),
		},
	}

	return info, nil
}
