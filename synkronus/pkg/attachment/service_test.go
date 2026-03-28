package attachment

import (
	"archive/zip"
	"bytes"
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/opendataensemble/synkronus/pkg/config"
)

func TestService_WriteZip(t *testing.T) {
	dir := t.TempDir()
	cfg := &config.Config{DataDir: dir}
	svc, err := NewService(cfg)
	if err != nil {
		t.Fatal(err)
	}

	if err := svc.Save(context.Background(), "sub/file.txt", bytes.NewReader([]byte("hello"))); err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	if err := svc.WriteZip(context.Background(), &buf, []string{"sub/file.txt"}); err != nil {
		t.Fatal(err)
	}

	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatal(err)
	}
	if len(zr.File) != 1 || zr.File[0].Name != "sub/file.txt" {
		t.Fatalf("unexpected zip: %+v", zr.File)
	}
	rc, err := zr.File[0].Open()
	if err != nil {
		t.Fatal(err)
	}
	defer rc.Close()
	body, err := io.ReadAll(rc)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "hello" {
		t.Fatalf("content %q", body)
	}
}

func Test_zipEntryNameForAttachment(t *testing.T) {
	if zipEntryNameForAttachment(`a\b`) != "a/b" {
		t.Fatal()
	}
	if zipEntryNameForAttachment(`../x`) == "../x" {
		t.Fatal("expected sanitization")
	}
}

func TestService_WriteZip_missingFile(t *testing.T) {
	dir := t.TempDir()
	cfg := &config.Config{DataDir: dir}
	svc, err := NewService(cfg)
	if err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	err = svc.WriteZip(context.Background(), &buf, []string{"nope"})
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestService_SaveUpload_CompressedStoresOriginalAndExportUsesOriginal(t *testing.T) {
	dir := t.TempDir()
	cfg := &config.Config{
		DataDir:                   dir,
		ImageCompressionLevel:     10,
		ImageApplyExifOrientation: true,
	}
	svc, err := NewService(cfg)
	if err != nil {
		t.Fatal(err)
	}

	raw := mustEncodeTestJPEG(t, makeTestImage(320, 240), 95)
	result, err := svc.SaveUpload(context.Background(), "photos/cam.jpg", raw, "image/jpeg")
	if err != nil {
		t.Fatal(err)
	}
	if result.ServedSize <= 0 {
		t.Fatalf("unexpected served size: %d", result.ServedSize)
	}

	processedPath := filepath.Join(dir, "attachments", "photos", "cam.jpg")
	originalPath := filepath.Join(dir, "attachments_uncompressed", "photos", "cam.jpg")

	processedBytes, err := os.ReadFile(processedPath)
	if err != nil {
		t.Fatal(err)
	}
	originalBytes, err := os.ReadFile(originalPath)
	if err != nil {
		t.Fatal(err)
	}
	if len(processedBytes) >= len(originalBytes) {
		t.Fatalf("expected processed bytes to be smaller than original, got %d >= %d", len(processedBytes), len(originalBytes))
	}

	var buf bytes.Buffer
	if err := svc.WriteZip(context.Background(), &buf, []string{"photos/cam.jpg"}); err != nil {
		t.Fatal(err)
	}
	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatal(err)
	}
	rc, err := zr.File[0].Open()
	if err != nil {
		t.Fatal(err)
	}
	defer rc.Close()
	zipped, err := io.ReadAll(rc)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(zipped, originalBytes) {
		t.Fatal("expected export zip to stream original bytes")
	}
}

func TestService_SaveUpload_FallbackWithoutOriginal(t *testing.T) {
	dir := t.TempDir()
	cfg := &config.Config{DataDir: dir}
	svc, err := NewService(cfg)
	if err != nil {
		t.Fatal(err)
	}

	data := []byte("plain data")
	result, err := svc.SaveUpload(context.Background(), "notes/a.txt", data, "text/plain")
	if err != nil {
		t.Fatal(err)
	}
	if result.ServedContentType == "" {
		t.Fatal("expected content type")
	}

	originalPath := filepath.Join(dir, "attachments_uncompressed", "notes", "a.txt")
	if _, err := os.Stat(originalPath); !os.IsNotExist(err) {
		t.Fatalf("expected no original file, got err=%v", err)
	}

	rc, err := svc.OpenForDownload(context.Background(), "notes/a.txt", true)
	if err != nil {
		t.Fatal(err)
	}
	defer rc.Close()
	body, err := io.ReadAll(rc)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "plain data" {
		t.Fatalf("unexpected body: %q", body)
	}
}

func makeTestImage(w, h int) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{
				R: uint8((x*33 + y*17) % 255),
				G: uint8((x*11 + y*29) % 255),
				B: uint8((x*7 + y*13) % 255),
				A: 255,
			})
		}
	}
	return img
}

func mustEncodeTestJPEG(t *testing.T, img image.Image, quality int) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}
