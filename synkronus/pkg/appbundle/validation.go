package appbundle

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

var (
	ErrInvalidStructure     = errors.New("invalid app bundle structure")
	ErrMissingAppIndex      = errors.New("missing app/index.html")
	ErrInvalidFormStructure = errors.New("invalid form structure")
	ErrInvalidCellStructure = errors.New("invalid cell structure")
	ErrCoreFieldModified    = errors.New("core_* fields cannot be modified")
	ErrMissingCellReference = errors.New("missing cell reference")
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
		if topDir == "app" || topDir == "forms" || topDir == "cells" {
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

	// Second pass: validate forms and cells structure
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
		} else if strings.HasPrefix(file.Name, "cells/") {
			if err := s.validateCellFile(file); err != nil {
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

	// Third pass: validate form references to cells
	return s.validateFormCellReferences(zipReader)
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
	var schema map[string]interface{}
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
		// Get current core fields and their paths
		coreFields, fieldPaths := extractCoreFields(schema)

		// Check if any core fields exist
		if len(fieldPaths) > 0 {
			// Get the hash of the current core fields
			newHash, err := hashCoreFields(coreFields)
			if err != nil {
				return fmt.Errorf("failed to hash core fields: %w", err)
			}

			// If the hash doesn't match, return the list of core fields that might have been modified
			if newHash != currentHash {
				// Since we can't get the old values, we'll list all core fields as potentially modified
				return fmt.Errorf("%w: the following core fields were modified: %s",
					ErrCoreFieldModified,
					strings.Join(fieldPaths, ", "))
			}
		}
	}

	return nil
}

// validateCellFile validates a single cell file
func (s *Service) validateCellFile(file *zip.File) error {
	// Skip directories
	if file.FileInfo().IsDir() {
		return nil
	}

	// Expected path format: cells/{cellName}/cell.jsx
	parts := strings.Split(file.Name, "/")
	if len(parts) != 3 || parts[2] != "cell.jsx" {
		return fmt.Errorf("%w: invalid cell file path: %s", ErrInvalidCellStructure, file.Name)
	}

	return nil
}

// validateFormCellReferences validates that all cell references in forms exist
func (s *Service) validateFormCellReferences(zipReader *zip.Reader) error {
	// Build a set of available cells
	availableCells := make(map[string]bool)

	// First, collect all available cells
	for _, file := range zipReader.File {
		if strings.HasPrefix(file.Name, "cells/") && strings.HasSuffix(file.Name, "/cell.jsx") {
			parts := strings.Split(file.Name, "/")
			if len(parts) == 3 {
				availableCells[parts[1]] = true
			}
		}
	}

	// Then check all form schemas for cell references
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

			// Check for cell references in the schema
			if err := checkCellReferences(schema, availableCells); err != nil {
				return fmt.Errorf("%w: %v", ErrMissingCellReference, err)
			}
		}
	}

	return nil
}

// builtInCells is a slice of standard JSONForms renderers that don't need to be defined in the bundle
var builtInCells = []string{
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

// isBuiltInCell checks if a cell type is a built-in renderer
func isBuiltInCell(cellType string) bool {
	for _, builtIn := range builtInCells {
		if builtIn == cellType {
			return true
		}
	}
	return false
}

// checkCellReferences recursively checks for cell references in the schema
func checkCellReferences(data interface{}, availableCells map[string]bool) error {
	switch v := data.(type) {
	case map[string]interface{}:
		// Check for cell type (both x-cell and cellType formats)
		if cellType, ok := v["x-cell"].(string); ok {
			if !availableCells[cellType] && !isBuiltInCell(cellType) {
				return fmt.Errorf("references non-existent cell '%s' (x-cell)", cellType)
			}
		}
		if cellType, ok := v["cellType"].(string); ok {
			if !availableCells[cellType] && !isBuiltInCell(cellType) {
				return fmt.Errorf("references non-existent cell '%s' (cellType)", cellType)
			}
		}

		// Recursively check nested objects
		for _, value := range v {
			if err := checkCellReferences(value, availableCells); err != nil {
				return err
			}
		}

	case []interface{}:
		// Recursively check array elements
		for _, item := range v {
			if err := checkCellReferences(item, availableCells); err != nil {
				return err
			}
		}
	}

	return nil
}

// extractCoreFields extracts core fields from the schema.
// Core fields are either marked with x-core: true or start with "core_".
// It performs a deep copy of the values to ensure the original data isn't modified.
// Returns a map of core fields and a slice of field paths.
func extractCoreFields(schema map[string]interface{}) (map[string]interface{}, []string) {
	coreFields := make(map[string]interface{})
	var fieldPaths []string

	// Helper function to add fields with their paths
	addField := func(path string, value interface{}) {
		coreFields[path] = deepCopyValue(value)
		fieldPaths = append(fieldPaths, path)
	}

	// Check for x-core at the schema level
	if isCore, ok := schema["x-core"].(bool); ok && isCore {
		// If the entire schema is marked as core, include all properties
		if props, ok := schema["properties"].(map[string]interface{}); ok {
			for k, v := range props {
				addField(k, v)
			}
		}
	}

	// Also include any fields that start with "core_"
	for k, v := range schema {
		if strings.HasPrefix(k, "core_") {
			addField(k, v)
		}
	}

	return coreFields, fieldPaths
}

// hashCoreFields generates a deterministic hash for the core fields map.
// It sorts map keys to ensure consistent ordering before hashing.
func hashCoreFields(fields map[string]interface{}) (string, error) {
	if len(fields) == 0 {
		return "", nil
	}

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

// deepCopyValue creates a deep copy of the given value.
// It handles maps, slices, and primitive types.
func deepCopyValue(v interface{}) interface{} {
	switch v := v.(type) {
	case map[string]interface{}:
		return deepCopyMap(v)
	case []interface{}:
		return deepCopySlice(v)
	default:
		// For primitive types, return as is (they're passed by value)
		return v
	}
}

// deepCopyMap creates a deep copy of a map.
func deepCopyMap(m map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{}, len(m))
	for k, v := range m {
		result[k] = deepCopyValue(v)
	}
	return result
}

// deepCopySlice creates a deep copy of a slice.
func deepCopySlice(s []interface{}) []interface{} {
	result := make([]interface{}, len(s))
	for i, v := range s {
		result[i] = deepCopyValue(v)
	}
	return result
}
