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
	ErrInvalidExtension         = errors.New("invalid extension file")
	ErrMissingExtensionModule   = errors.New("missing extension module")
	ErrInvalidExtensionRenderer = errors.New("invalid extension renderer")
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

		// Track form directories (exclude ext.json files)
		if strings.HasPrefix(file.Name, "forms/") && !strings.HasSuffix(file.Name, "/") {
			// Skip ext.json files - they're not form directories
			// Skip both root-level (forms/ext.json) and form-level (forms/{formName}/ext.json)
			if file.Name == "forms/ext.json" || strings.HasSuffix(file.Name, "/ext.json") {
				continue
			}
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
			// Skip ext.json files - they're validated separately in validateExtensions
			// Skip both root-level (forms/ext.json) and form-level (forms/{formName}/ext.json)
			if file.Name == "forms/ext.json" || strings.HasSuffix(file.Name, "/ext.json") {
				continue
			}
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

	// Third pass: validate extensions
	if err := validateExtensions(&zipFile.Reader); err != nil {
		return err
	}

	// Fourth pass: validate form references to renderers (including extension renderers)
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
	extensionRenderers := make(map[string]bool)

	// First, collect all available renderers from renderers/ directory
	for _, file := range zipReader.File {
		if strings.HasPrefix(file.Name, "renderers/") && strings.HasSuffix(file.Name, "/renderer.jsx") {
			parts := strings.Split(file.Name, "/")
			if len(parts) == 3 {
				availableRenderers[parts[1]] = true
			}
		}
	}

	// Second, collect extension renderers from ext.json files
	for _, file := range zipReader.File {
		// Collect both root-level (forms/ext.json) and form-level (forms/{formName}/ext.json) ext.json files
		if file.Name == "forms/ext.json" || strings.HasSuffix(file.Name, "/ext.json") {
			rc, err := file.Open()
			if err != nil {
				continue // Skip if can't open
			}

			var ext ExtensionDefinition
			decoder := json.NewDecoder(rc)
			if err := decoder.Decode(&ext); err != nil {
				rc.Close()
				continue // Skip if can't parse
			}
			rc.Close()

			// Extract renderer formats
			if ext.Renderers != nil {
				for key, rendererData := range ext.Renderers {
					rendererBytes, _ := json.Marshal(rendererData)
					var renderer ExtensionRenderer
					if err := json.Unmarshal(rendererBytes, &renderer); err == nil {
						// In v1 format, the key is the format name
						// In legacy format, use Format field
						format := key
						if renderer.Format != "" {
							format = renderer.Format
						}
						extensionRenderers[format] = true
					}
				}
			}
		}
	}

	// Merge extension renderers into available renderers
	for format := range extensionRenderers {
		availableRenderers[format] = true
	}

	// Then check all form schemas and UI schemas for renderer references
	for _, file := range zipReader.File {
		// Process schema.json files
		if strings.HasPrefix(file.Name, "forms/") && strings.HasSuffix(file.Name, "schema.json") {
			parts := strings.Split(file.Name, "/")
			if len(parts) != 3 || parts[2] != "schema.json" {
				continue
			}

			f, err := file.Open()
			if err != nil {
				return fmt.Errorf("failed to open form schema: %w", err)
			}

			var schema map[string]interface{}
			err = json.NewDecoder(f).Decode(&schema)
			f.Close()
			if err != nil {
				return fmt.Errorf("failed to parse form schema: %w", err)
			}

			// Check for renderer references in the schema (including format-based)
			if err := checkSchemaRendererReferences(schema, availableRenderers, extensionRenderers); err != nil {
				return fmt.Errorf("%w: %v", ErrMissingRendererReference, err)
			}
		}

		// Process ui.json files - check for format-based renderer references
		if strings.HasPrefix(file.Name, "forms/") && strings.HasSuffix(file.Name, "ui.json") {
			parts := strings.Split(file.Name, "/")
			if len(parts) != 3 || parts[2] != "ui.json" {
				continue
			}

			f, err := file.Open()
			if err != nil {
				return fmt.Errorf("failed to open form UI schema: %w", err)
			}

			var uiSchema map[string]interface{}
			err = json.NewDecoder(f).Decode(&uiSchema)
			f.Close()
			if err != nil {
				return fmt.Errorf("failed to parse form UI schema: %w", err)
			}

			// Check UI schema for format references that require renderers
			if err := checkUISchemaRendererReferences(uiSchema, availableRenderers, extensionRenderers); err != nil {
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

// checkSchemaRendererReferences recursively checks for renderer references in the schema
// This includes format-based renderers (used by custom question types)
func checkSchemaRendererReferences(data interface{}, availableRenderers map[string]bool, extensionRenderers map[string]bool) error {
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

		// Check for format property (used by format-based renderers in schema properties)
		if format, ok := v["format"].(string); ok {
			// Format-based renderers must be in extension renderers or built-in
			if !extensionRenderers[format] && !isBuiltInRenderer(format) {
				// Check if it's a known format
				knownFormats := []string{"date", "date-time", "time", "photo", "qrcode", "signature", "select_file", "audio", "gps", "video", "adate", "html"}
				isKnownFormat := false
				for _, known := range knownFormats {
					if format == known {
						isKnownFormat = true
						break
					}
				}
				if !isKnownFormat {
					return fmt.Errorf("schema property references renderer with format '%s' but no extension renderer is defined for this format", format)
				}
			}
		}

		// Recursively check nested objects
		for _, value := range v {
			if err := checkSchemaRendererReferences(value, availableRenderers, extensionRenderers); err != nil {
				return err
			}
		}

	case []interface{}:
		// Recursively check array elements
		for _, item := range v {
			if err := checkSchemaRendererReferences(item, availableRenderers, extensionRenderers); err != nil {
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

// ExtensionDefinition represents the structure of an ext.json file
type ExtensionDefinition struct {
	Version     string                 `json:"version,omitempty"`
	Description string                 `json:"description,omitempty"`
	Schemas     map[string]interface{} `json:"schemas,omitempty"`
	Definitions map[string]interface{} `json:"definitions,omitempty"` // Legacy support
	Functions   map[string]interface{} `json:"functions,omitempty"`
	Renderers   map[string]interface{} `json:"renderers,omitempty"`
}

// ExtensionModuleReference represents a module reference with path and export
type ExtensionModuleReference struct {
	Path   string `json:"path"`
	Export string `json:"export"`
}

// ExtensionRenderer represents a renderer definition in ext.json (v1 format)
// In v1 format, the renderer key (e.g., "CustomText") is the format/name
type ExtensionRenderer struct {
	Renderer *ExtensionModuleReference `json:"renderer,omitempty"`
	Tester   *ExtensionModuleReference `json:"tester,omitempty"`
	// Legacy fields for backward compatibility
	Name   string `json:"name,omitempty"`
	Format string `json:"format,omitempty"`
	Module string `json:"module,omitempty"`
}

// validateExtensions validates extension files (ext.json) in the bundle
func validateExtensions(zipReader *zip.Reader) error {
	// Track extension files
	extensionFiles := make(map[string]*zip.File)
	extensionRenderers := make(map[string]ExtensionRenderer)
	extensionModules := make(map[string]bool)

	// First pass: collect extension files and validate structure
	for _, file := range zipReader.File {
		// Collect both root-level (forms/ext.json) and form-level (forms/{formName}/ext.json) ext.json files
		if file.Name == "forms/ext.json" || strings.HasSuffix(file.Name, "/ext.json") {
			extensionFiles[file.Name] = file

			// Validate JSON structure
			if err := validateJSONFile(file); err != nil {
				return fmt.Errorf("%w: %s: %v", ErrInvalidExtension, file.Name, err)
			}

			// Parse and validate extension structure
			rc, err := file.Open()
			if err != nil {
				return fmt.Errorf("failed to open extension file %s: %w", file.Name, err)
			}

			var ext ExtensionDefinition
			decoder := json.NewDecoder(rc)
			if err := decoder.Decode(&ext); err != nil {
				rc.Close()
				return fmt.Errorf("%w: %s: failed to parse: %v", ErrInvalidExtension, file.Name, err)
			}
			rc.Close()

			// Validate renderers
			if ext.Renderers != nil {
				for key, rendererData := range ext.Renderers {
					rendererBytes, err := json.Marshal(rendererData)
					if err != nil {
						return fmt.Errorf("%w: %s: failed to marshal renderer %s: %v", ErrInvalidExtension, file.Name, key, err)
					}

					var renderer ExtensionRenderer
					if err := json.Unmarshal(rendererBytes, &renderer); err != nil {
						return fmt.Errorf("%w: %s: invalid renderer %s: %v", ErrInvalidExtension, file.Name, key, err)
					}

					// Determine format/name - use key as format for v1 format, or use Format field for legacy
					format := key
					if renderer.Format != "" {
						format = renderer.Format
					}

					// Validate v1 format (new format with renderer/tester objects)
					if renderer.Renderer != nil {
						// New v1 format: renderer is an object with path and export
						if renderer.Renderer.Path == "" {
							return fmt.Errorf("%w: %s: renderer %s missing 'renderer.path' field", ErrInvalidExtensionRenderer, file.Name, key)
						}
						if renderer.Renderer.Export == "" {
							return fmt.Errorf("%w: %s: renderer %s missing 'renderer.export' field", ErrInvalidExtensionRenderer, file.Name, key)
						}
						// Track renderer module path
						extensionModules[renderer.Renderer.Path] = true

						// Validate tester if present
						if renderer.Tester != nil {
							if renderer.Tester.Path == "" {
								return fmt.Errorf("%w: %s: renderer %s missing 'tester.path' field", ErrInvalidExtensionRenderer, file.Name, key)
							}
							if renderer.Tester.Export == "" {
								return fmt.Errorf("%w: %s: renderer %s missing 'tester.export' field", ErrInvalidExtensionRenderer, file.Name, key)
							}
							// Track tester module path
							extensionModules[renderer.Tester.Path] = true
						}
					} else if renderer.Module != "" {
						// Legacy format: validate required fields (as per PR #226)
						if renderer.Name == "" {
							return fmt.Errorf("%w: %s: renderer %s missing 'name' field", ErrInvalidExtensionRenderer, file.Name, key)
						}
						if renderer.Format == "" {
							return fmt.Errorf("%w: %s: renderer %s missing 'format' field", ErrInvalidExtensionRenderer, file.Name, key)
						}
						// Module already checked in the condition
						extensionModules[renderer.Module] = true
					} else {
						// Neither format present
						return fmt.Errorf("%w: %s: renderer %s must have either 'renderer' object (v1 format) or 'module' string (legacy format)", ErrInvalidExtensionRenderer, file.Name, key)
					}

					// Store renderer for later validation (use key as format)
					extensionRenderers[format] = renderer
				}
			}

			// Validate functions
			if ext.Functions != nil {
				for key, funcData := range ext.Functions {
					funcMap, ok := funcData.(map[string]interface{})
					if !ok {
						return fmt.Errorf("%w: %s: function %s must be an object", ErrInvalidExtension, file.Name, key)
					}

					// Support v1 format (path/export) and legacy format (name/module)
					if path, ok := funcMap["path"].(string); ok && path != "" {
						// New v1 format: path and export
						if export, ok := funcMap["export"].(string); !ok || export == "" {
							return fmt.Errorf("%w: %s: function %s missing or invalid 'export' field", ErrInvalidExtension, file.Name, key)
						}
						extensionModules[path] = true
					} else if name, ok := funcMap["name"].(string); ok && name != "" {
						// Legacy format: name and module
						if module, ok := funcMap["module"].(string); ok && module != "" {
							extensionModules[module] = true
						}
					} else {
						return fmt.Errorf("%w: %s: function %s must have either 'path' and 'export' (v1 format) or 'name' (legacy format)", ErrInvalidExtension, file.Name, key)
					}
				}
			}
		}
	}

	// Second pass: validate that extension modules exist
	for modulePath := range extensionModules {
		// Check if module exists in bundle
		// Modules can be in forms/ or app/ directories
		moduleFound := false

		// Normalize path - remove leading "/" if present (v1 format uses absolute paths)
		normalizedPath := strings.TrimPrefix(modulePath, "/")

		for _, file := range zipReader.File {
			// Check various possible paths
			if file.Name == modulePath ||
				file.Name == normalizedPath ||
				file.Name == "forms/"+normalizedPath ||
				file.Name == "app/"+normalizedPath ||
				strings.HasSuffix(file.Name, "/"+normalizedPath) ||
				strings.HasSuffix(file.Name, modulePath) {
				moduleFound = true
				break
			}
		}

		if !moduleFound {
			// Warning only - modules might be loaded at runtime
			// But we should still check for obvious errors
			if !strings.HasSuffix(modulePath, ".js") && !strings.HasSuffix(modulePath, ".jsx") && !strings.HasSuffix(modulePath, ".ts") && !strings.HasSuffix(modulePath, ".tsx") {
				return fmt.Errorf("%w: extension module '%s' not found in bundle and does not appear to be a valid module path", ErrMissingExtensionModule, modulePath)
			}
		}
	}

	return nil
}

// checkUISchemaRendererReferences checks UI schema for format-based renderer references
func checkUISchemaRendererReferences(data interface{}, availableRenderers map[string]bool, extensionRenderers map[string]bool) error {
	switch v := data.(type) {
	case map[string]interface{}:
		// Check for format property (used by custom renderers)
		if format, ok := v["format"].(string); ok {
			// Format-based renderers must be in extension renderers or built-in
			if !extensionRenderers[format] && !isBuiltInRenderer(format) {
				// Check if it's a known format (date, date-time, time are built-in)
				knownFormats := []string{"date", "date-time", "time", "photo", "qrcode", "signature", "select_file", "audio", "gps", "video", "adate", "html"}
				isKnownFormat := false
				for _, known := range knownFormats {
					if format == known {
						isKnownFormat = true
						break
					}
				}
				if !isKnownFormat {
					return fmt.Errorf("UI schema references renderer with format '%s' but no extension renderer is defined for this format", format)
				}
			}
		}

		// Recursively check nested objects
		for _, value := range v {
			if err := checkUISchemaRendererReferences(value, availableRenderers, extensionRenderers); err != nil {
				return err
			}
		}

	case []interface{}:
		// Recursively check array elements
		for _, item := range v {
			if err := checkUISchemaRendererReferences(item, availableRenderers, extensionRenderers); err != nil {
				return err
			}
		}
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
