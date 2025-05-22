//go:build tools
// +build tools

// Package tools tracks dependencies for tools used in the build process.
// To install the tools, run `go mod tidy`
package tools

import (
	_ "github.com/swaggo/swag/cmd/swag"
)
