package cmd

import (
	"bytes"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	qrcode "github.com/yeqown/go-qrcode/v2"
)

type captureWriter struct {
	mat qrcode.Matrix
}

func (c *captureWriter) Write(m qrcode.Matrix) error {
	c.mat = m
	return nil
}

func (c *captureWriter) Close() error {
	return nil
}

func testMatrix(t *testing.T, payload string) qrcode.Matrix {
	t.Helper()
	qrc, err := qrcode.New(payload)
	if err != nil {
		t.Fatalf("failed to create QR code: %v", err)
	}
	cw := &captureWriter{}
	if err := qrc.Save(cw); err != nil {
		t.Fatalf("failed to save matrix: %v", err)
	}
	return cw.mat
}

func TestEncodeFRMLS(t *testing.T) {
	// Compare against exact output produced by Formulus generateQR.ts
	// including passwords with ;, :, \ and non-ASCII UTF-8 characters.
	tests := []struct {
		name      string
		version   int
		serverURL string
		username  string
		password  string
		expected  string
	}{
		{
			name:      "standard inputs",
			version:   1,
			serverURL: "https://example.com",
			username:  "testuser",
			password:  "testpass",
			expected:  "FRMLS:v:MQ==;s:aHR0cHM6Ly9leGFtcGxlLmNvbQ==;u:dGVzdHVzZXI=;p:dGVzdHBhc3M=;;",
		},
		{
			name:      "special characters and non-ASCII",
			version:   1,
			serverURL: "https://demo.synkronus.org/sync",
			username:  "admin",
			password:  "p@$$:w;o\\rd—ü",
			expected:  "FRMLS:v:MQ==;s:aHR0cHM6Ly9kZW1vLnN5bmtyb251cy5vcmcvc3luYw==;u:YWRtaW4=;p:cEAkJDp3O29ccmTigJTDvA==;;",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := encodeFRMLS(tt.version, tt.serverURL, tt.username, tt.password)
			if got != tt.expected {
				t.Fatalf("encodeFRMLS() =\n%q\nwant:\n%q", got, tt.expected)
			}
		})
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
	logo, err := loadQRLogo()
	if err != nil {
		t.Fatalf("loadQRLogo failed: %v", err)
	}
	if logo == nil {
		t.Fatal("expected embedded logo to be loaded, got nil")
	}
	bounds := logo.Bounds()
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 {
		t.Fatalf("invalid logo dimensions: %v", bounds)
	}
}

func TestRenderQRImage_QuietZoneAndFinderPatterns(t *testing.T) {
	mat := testMatrix(t, "https://example.com")
	padding := 40
	blockWidth := 20
	img := renderQRImage(mat, blockWidth, padding, nil)

	white := color.RGBA{R: 255, G: 255, B: 255, A: 255}
	black := color.RGBA{R: 0, G: 0, B: 0, A: 255}

	// Quiet zone: pixel (0, 0) is in the quiet border and must be white
	if got := img.At(0, 0); got != white {
		t.Errorf("quiet zone pixel (0,0) = %v, want white %v", got, white)
	}

	// Centre of top-left finder pattern corner module: (padding + 10, padding + 10)
	if got := img.At(padding+10, padding+10); got != black {
		t.Errorf("top-left corner module center = %v, want black %v", got, black)
	}

	// Centre of top-right finder pattern corner module
	trX := padding + (mat.Width()-1)*blockWidth + blockWidth/2
	trY := padding + blockWidth/2
	if got := img.At(trX, trY); got != black {
		t.Errorf("top-right corner module center = %v, want black %v", got, black)
	}

	// Centre of bottom-left finder pattern corner module
	blX := padding + blockWidth/2
	blY := padding + (mat.Height()-1)*blockWidth + blockWidth/2
	if got := img.At(blX, blY); got != black {
		t.Errorf("bottom-left corner module center = %v, want black %v", got, black)
	}
}

func TestRenderQRImage_LogoDrawnOnLargeCode(t *testing.T) {
	// Long payload produces an image large enough for the logo (>= 900px wide and high)
	longPayload := strings.Repeat("https://synkronus.example.com/very/long/observation/path/data/collection/payload/string/here/", 10)
	mat := testMatrix(t, longPayload)
	logo, err := loadQRLogo()
	if err != nil {
		t.Fatalf("failed to load logo: %v", err)
	}

	img := renderQRImage(mat, 20, 40, logo)
	bounds := img.Bounds()
	if bounds.Dx() < 900 || bounds.Dy() < 900 {
		t.Fatalf("expected image dimension >= 900, got %dx%d", bounds.Dx(), bounds.Dy())
	}

	centerX := bounds.Dx() / 2
	centerY := bounds.Dy() / 2

	logoBounds := logo.Bounds()
	expectedLogoCenter := logo.At(logoBounds.Min.X+logoBounds.Dx()/2, logoBounds.Min.Y+logoBounds.Dy()/2)
	gotCenter := img.At(centerX, centerY)

	r1, g1, b1, a1 := expectedLogoCenter.RGBA()
	r2, g2, b2, a2 := gotCenter.RGBA()
	if r1 != r2 || g1 != g2 || b1 != b2 || a1 != a2 {
		t.Errorf("centre pixel = %v, want logo centre pixel %v", gotCenter, expectedLogoCenter)
	}
}

func TestRenderQRImage_OversizedLogoSkipped(t *testing.T) {
	// Short payload results in an image < 900px, so 180x180 logo must be skipped
	mat := testMatrix(t, "short")
	logo, err := loadQRLogo()
	if err != nil {
		t.Fatalf("failed to load logo: %v", err)
	}

	imgWithLogo := renderQRImage(mat, 20, 40, logo)
	imgWithoutLogo := renderQRImage(mat, 20, 40, nil)

	bounds := imgWithLogo.Bounds()
	if bounds.Dx() >= 900 {
		t.Fatalf("expected short image dimension < 900, got %d", bounds.Dx())
	}

	centerX := bounds.Dx() / 2
	centerY := bounds.Dy() / 2

	// When skipped, center pixel should match the render with no logo
	if imgWithLogo.At(centerX, centerY) != imgWithoutLogo.At(centerX, centerY) {
		t.Errorf("expected logo to be skipped; centre pixel %v != no-logo pixel %v",
			imgWithLogo.At(centerX, centerY), imgWithoutLogo.At(centerX, centerY))
	}
}

func TestPNGWriter_FilePermissions(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("skipping file permission check on Windows")
	}

	tmpDir := t.TempDir()
	outPath := filepath.Join(tmpDir, "perm_test.png")

	mat := testMatrix(t, "https://example.com")
	w := newPNGWriter(outPath, nil)
	if err := w.Write(mat); err != nil {
		t.Fatalf("Write failed: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}
	if err := w.Err(); err != nil {
		t.Fatalf("Err reported failure: %v", err)
	}

	info, err := os.Stat(outPath)
	if err != nil {
		t.Fatalf("Stat failed: %v", err)
	}

	if perm := info.Mode().Perm(); perm != 0600 {
		t.Errorf("expected file permissions 0600, got %o", perm)
	}
}

func TestPNGWriter_NoPartialFileOnFailure(t *testing.T) {
	tmpDir := t.TempDir()
	// Target path in a nonexistent subfolder
	invalidDir := filepath.Join(tmpDir, "nonexistent_dir")
	outPath := filepath.Join(invalidDir, "test.png")

	mat := testMatrix(t, "https://example.com")
	w := newPNGWriter(outPath, nil)
	if err := w.Write(mat); err != nil {
		t.Fatalf("unexpected Write failure: %v", err)
	}

	err := w.Close()
	if err == nil {
		t.Fatal("expected Close to fail for nonexistent directory")
	}
	if wErr := w.Err(); wErr == nil {
		t.Fatal("expected Err() to report error for nonexistent directory")
	}

	if _, statErr := os.Stat(outPath); !os.IsNotExist(statErr) {
		t.Errorf("expected no file at %q, but stat returned %v", outPath, statErr)
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

	logo, err := loadQRLogo()
	if err != nil {
		t.Fatalf("failed to load logo: %v", err)
	}

	writer := newPNGWriter(outPath, logo)

	if err := qrc.Save(writer); err != nil {
		t.Fatalf("failed to save QR code: %v", err)
	}
	if err := writer.Err(); err != nil {
		t.Fatalf("writer reported error: %v", err)
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

	expectedDim := qrc.Dimension()*20 + 80
	if bounds.Dx() != expectedDim || bounds.Dy() != expectedDim {
		t.Errorf("expected image dimension %dx%d, got %dx%d", expectedDim, expectedDim, bounds.Dx(), bounds.Dy())
	}
}
