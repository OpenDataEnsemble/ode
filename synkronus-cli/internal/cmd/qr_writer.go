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

	qrcode "github.com/yeqown/go-qrcode/v2"
)

//go:embed qr_logo.png
var defaultQRLogoBytes []byte

// pngWriter implements qrcode.Writer using only Go standard library image packages.
type pngWriter struct {
	file       *os.File
	logo       image.Image
	blockWidth int
	padding    int
}

// newPNGWriter creates a new pngWriter that outputs to the given file path.
func newPNGWriter(filename string, logo image.Image) (*pngWriter, error) {
	f, err := os.OpenFile(filename, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to create output file: %w", err)
	}
	return &pngWriter{
		file:       f,
		logo:       logo,
		blockWidth: 20,
		padding:    40,
	}, nil
}

// Write generates the PNG image from the matrix and encodes it into the file.
func (w *pngWriter) Write(mat qrcode.Matrix) error {
	if w.file == nil {
		return fmt.Errorf("output file is not open")
	}
	img := renderQRImage(mat, w.blockWidth, w.padding, w.logo)
	return png.Encode(w.file, img)
}

// Close closes the underlying file handle.
func (w *pngWriter) Close() error {
	if w.file != nil {
		err := w.file.Close()
		w.file = nil
		return err
	}
	return nil
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
		if logoW > 0 && logoH > 0 && logoW <= imgW && logoH <= imgH {
			x0 := (imgW - logoW) / 2
			y0 := (imgH - logoH) / 2
			rect := image.Rect(x0, y0, x0+logoW, y0+logoH)
			draw.Draw(img, rect, logo, bounds.Min, draw.Over)
		}
	}

	return img
}

// loadQRLogo attempts to load the logo from the specified path, falling back to embedded default.
func loadQRLogo(logoPath string) (image.Image, error) {
	if logoPath != "" {
		if f, err := os.Open(logoPath); err == nil {
			defer f.Close()
			if img, err := png.Decode(f); err == nil {
				return img, nil
			}
		}
	}

	if len(defaultQRLogoBytes) > 0 {
		img, err := png.Decode(bytes.NewReader(defaultQRLogoBytes))
		if err != nil {
			return nil, fmt.Errorf("failed to decode embedded logo: %w", err)
		}
		return img, nil
	}

	return nil, nil
}
