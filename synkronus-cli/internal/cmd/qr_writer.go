package cmd

import (
	"bytes"
	_ "embed"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"os"
	"path/filepath"

	qrcode "github.com/yeqown/go-qrcode/v2"
)

//go:embed qr_logo.png
var defaultQRLogoBytes []byte

// pngWriter implements qrcode.Writer using only Go standard library image packages.
type pngWriter struct {
	path       string
	logo       image.Image
	blockWidth int
	padding    int
	buf        bytes.Buffer
	err        error
}

// newPNGWriter creates a new pngWriter that outputs to the given file path.
func newPNGWriter(path string, logo image.Image) *pngWriter {
	return &pngWriter{
		path:       path,
		logo:       logo,
		blockWidth: 20,
		padding:    40,
	}
}

// Write generates the PNG image from the matrix and encodes it into an in-memory buffer.
func (w *pngWriter) Write(mat qrcode.Matrix) error {
	img := renderQRImage(mat, w.blockWidth, w.padding, w.logo)
	if err := png.Encode(&w.buf, img); err != nil {
		w.err = fmt.Errorf("failed to encode PNG: %w", err)
	}
	return w.err
}

// Close writes the buffered image to a private file.
func (w *pngWriter) Close() error {
	if w.err == nil {
		w.err = writeFilePrivate(w.path, w.buf.Bytes())
	}
	return w.err
}

// Err reports any write error. qrcode.Save only logs Close errors.
func (w *pngWriter) Err() error {
	return w.err
}

// writeFilePrivate writes data to path with mode 0600, via a temp file
// in the same folder, so a failed write never leaves a partial file.
func writeFilePrivate(path string, data []byte) (err error) {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".synk-qr-*.png")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpName := tmp.Name()
	defer func() {
		if err != nil {
			_ = os.Remove(tmpName)
		}
	}()

	if _, err = tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("failed to write QR image: %w", err)
	}
	if err = tmp.Sync(); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("failed to flush QR image: %w", err)
	}
	if err = tmp.Close(); err != nil {
		return fmt.Errorf("failed to close QR image: %w", err)
	}
	return os.Rename(tmpName, path)
}

// renderQRImage renders the QR matrix as an RGBA image with an optional centered logo.
func renderQRImage(mat qrcode.Matrix, blockWidth, padding int, logo image.Image) image.Image {
	if blockWidth <= 0 {
		blockWidth = 20
	}
	if padding < 0 {
		padding = 40
	}

	matW := mat.Width()
	matH := mat.Height()
	imgW := matW*blockWidth + 2*padding
	imgH := matH*blockWidth + 2*padding

	img := image.NewRGBA(image.Rect(0, 0, imgW, imgH))

	// Fill white background
	white := color.RGBA{R: 255, G: 255, B: 255, A: 255}
	draw.Draw(img, img.Bounds(), &image.Uniform{C: white}, image.Point{}, draw.Src)

	// Draw QR modules
	black := color.RGBA{R: 0, G: 0, B: 0, A: 255}
	blackUniform := &image.Uniform{C: black}
	bitmap := mat.Bitmap()

	for y := 0; y < matH; y++ {
		for x := 0; x < matW; x++ {
			if bitmap[y][x] {
				x0 := padding + x*blockWidth
				y0 := padding + y*blockWidth
				rect := image.Rect(x0, y0, x0+blockWidth, y0+blockWidth)
				draw.Draw(img, rect, blackUniform, image.Point{}, draw.Src)
			}
		}
	}

	// Composite centered logo if provided
	if logo != nil {
		bounds := logo.Bounds()
		logoW := bounds.Dx()
		logoH := bounds.Dy()
		// Match writer/standard: only draw the logo if it is at most 1/5 of the image.
		const logoSizeMultiplier = 5
		if logoW > 0 && logoH > 0 && logoW*logoSizeMultiplier <= imgW && logoH*logoSizeMultiplier <= imgH {
			x0 := (imgW - logoW) / 2
			y0 := (imgH - logoH) / 2
			rect := image.Rect(x0, y0, x0+logoW, y0+logoH)
			draw.Draw(img, rect, logo, bounds.Min, draw.Over)
		}
	}

	return img
}

// loadQRLogo decodes the embedded default logo.
func loadQRLogo() (image.Image, error) {
	img, err := png.Decode(bytes.NewReader(defaultQRLogoBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to decode embedded logo: %w", err)
	}
	return img, nil
}
