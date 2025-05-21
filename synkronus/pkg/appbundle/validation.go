package appbundle

import (
	"archive/zip"
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

	// First pass: validate top-level structure
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
	}

	// Ensure we have the required app directory with index.html
	if !hasAppDir {
		return ErrMissingAppIndex
	}

	// Second pass: validate forms and cells structure
	for _, file := range zipReader.File {
		if strings.HasPrefix(file.Name, "forms/") {
			if err := s.validateFormFile(file); err != nil {
				return err
			}
		} else if strings.HasPrefix(file.Name, "cells/") {
			if err := s.validateCellFile(file); err != nil {
				return err
			}
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
	formName := parts[1]

	// Check for core field modifications
	if currentHash, exists := s.getCoreFieldsHash(formName); exists {
		coreFields := extractCoreFields(schema)
		newHash := hashCoreFields(coreFields)
		if newHash != currentHash {
			return ErrCoreFieldModified
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
			if err := json.NewDecoder(f).Decode(&schema); err != nil {
				f.Close()
				return fmt.Errorf("invalid JSON in form schema: %w", err)
			}
			f.Close()

			// Check for cell references in the schema
			if err := checkCellReferences(schema, availableCells); err != nil {
				return fmt.Errorf("form schema validation failed: %w", err)
			}
		}
	}

	return nil
}

// checkCellReferences recursively checks for cell references in the schema
func checkCellReferences(data interface{}, availableCells map[string]bool) error {
	switch v := data.(type) {
	case map[string]interface{}:
		// Check for cell type
		if cellType, ok := v["cellType"].(string); ok {
			if !availableCells[cellType] {
				return fmt.Errorf("%w: cell type '%s' not found in bundle", ErrMissingCellReference, cellType)
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

// extractCoreFields extracts core fields (starting with core_) from the schema
func extractCoreFields(schema map[string]interface{}) map[string]interface{} {
	coreFields := make(map[string]interface{})
	for k, v := range schema {
		if strings.HasPrefix(k, "core_") {
			coreFields[k] = v
		}
	}
	return coreFields
}

// hashCoreFields generates a hash for the core fields
func hashCoreFields(fields map[string]interface{}) string {
	// In a real implementation, you'd want to use a proper hashing function
	// This is a simplified version for demonstration
	return fmt.Sprintf("%v", fields)
}

// getCoreFieldsHash gets the hash of core fields for a form
func (s *Service) getCoreFieldsHash(formName string) (string, bool) {
	// In a real implementation, you'd want to store and retrieve these hashes
	// from a database or some persistent storage
	// For now, return false to indicate no existing hash
	return "", false
}
