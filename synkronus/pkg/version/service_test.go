package version

import (
	"context"
	"testing"
)

func TestBuildVersion_NonEmpty(t *testing.T) {
	// By default, version is "1.0.0" and overridden via -ldflags in production builds.
	if got := BuildVersion(); got == "" {
		t.Fatalf("BuildVersion() = %q, want non-empty", got)
	}
}

func TestGetVersion_NoDB(t *testing.T) {
	svc := NewService(nil)

	info, err := svc.GetVersion(context.Background())
	if err != nil {
		t.Fatalf("GetVersion() returned error: %v", err)
	}
	if info == nil {
		t.Fatal("GetVersion() returned nil info")
	}

	// Server version in the response should match the package-level version.
	if info.Server.Version != version {
		t.Errorf("Server.Version = %q, want %q", info.Server.Version, version)
	}

	// Database type should be set even when db is nil.
	if info.Database.Type != "postgresql" {
		t.Errorf("Database.Type = %q, want %q", info.Database.Type, "postgresql")
	}

	// Build.GoVersion should be non-empty.
	if info.Build.GoVersion == "" {
		t.Error("Build.GoVersion is empty, want non-empty")
	}
}
