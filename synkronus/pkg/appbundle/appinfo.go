package appbundle

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"
)

// AppInfo represents the structure of APP_INFO.json
type AppInfo struct {
	Version   string             `json:"version"`
	Forms     map[string]FormInfo `json:"forms,omitempty"`
	Timestamp string            `json:"timestamp,omitempty"`
}

// FormInfo contains information about a form
type FormInfo struct {
	CoreHash  string                 `json:"core_hash"`          // Hash of core_* fields
	FormHash  string                 `json:"form_hash"`          // Hash of the entire form schema
	UIHash    string                 `json:"ui_hash"`            // Hash of the UI schema
	Fields    []FieldInfo            `json:"fields,omitempty"`    // List of all fields
	CellTypes map[string]interface{} `json:"cell_types,omitempty"` // Map of cell types used in the form
}

// FieldInfo contains information about a form field
type FieldInfo struct {
	Name     string      `json:"name"`
	Type     string      `json:	ype,omitempty"`
	Required bool        `json:"required,omitempty"`
	CellType string      `json:"cell_type,omitempty"`
	Default  interface{} `json:"default,omitempty"`
}

// generateAppInfo generates the APP_INFO.json content for the bundle
func (s *Service) generateAppInfo(zipReader *zip.Reader, version string) ([]byte, error) {
	appInfo := AppInfo{
		Version:   version,
		Forms:     make(map[string]FormInfo),
	}

	// First pass: collect all form schemas and UI schemas
	formSchemas := make(map[string]*zip.File)   // formName -> schema.json
	uiSchemas := make(map[string]*zip.File)     // formName -> ui.json
	cellFiles := make(map[string]bool)          // cellName -> true

	for _, file := range zipReader.File {
		switch {
		case strings.HasPrefix(file.Name, "forms/") && strings.HasSuffix(file.Name, "/schema.json"):
			parts := strings.Split(file.Name, "/")
			if len(parts) == 3 {
				formName := parts[1]
				formSchemas[formName] = file
			}

		case strings.HasPrefix(file.Name, "forms/") && strings.HasSuffix(file.Name, "/ui.json"):
			parts := strings.Split(file.Name, "/")
			if len(parts) == 3 {
				formName := parts[1]
				uiSchemas[formName] = file
			}

		case strings.HasPrefix(file.Name, "cells/") && strings.HasSuffix(file.Name, "/cell.jsx"):
			parts := strings.Split(file.Name, "/")
			if len(parts) == 3 {
				cellName := parts[1]
				cellFiles[cellName] = true
			}
		}
	}


	// Process each form
	for formName, schemaFile := range formSchemas {
		// Read and parse the form schema
		schemaData, err := readZipFile(schemaFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read form schema %s: %w", formName, err)
		}

		var schema map[string]interface{}
		if err := json.Unmarshal(schemaData, &schema); err != nil {
			return nil, fmt.Errorf("invalid JSON in form schema %s: %w", formName, err)
		}

		// Extract core fields and create hash
		coreFields := extractCoreFields(schema)
		coreHash := hashData(coreFields)

		// Create form info
		formInfo := FormInfo{
			CoreHash:  coreHash,
			FormHash:  hashData(schema),
			Fields:    extractFields(schema),
			CellTypes: make(map[string]interface{}),
		}

		// Add UI hash if exists
		if uiFile, exists := uiSchemas[formName]; exists {
			uiData, err := readZipFile(uiFile)
			if err != nil {
				return nil, fmt.Errorf("failed to read UI schema for %s: %w", formName, err)
			}
			formInfo.UIHash = hashData(uiData)

			// Parse UI schema to find cell types
			var uiSchema map[string]interface{}
			if err := json.Unmarshal(uiData, &uiSchema); err == nil {
				extractCellTypes(uiSchema, formInfo.CellTypes, cellFiles)
			}
		}

		appInfo.Forms[formName] = formInfo
	}

	// Sort forms for consistent output
	sortedForms := make([]string, 0, len(appInfo.Forms))
	for formName := range appInfo.Forms {
		sortedForms = append(sortedForms, formName)
	}
	sort.Strings(sortedForms)

	sortedFormsMap := make(map[string]FormInfo, len(sortedForms))
	for _, name := range sortedForms {
		sortedFormsMap[name] = appInfo.Forms[name]
	}
	appInfo.Forms = sortedFormsMap

	// Generate JSON
	jsonData, err := json.MarshalIndent(appInfo, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal app info: %w", err)
	}

	return jsonData, nil
}

// extractFields extracts field information from a form schema
func extractFields(schema map[string]interface{}) []FieldInfo {
	var fields []FieldInfo

	if fieldsData, ok := schema["fields"].([]interface{}); ok {
		for _, fieldData := range fieldsData {
			if field, ok := fieldData.(map[string]interface{}); ok {
				fieldInfo := FieldInfo{
					Name:     getString(field, "name"),
					Type:     getString(field, "type"),
					CellType: getString(field, "cellType"),
					Required: getBool(field, "required"),
				}
				if def, exists := field["default"]; exists {
					fieldInfo.Default = def
				}
				fields = append(fields, fieldInfo)
			}
		}
	}

	return fields
}

// extractCellTypes extracts cell types from UI schema
func extractCellTypes(uiSchema map[string]interface{}, cellTypes map[string]interface{}, availableCells map[string]bool) {
	// Recursively search for cell types in the UI schema
	for key, value := range uiSchema {
		switch v := value.(type) {
		case map[string]interface{}:
			extractCellTypes(v, cellTypes, availableCells)
		case []interface{}:
			for _, item := range v {
				if m, ok := item.(map[string]interface{}); ok {
					extractCellTypes(m, cellTypes, availableCells)
				}
			}
		}

		// Check if this is a cell type reference
		if key == "cellType" {
			if cellName, ok := value.(string); ok && availableCells[cellName] {
				cellTypes[cellName] = struct{}{}
			}
		}
	}
}

// hashData generates a SHA-256 hash of any JSON-serializable data
func hashData(data interface{}) string {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return ""
	}
	hash := sha256.Sum256(jsonData)
	return hex.EncodeToString(hash[:])
}

// readZipFile reads the content of a file from a zip archive
func readZipFile(file *zip.File) ([]byte, error) {
	f, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return io.ReadAll(f)
}

// Helper functions for safe map access
func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}

func getBool(m map[string]interface{}, key string) bool {
	if val, ok := m[key].(bool); ok {
		return val
	}
	return false
}
