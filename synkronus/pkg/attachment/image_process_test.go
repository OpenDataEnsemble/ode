package attachment

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"

	"errors"
)

func TestJpegQualityForLevel(t *testing.T) {
	if q := jpegQualityForLevel(0); q != 95 {
		t.Fatalf("level 0 quality = %d", q)
	}
	if q := jpegQualityForLevel(10); q != 45 {
		t.Fatalf("level 10 quality = %d", q)
	}
	if jpegQualityForLevel(2) >= jpegQualityForLevel(1) {
		t.Fatal("expected decreasing quality with higher compression level")
	}
}

func TestProcessImageForStorage_PassThroughUnsupported(t *testing.T) {
	res, err := processImageForStorage([]byte("not an image"), imageProcessOptions{
		CompressionLevel: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Processed {
		t.Fatal("expected unsupported input to pass through")
	}
}

func TestProcessImageForStorage_JpegCompression(t *testing.T) {
	raw := mustEncodeJPEG(t, makeNoisyImage(320, 240), 95)
	res, err := processImageForStorage(raw, imageProcessOptions{
		CompressionLevel: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Processed {
		t.Fatal("expected jpeg to be processed")
	}
	if res.ContentType != "image/jpeg" {
		t.Fatalf("unexpected content-type: %s", res.ContentType)
	}
}

func TestProcessImageForStorage_MaxBoxDownscale(t *testing.T) {
	raw := mustEncodePNG(t, makeNoisyImage(400, 200))
	res, err := processImageForStorage(raw, imageProcessOptions{
		MaxWidthPx:  100,
		MaxHeightPx: 100,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Processed {
		t.Fatal("expected png to be processed")
	}
	img, _, err := image.Decode(bytes.NewReader(res.Data))
	if err != nil {
		t.Fatal(err)
	}
	if img.Bounds().Dx() != 100 || img.Bounds().Dy() != 50 {
		t.Fatalf("unexpected downscaled dimensions: %dx%d", img.Bounds().Dx(), img.Bounds().Dy())
	}
}

func TestProcessImageForStorageRejectsExcessiveDecodedDimensions(t *testing.T) {
	raw := mustEncodePNG(t, makeNoisyImage(10, 10))
	_, err := processImageForStorage(raw, imageProcessOptions{
		CompressionLevel: 1,
		MaxDimensionPx:   5,
		MaxPixels:        25,
	})
	if !errors.Is(err, ErrAttachmentTooLarge) {
		t.Fatalf("expected decoded image limit error, got %v", err)
	}
}

func TestApplyExifOrientation_Rotate90CW(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 2, 3))
	out, changed := applyExifOrientation(src, 6)
	if !changed {
		t.Fatal("expected orientation transform")
	}
	if out.Bounds().Dx() != 3 || out.Bounds().Dy() != 2 {
		t.Fatalf("unexpected rotated dimensions: %dx%d", out.Bounds().Dx(), out.Bounds().Dy())
	}
}

func makeNoisyImage(w, h int) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{
				R: uint8((x*31 + y*17) % 255),
				G: uint8((x*11 + y*13) % 255),
				B: uint8((x*7 + y*19) % 255),
				A: 255,
			})
		}
	}
	return img
}

func mustEncodeJPEG(t *testing.T, img image.Image, quality int) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func mustEncodePNG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}
