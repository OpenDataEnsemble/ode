package config

import (
	"path/filepath"
	"testing"
)

func TestIsGoToolchainEphemeralExeDir(t *testing.T) {
	t.Parallel()
	cases := []struct {
		dir  string
		want bool
	}{
		{"/tmp/go-build1234567890", true},
		{`C:\Users\x\AppData\Local\Temp\go-build123\exe`, true},
		{"/opt/synkronus", false},
		{"/app", false},
	}
	for _, tc := range cases {
		got := isGoToolchainEphemeralExeDir(tc.dir)
		if got != tc.want {
			t.Errorf("isGoToolchainEphemeralExeDir(%q) = %v, want %v", tc.dir, got, tc.want)
		}
	}
}

func TestResolvedMutableDataDir_AbsoluteAndSuffix(t *testing.T) {
	t.Parallel()
	dir, err := resolvedMutableDataDir()
	if err != nil {
		t.Fatal(err)
	}
	if !filepath.IsAbs(dir) {
		t.Fatalf("expected absolute path, got %q", dir)
	}
	if filepath.Base(dir) != "data" {
		t.Fatalf("expected final path segment \"data\", got %q", dir)
	}
}
