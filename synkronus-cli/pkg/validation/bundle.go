package validation

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
)

var (
	ErrInvalidStructure         = errors.New("invalid app bundle structure")
	ErrMissingAppIndex          = errors.New("missing app/index.html")
	ErrInvalidFormStructure     = errors.New("invalid form structure")
	ErrInvalidRendererStructure = errors.New("invalid renderer structure")
	ErrMissingRendererReference = errors.New("missing renderer reference")
	ErrInvalidJSON              = errors.New("invalid JSON")
)

// ValidateBundle validates the structure and content of an app bundle ZIP file
func ValidateBundle(bundlePath string) error {
	// Open the ZIP file
	zipFile, err := zip.OpenReader(bundlePath)
	if err != nil {
		return fmt.Errorf("failed to open bundle: %w", err)
	}
	defer zipFile.Close()

	// Track required top-level directories
	hasAppDir := false
	topDirs := make(map[string]bool)
	formDirs := make(map[string]struct{})

	// First pass: validate top-level structure and collect form directories
	for _, file := range zipFile.File {
		// Get the top-level directory
		parts := strings.SplitN(file.Name, "/", 2)
		if len(parts) == 0 {
			continue
		}

		topDir := parts[0]
		if topDir == "app" || topDir == "forms" || topDir == "renderers" {
			topDirs[topDir] = true
		} else if topDir != "" {
			return fmt.Errorf("%w: unexpected top-level directory '%s'", ErrInvalidStructure, topDir)
		}

		// Check for app/index.html
		if file.Name == "app/index.html" {
			hasAppDir = true
		}

		// Track form directories
		if strings.HasPrefix(file.Name, "forms/") && !strings.HasSuffix(file.Name, "/") {
			formParts := strings.Split(file.Name, "/")
			if len(formParts) >= 2 {
				formDirs[formParts[1]] = struct{}{}
			}
		}
	}

	// Ensure we have the required app directory with index.html
	if !hasAppDir {
		return ErrMissingAppIndex
	}

	// Second pass: validate forms and renderers structure
	hasFormSchema := make(map[string]bool)
	hasFormUI := make(map[string]bool)

	for _, file := range zipFile.File {
		// Validate form structure
		if strings.HasPrefix(file.Name, "forms/") {
			if err := validateFormFile(file); err != nil {
				return err
			}

			// Track which forms have schema.json and ui.json
			parts := strings.Split(file.Name, "/")
			if len(parts) >= 3 {
				formName := parts[1]
				switch parts[2] {
				case "schema.json":
					hasFormSchema[formName] = true
					// Validate JSON
					if err := validateJSONFile(file); err != nil {
						return fmt.Errorf("invalid JSON in form schema %s: %w", file.Name, err)
					}
				case "ui.json":
					hasFormUI[formName] = true
					// Validate JSON
					if err := validateJSONFile(file); err != nil {
						return fmt.Errorf("invalid JSON in form UI %s: %w", file.Name, err)
					}
				}
			}
		} else if strings.HasPrefix(file.Name, "renderers/") {
			if err := validateRendererFile(file); err != nil {
				return err
			}
		}
	}

	// Verify each form directory has both schema.json and ui.json (server requires both)
	for formDir := range formDirs {
		if !hasFormSchema[formDir] || !hasFormUI[formDir] {
			return fmt.Errorf("%w: form '%s' is missing required files (schema.json or ui.json)", ErrInvalidFormStructure, formDir)
		}
	}

	// Third pass: validate form references to renderers
	return validateFormRendererReferences(&zipFile.Reader)
}

// validateFormFile validates a single form file
func validateFormFile(file *zip.File) error {
	// Skip directories
	if file.FileInfo().IsDir() {
		return nil
	}

	// Expected path format: forms/{formName}/schema.json or forms/{formName}/ui.json
	parts := strings.Split(file.Name, "/")
	if len(parts) != 3 || (parts[2] != "schema.json" && parts[2] != "ui.json") {
		return fmt.Errorf("%w: invalid form file path: %s", ErrInvalidFormStructure, file.Name)
	}

	return nil
}

// validateRendererFile validates a single renderer file
func validateRendererFile(file *zip.File) error {
	// Skip directories
	if file.FileInfo().IsDir() {
		return nil
	}

	// Expected path format: renderers/{rendererName}/renderer.jsx
	parts := strings.Split(file.Name, "/")
	if len(parts) != 3 || parts[2] != "renderer.jsx" {
		return fmt.Errorf("%w: invalid renderer file path: %s (expected renderers/{name}/renderer.jsx)", ErrInvalidRendererStructure, file.Name)
	}

	return nil
}

// validateFormRendererReferences validates that all renderer references in forms exist
func validateFormRendererReferences(zipReader *zip.Reader) error {
	// Build a set of available renderers
	availableRenderers := make(map[string]bool)

	// First, collect all available renderers
	for _, file := range zipReader.File {
		if strings.HasPrefix(file.Name, "renderers/") && strings.HasSuffix(file.Name, "/renderer.jsx") {
			parts := strings.Split(file.Name, "/")
			if len(parts) == 3 {
				availableRenderers[parts[1]] = true
			}
		}
	}

	// Then check all form schemas for renderer references
	for _, file := range zipReader.File {
		if strings.HasSuffix(file.Name, "schema.json") {
			// Open the file
			f, err := file.Open()
			if err != nil {
				return fmt.Errorf("failed to open form schema: %w", err)
			}

			// Parse the schema
			var schema map[string]interface{}
			err = json.NewDecoder(f).Decode(&schema)
			f.Close() // Close the file immediately after reading
			if err != nil {
				return fmt.Errorf("failed to parse form schema: %w", err)
			}

			// Check for renderer references in the schema
			if err := checkRendererReferences(schema, availableRenderers); err != nil {
				return fmt.Errorf("%w: %v", ErrMissingRendererReference, err)
			}
		}
	}

	return nil
}

// builtInRenderers is a slice of standard JSONForms renderers that don't need to be defined in the bundle
var builtInRenderers = []string{
	// Basic controls
	"text", "number", "integer", "boolean", "date", "time", "datetime", "range",
	// Selection controls
	"select", "combo", "radio", "checkbox", "toggle",
	// Layout
	"group", "categorization", "category",
	// Specialized controls
	"multiselect", "textarea", "slider", "rating",
	// Built-in aliases (test support)
	"builtin-text",
	// formulus controls
	"image", "signature", "audio", "video", "file", "qrcode",
}

// isBuiltInRenderer checks if a renderer type is a built-in renderer
func isBuiltInRenderer(rendererType string) bool {
	for _, builtIn := range builtInRenderers {
		if builtIn == rendererType {
			return true
		}
	}
	return false
}

// checkRendererReferences recursively checks for renderer references in the schema
func checkRendererReferences(data interface{}, availableRenderers map[string]bool) error {
	switch v := data.(type) {
	case map[string]interface{}:
		// Check for renderer type (both x-renderer and rendererType formats)
		if rendererType, ok := v["x-renderer"].(string); ok {
			if !availableRenderers[rendererType] && !isBuiltInRenderer(rendererType) {
				return fmt.Errorf("references non-existent renderer '%s' (x-renderer)", rendererType)
			}
		}
		if rendererType, ok := v["rendererType"].(string); ok {
			if !availableRenderers[rendererType] && !isBuiltInRenderer(rendererType) {
				return fmt.Errorf("references non-existent renderer '%s' (rendererType)", rendererType)
			}
		}
		if rendererType, ok := v["x-question-type"].(string); ok {
			if !availableRenderers[rendererType] && !isBuiltInRenderer(rendererType) {
				return fmt.Errorf("references non-existent renderer '%s' (x-question-type)", rendererType)
			}
		}

		// Recursively check nested objects
		for _, value := range v {
			if err := checkRendererReferences(value, availableRenderers); err != nil {
				return err
			}
		}

	case []interface{}:
		// Recursively check array elements
		for _, item := range v {
			if err := checkRendererReferences(item, availableRenderers); err != nil {
				return err
			}
		}
	}

	return nil
}

// validateJSONFile validates that a file contains valid JSON
func validateJSONFile(file *zip.File) error {
	rc, err := file.Open()
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer rc.Close()

	var jsonData interface{}
	decoder := json.NewDecoder(rc)
	if err := decoder.Decode(&jsonData); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidJSON, err)
	}

	return nil
}

// GetBundleInfo returns basic information about the bundle
func GetBundleInfo(bundlePath string) (map[string]interface{}, error) {
	info := make(map[string]interface{})

	// Get file size
	fileInfo, err := os.Stat(bundlePath)
	if err != nil {
		return nil, err
	}
	info["size"] = fileInfo.Size()

	// Open the ZIP file
	zipFile, err := zip.OpenReader(bundlePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open bundle: %w", err)
	}
	defer zipFile.Close()

	// Count files and directories
	fileCount := 0
	formCount := 0
	rendererCount := 0
	hasAppIndex := false

	for _, file := range zipFile.File {
		if !strings.HasSuffix(file.Name, "/") {
			fileCount++
		}

		if file.Name == "app/index.html" {
			hasAppIndex = true
		}

		if strings.HasPrefix(file.Name, "forms/") && strings.HasSuffix(file.Name, "/schema.json") {
			formCount++
		}

		if strings.HasPrefix(file.Name, "renderers/") && strings.HasSuffix(file.Name, ".jsx") {
			rendererCount++
		}
	}

	info["file_count"] = fileCount
	info["form_count"] = formCount
	info["renderer_count"] = rendererCount
	info["has_app_index"] = hasAppIndex

	return info, nil
}

