package attachment

import (
	"bytes"
	"image"
	"image/draw"
	"image/jpeg"
	"image/png"
	"math"

	"github.com/rwcarlsen/goexif/exif"
	xdraw "golang.org/x/image/draw"
)

type imageProcessOptions struct {
	CompressionLevel     int
	MaxWidthPx           int
	MaxHeightPx          int
	ApplyExifOrientation bool
}

type imageProcessResult struct {
	Data        []byte
	ContentType string
	Processed   bool
}

func processImageForStorage(raw []byte, opts imageProcessOptions) (imageProcessResult, error) {
	if !shouldAttemptImageProcessing(opts) {
		return imageProcessResult{Processed: false}, nil
	}

	img, format, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return imageProcessResult{Processed: false}, nil
	}
	if format != "jpeg" && format != "png" {
		return imageProcessResult{Processed: false}, nil
	}

	processed := img
	didTransform := false

	if opts.ApplyExifOrientation {
		if orient, ok := readExifOrientation(raw); ok {
			if oriented, changed := applyExifOrientation(processed, orient); changed {
				processed = oriented
				didTransform = true
			}
		}
	}

	if resized, changed := resizeToFitBounds(processed, opts.MaxWidthPx, opts.MaxHeightPx); changed {
		processed = resized
		didTransform = true
	}

	if opts.CompressionLevel <= 0 && !didTransform {
		return imageProcessResult{Processed: false}, nil
	}

	encoded, contentType, err := encodeImage(processed, format, opts.CompressionLevel)
	if err != nil {
		return imageProcessResult{}, err
	}

	return imageProcessResult{
		Data:        encoded,
		ContentType: contentType,
		Processed:   true,
	}, nil
}

func shouldAttemptImageProcessing(opts imageProcessOptions) bool {
	return opts.CompressionLevel > 0 || opts.MaxWidthPx > 0 || opts.MaxHeightPx > 0 || opts.ApplyExifOrientation
}

func encodeImage(img image.Image, format string, compressionLevel int) ([]byte, string, error) {
	var buf bytes.Buffer
	switch format {
	case "jpeg":
		quality := jpegQualityForLevel(compressionLevel)
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: quality}); err != nil {
			return nil, "", err
		}
		return buf.Bytes(), "image/jpeg", nil
	case "png":
		enc := png.Encoder{CompressionLevel: pngCompressionForLevel(compressionLevel)}
		if err := enc.Encode(&buf, img); err != nil {
			return nil, "", err
		}
		return buf.Bytes(), "image/png", nil
	default:
		return nil, "", image.ErrFormat
	}
}

func jpegQualityForLevel(level int) int {
	if level < 0 {
		level = 0
	}
	if level > 10 {
		level = 10
	}
	return 95 - (level * 5)
}

func pngCompressionForLevel(level int) png.CompressionLevel {
	switch {
	case level >= 8:
		return png.BestCompression
	case level >= 4:
		return png.DefaultCompression
	case level >= 1:
		return png.BestSpeed
	default:
		return png.DefaultCompression
	}
}

func resizeToFitBounds(src image.Image, maxWidth, maxHeight int) (image.Image, bool) {
	b := src.Bounds()
	w := b.Dx()
	h := b.Dy()
	if w <= 0 || h <= 0 {
		return src, false
	}

	scale := 1.0
	if maxWidth > 0 {
		scale = math.Min(scale, float64(maxWidth)/float64(w))
	}
	if maxHeight > 0 {
		scale = math.Min(scale, float64(maxHeight)/float64(h))
	}
	if scale >= 1.0 {
		return src, false
	}

	newW := int(math.Round(float64(w) * scale))
	newH := int(math.Round(float64(h) * scale))
	if newW < 1 {
		newW = 1
	}
	if newH < 1 {
		newH = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)
	return dst, true
}

func readExifOrientation(raw []byte) (int, bool) {
	x, err := exif.Decode(bytes.NewReader(raw))
	if err != nil {
		return 1, false
	}
	tag, err := x.Get(exif.Orientation)
	if err != nil {
		return 1, false
	}
	value, err := tag.Int(0)
	if err != nil {
		return 1, false
	}
	if value < 1 || value > 8 {
		return 1, false
	}
	return value, true
}

func applyExifOrientation(src image.Image, orientation int) (image.Image, bool) {
	switch orientation {
	case 2:
		return flipHorizontal(src), true
	case 3:
		return rotate180(src), true
	case 4:
		return flipVertical(src), true
	case 5:
		return rotate90CCW(flipHorizontal(src)), true
	case 6:
		return rotate90CW(src), true
	case 7:
		return rotate90CW(flipHorizontal(src)), true
	case 8:
		return rotate90CCW(src), true
	default:
		return src, false
	}
}

func rotate90CW(src image.Image) image.Image {
	b := src.Bounds()
	w := b.Dx()
	h := b.Dy()
	dst := image.NewRGBA(image.Rect(0, 0, h, w))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			dst.Set(h-1-y, x, src.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	return dst
}

func rotate90CCW(src image.Image) image.Image {
	b := src.Bounds()
	w := b.Dx()
	h := b.Dy()
	dst := image.NewRGBA(image.Rect(0, 0, h, w))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			dst.Set(y, w-1-x, src.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	return dst
}

func rotate180(src image.Image) image.Image {
	return flipVertical(flipHorizontal(src))
}

func flipHorizontal(src image.Image) image.Image {
	b := src.Bounds()
	w := b.Dx()
	h := b.Dy()
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			dst.Set(w-1-x, y, src.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	return dst
}

func flipVertical(src image.Image) image.Image {
	b := src.Bounds()
	w := b.Dx()
	h := b.Dy()
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			dst.Set(x, h-1-y, src.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	return dst
}
