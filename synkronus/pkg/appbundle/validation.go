package appbundle

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

var (
	ErrInvalidStructure         = errors.New("invalid app bundle structure")
	ErrMissingAppIndex          = errors.New("missing app/index.html")
	ErrInvalidFormStructure     = errors.New("invalid form structure")
	ErrInvalidCellStructure     = errors.New("invalid renderer structure")
	ErrCoreFieldModified        = errors.New("core_* fields cannot be modified")
	ErrMissingRendererReference = errors.New("missing renderer reference")
)

// validateBundleStructure validates the structure of the uploaded zip file
func (s *Service) validateBundleStructure(zipReader *zip.Reader) error {
	// Track required top-level directories
	hasAppDir := false
	topDirs := make(map[string]bool)
	formDirs := make(map[string]struct{})

	// First pass: validate top-level structure and collect form directories
	for _, file := range zipReader.File {
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

	for _, file := range zipReader.File {
		if strings.HasPrefix(file.Name, "forms/") {
			if err := s.validateFormFile(file); err != nil {
				return err
			}

			// Track which forms have schema.json and ui.json
			parts := strings.Split(file.Name, "/")
			if len(parts) >= 3 {
				formName := parts[1]
				if parts[2] == "schema.json" {
					hasFormSchema[formName] = true
				} else if parts[2] == "ui.json" {
					hasFormUI[formName] = true
				}
			}
		} else if strings.HasPrefix(file.Name, "renderers/") {
			if err := s.validateRendererFile(file); err != nil {
				return err
			}
		}
	}

	// Verify each form directory has both schema.json and ui.json
	for formDir := range formDirs {
		if !hasFormSchema[formDir] || !hasFormUI[formDir] {
			return fmt.Errorf("%w: form '%s' is missing required files (schema.json or ui.json)", ErrInvalidFormStructure, formDir)
		}
	}

	// Third pass: validate form references to renderers
	return s.validateFormRendererReferences(zipReader)
}

// validateFormFile validates a single form file
func (s *Service) validateFormFile(file *zip.File) error {
	// Skip directories
	if file.FileInfo().IsDir() {
		return nil
	}

	// Expected path format: forms/{formName}/schema.json or forms/{formName}/ui.json
	parts := strings.Split(file.Name, "/")
	if len(parts) != 3 || (parts[2] != "schema.json" && parts[2] != "ui.json") {
		return fmt.Errorf("%w: invalid form file path: %s", ErrInvalidFormStructure, file.Name)
	}

	// If it's a schema.json, validate core fields
	if parts[2] == "schema.json" {
		return s.validateFormSchema(file)
	}

	return nil
}

// validateFormSchema validates the form schema file
func (s *Service) validateFormSchema(file *zip.File) error {
	// Open the file
	f, err := file.Open()
	if err != nil {
		return fmt.Errorf("failed to open form schema: %w", err)
	}
	defer f.Close()

	// Parse the schema
	var schema map[string]any
	if err := json.NewDecoder(f).Decode(&schema); err != nil {
		return fmt.Errorf("invalid JSON in form schema: %w", err)
	}

	// Get form name from path
	parts := strings.Split(file.Name, "/")
	if len(parts) < 2 {
		return fmt.Errorf("invalid file path: %s", file.Name)
	}
	formName := parts[1]

	// Check for core field modifications
	if currentHash, exists := s.getCoreFieldsHash(formName); exists {
		// Get current core fields
		coreFields := extractCoreFields(schema)

		// Check if any core fields exist
		if len(coreFields) > 0 {
			// Get the hash of the current core fields
			newHash, err := hashCoreFields(coreFields)
			if err != nil {
				return fmt.Errorf("failed to hash core fields: %w", err)
			}

			// If the hash doesn't match, return the list of core fields that might have been modified
			if newHash != currentHash {
				// Get field names for the error message
				fieldNames := make([]string, len(coreFields))
				for i, field := range coreFields {
					fieldNames[i] = field.Name
				}

				return fmt.Errorf("%w: the following core fields were modified: %s",
					ErrCoreFieldModified,
					strings.Join(fieldNames, ", "))
			}
		}
	}

	return nil
}

// validateRendererFile validates a single renderer file
func (s *Service) validateRendererFile(file *zip.File) error {
	// Skip directories
	if file.FileInfo().IsDir() {
		return nil
	}

	// Expected path format: renderers/{rendererName}/renderer.jsx
	parts := strings.Split(file.Name, "/")
	if len(parts) != 3 || parts[2] != "renderer.jsx" {
		return fmt.Errorf("%w: invalid renderer file path: %s", ErrInvalidCellStructure, file.Name)
	}

	return nil
}

// validateFormRendererReferences validates that all renderer references in forms exist
func (s *Service) validateFormRendererReferences(zipReader *zip.Reader) error {
	// Build a set of available renderers
	availableCells := make(map[string]bool)

	// First, collect all available renderers
	for _, file := range zipReader.File {
		if strings.HasPrefix(file.Name, "renderers/") && strings.HasSuffix(file.Name, "/renderer.jsx") {
			parts := strings.Split(file.Name, "/")
			if len(parts) == 3 {
				availableCells[parts[1]] = true
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
			var schema map[string]any
			err = json.NewDecoder(f).Decode(&schema)
			f.Close() // Close the file immediately after reading
			if err != nil {
				return fmt.Errorf("failed to parse form schema: %w", err)
			}

			// Check for renderer references in the schema
			if err := checkRendererReferences(schema, availableCells); err != nil {
				return fmt.Errorf("%w: %v", ErrMissingRendererReference, err)
			}
		}
	}

	return nil
}

// builtInRenderers is a slice of standard JSONForms renderers that don't need to be defined in the bundle
var builtInRenderers = []string{
	// Basic controls
	"text",
	"number",
	"integer",
	"boolean",
	"date",
	"time",
	"datetime",
	"range",

	// Selection controls
	"select",
	"combo",
	"radio",
	"checkbox",
	"toggle",

	// Layout
	"group",
	"categorization",
	"category",

	// Specialized controls
	"multiselect",
	"textarea",
	"slider",
	"rating",

	// Built-in aliases (test support)
	"builtin-text",

	// formulus controls
	"image",
	"signature",
	"audio",
	"video",
	"file",
	"qrcode",
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
func checkRendererReferences(data any, availableRenderers map[string]bool) error {
	switch v := data.(type) {
	case map[string]any:
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

		// Recursively check nested objects
		for _, value := range v {
			if err := checkRendererReferences(value, availableRenderers); err != nil {
				return err
			}
		}

	case []any:
		// Recursively check array elements
		for _, item := range v {
			if err := checkRendererReferences(item, availableRenderers); err != nil {
				return err
			}
		}
	}

	return nil
}

// extractCoreFields returns all core fields from the schema
func extractCoreFields(schema map[string]any) []FieldInfo {
	var coreFields []FieldInfo

	for _, field := range extractFields(schema) {
		if field.Core {
			coreFields = append(coreFields, field)
		}
	}

	return coreFields
}

// hashCoreFields generates a deterministic hash for the core fields.
// It sorts the fields by name to ensure consistent ordering before hashing.
func hashCoreFields(fields []FieldInfo) (string, error) {
	if len(fields) == 0 {
		return "", nil
	}

	// Sort fields by name for consistent ordering
	sort.Slice(fields, func(i, j int) bool {
		return fields[i].Name < fields[j].Name
	})

	// Convert to JSON for consistent hashing
	jsonData, err := json.Marshal(fields)
	if err != nil {
		return "", fmt.Errorf("failed to marshal core fields: %w", err)
	}

	// Use SHA-256 for the hash
	hash := sha256.Sum256(jsonData)
	return hex.EncodeToString(hash[:]), nil
}

// getCoreFieldsHash retrieves the stored hash for a form's core fields.
// It returns the hash and a boolean indicating if the hash was found.
func (s *Service) getCoreFieldsHash(formName string) (string, bool) {
	s.coreFieldMutex.RLock()
	defer s.coreFieldMutex.RUnlock()

	if s.coreFieldHashes == nil {
		s.coreFieldHashes = make(map[string]string)
		return "", false
	}

	hash, exists := s.coreFieldHashes[formName]
	return hash, exists
}

// setCoreFieldsHash stores the hash for a form's core fields.
func (s *Service) setCoreFieldsHash(formName, hash string) {
	s.coreFieldMutex.Lock()
	defer s.coreFieldMutex.Unlock()

	if s.coreFieldHashes == nil {
		s.coreFieldHashes = make(map[string]string)
	}
	s.coreFieldHashes[formName] = hash
}
