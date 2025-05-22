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
	Version   string              `json:"version"`
	Forms     map[string]FormInfo `json:"forms,omitempty"`
	Timestamp string              `json:"timestamp,omitempty"`
}

// FormInfo contains information about a form
type FormInfo struct {
	CoreHash      string         `json:"core_hash"`      // Hash of core_* fields
	FormHash      string         `json:"form_hash"`      // Hash of the entire form schema
	UIHash        string         `json:"ui_hash"`        // Hash of the UI schema
	Fields        []FieldInfo    `json:"fields"`         // List of all fields
	QuestionTypes map[string]any `json:"question_types"` // Map of question types referenced in the UI form
}

// FieldInfo contains information about a form field
type FieldInfo struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Required     bool   `json:"required"`
	QuestionType string `json:"question_type"`
	Default      any    `json:"default"`
	Core         bool   `json:"core"`
}

// generateAppInfo generates the APP_INFO.json content for the bundle
func (s *Service) generateAppInfo(zipReader *zip.Reader, version string) ([]byte, error) {
	appInfo := AppInfo{
		Version: version,
		Forms:   make(map[string]FormInfo),
	}

	// First pass: collect all form schemas and UI schemas
	formSchemas := make(map[string]*zip.File)
	uiSchemas := make(map[string]*zip.File)
	questionTypeFiles := make(map[string]bool)

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

		case strings.HasPrefix(file.Name, "renderers/") && strings.HasSuffix(file.Name, "/renderer.jsx"):
			parts := strings.Split(file.Name, "/")
			if len(parts) == 3 {
				rendererName := parts[1]
				questionTypeFiles[rendererName] = true
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
		// Convert core fields to a map for hashing
		coreFieldsMap := make(map[string]interface{})
		for _, field := range coreFields {
			fieldMap := map[string]interface{}{
				"type":            field.Type,
				"x-question-type": field.QuestionType,
				"default":         field.Default,
				"x-core":          true,
			}
			// Remove empty fields
			if field.QuestionType == "" {
				delete(fieldMap, "x-question-type")
			}
			if field.Default == nil {
				delete(fieldMap, "default")
			}
			coreFieldsMap[field.Name] = fieldMap
		}
		coreHash := hashData(coreFieldsMap)

		// Store the core hash in the service cache
		s.setCoreFieldsHash(formName, coreHash)

		// Create form info
		formInfo := FormInfo{
			CoreHash:      coreHash,
			FormHash:      hashData(schema),
			Fields:        extractFields(schema),
			QuestionTypes: make(map[string]any),
		}

		// Add UI hash if exists
		if uiFile, exists := uiSchemas[formName]; exists {
			uiData, err := readZipFile(uiFile)
			if err != nil {
				return nil, fmt.Errorf("failed to read UI schema for %s: %w", formName, err)
			}
			formInfo.UIHash = hashData(uiData)

			// Parse UI schema to find question types
			var uiSchema map[string]any
			if err := json.Unmarshal(uiData, &uiSchema); err != nil {
				return nil, fmt.Errorf("failed to parse UI schema for %s: %w", formName, err)
			}
			extractQuestionTypes(uiSchema, formInfo.QuestionTypes, questionTypeFiles)
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
func extractFields(schema map[string]any) []FieldInfo {
	var fields []FieldInfo

	// Get the properties map from the schema
	props, _ := schema["properties"].(map[string]any)
	if len(props) == 0 {
		return []FieldInfo{} // Return empty slice for nil or empty properties
	}

	// Get the required fields list if it exists
	requiredMap := make(map[string]bool)
	if required, ok := schema["required"].([]any); ok {
		for _, r := range required {
			if req, ok := r.(string); ok {
				requiredMap[req] = true
			}
		}
	}

	// Iterate through each property
	for fieldName, fieldData := range props {
		field, ok := fieldData.(map[string]any)
		if !ok {
			continue
		}

		// Initialize field info with all properties
		fieldInfo := FieldInfo{
			Name:         fieldName,
			Type:         getString(field, "type"),
			QuestionType: getString(field, "x-question-type"),
			Required:     requiredMap[fieldName],
			Core:         getBool(field, "x-core") || strings.HasPrefix(fieldName, "core_"),
			Default:      field["default"], // Will be nil if not specified
		}

		fields = append(fields, fieldInfo)
	}

	return fields
}

// extractQuestionTypes extracts renderers (ie. question types) from UI schema
// It looks for the standard JSON Forms format with options.format
func extractQuestionTypes(uiSchema map[string]interface{}, rendererTypes map[string]interface{}, availableRenderers map[string]bool) {
	// Check for standard JSON Forms format with options.format
	if uiType, ok := uiSchema["type"].(string); ok && uiType == "Control" {
		if options, ok := uiSchema["options"].(map[string]interface{}); ok {
			if format, ok := options["format"].(string); ok && availableRenderers[format] {
				rendererTypes[format] = struct{}{}
			}
		}
	}

	// Recursively process nested objects and arrays
	for _, value := range uiSchema {
		switch v := value.(type) {
		case map[string]interface{}:
			extractQuestionTypes(v, rendererTypes, availableRenderers)
		case []interface{}:
			for _, item := range v {
				if m, ok := item.(map[string]interface{}); ok {
					extractQuestionTypes(m, rendererTypes, availableRenderers)
				}
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
