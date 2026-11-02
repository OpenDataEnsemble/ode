package cmd

import (
	"bytes"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"

	qrcode "github.com/yeqown/go-qrcode/v2"
)

func TestEncodeFRMLS(t *testing.T) {
	encoded := encodeFRMLS(1, "https://demo.synkronus.org", "testuser", "secret")
	if !strings.HasPrefix(encoded, "FRMLS:") {
		t.Fatalf("expected FRMLS: prefix, got %q", encoded)
	}
	if !strings.HasSuffix(encoded, ";;") {
		t.Fatalf("expected ;; suffix, got %q", encoded)
	}
	if !strings.Contains(encoded, "v:") || !strings.Contains(encoded, "s:") ||
		!strings.Contains(encoded, "u:") || !strings.Contains(encoded, "p:") {
		t.Fatalf("missing required FRMLS fields in %q", encoded)
	}
}

func TestDeriveOutputFilename(t *testing.T) {
	tests := []struct {
		url      string
		expected string
	}{
		{"", "formulus-qr.png"},
		{"https://example.com", "example.com.png"},
		{"https://example.com/api/v1", "example.com_api_v1.png"},
		{"http://localhost:8080/sync", "localhost_sync.png"},
	}

	for _, tt := range tests {
		got := deriveOutputFilename(tt.url)
		if got != tt.expected {
			t.Errorf("deriveOutputFilename(%q) = %q, want %q", tt.url, got, tt.expected)
		}
	}
}

func TestLoadQRLogo(t *testing.T) {
	// Test loading embedded logo fallback
	logo, err := loadQRLogo("nonexistent_logo_file.png")
	if err != nil {
		t.Fatalf("loadQRLogo failed: %v", err)
	}
	if logo == nil {
		t.Fatal("expected embedded logo to be loaded, got nil")
	}
	if logo.Bounds().Dx() <= 0 || logo.Bounds().Dy() <= 0 {
		t.Fatalf("invalid logo dimensions: %v", logo.Bounds())
	}
}

func TestPNGWriterGeneratesValidPNG(t *testing.T) {
	tmpDir := t.TempDir()
	outPath := filepath.Join(tmpDir, "test_qr.png")

	encoded := encodeFRMLS(1, "https://example.com", "testuser", "testpass")
	qrc, err := qrcode.New(encoded)
	if err != nil {
		t.Fatalf("failed to create QR code: %v", err)
	}

	logo, err := loadQRLogo("")
	if err != nil {
		t.Fatalf("failed to load logo: %v", err)
	}

	writer, err := newPNGWriter(outPath, logo)
	if err != nil {
		t.Fatalf("failed to create PNG writer: %v", err)
	}

	if err := qrc.Save(writer); err != nil {
		t.Fatalf("failed to save QR code: %v", err)
	}

	data, err := os.ReadFile(outPath)
	if err != nil {
		t.Fatalf("failed to read output file: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("output file is empty")
	}

	// Verify it's a valid PNG
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("output is not a valid PNG: %v", err)
	}

	bounds := img.Bounds()
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 {
		t.Fatalf("invalid image bounds: %v", bounds)
	}

	// Dimension should be mat.Width()*20 + 80
	expectedDim := qrc.Dimension()*20 + 80
	if bounds.Dx() != expectedDim || bounds.Dy() != expectedDim {
		t.Errorf("expected image dimension %dx%d, got %dx%d", expectedDim, expectedDim, bounds.Dx(), bounds.Dy())
	}
}
