package attachment

import (
	"archive/zip"
	"bytes"
	"context"
	"io"
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
