package appbundle

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// ChangeLog represents the structure of CHANGE_LOG.json
type ChangeLog struct {
	CompareVersionA string             `json:"compare_version_a"`
	CompareVersionB string             `json:"compare_version_b"`
	FormChanges    bool               `json:"form_changes"`
	UIChanges      bool               `json:"ui_changes"`
	NewForms       []FormDiff         `json:"new_forms,omitempty"`
	RemovedForms   []FormDiff         `json:"removed_forms,omitempty"`
	ModifiedForms  []FormModification `json:"modified_forms,omitempty"`
}

// FormDiff represents a form that was added or removed
type FormDiff struct {
	Name string `json:"form"`
}

// FieldDiff represents fields that were added or removed
type FieldDiff struct {
	Form   string   `json:"form"`
	Fields []string `json:"fields"`
}

// FieldChange represents a field that was added or removed
type FieldChange struct {
	Name string `json:"field"`
	Type string `json:"type"`
}

// FormModification represents changes to a form's schema or UI
type FormModification struct {
	FormName      string       `json:"form"`
	SchemaChange  bool         `json:"schema_changed"`
	UIChange      bool         `json:"ui_changed"`
	CoreChange    bool         `json:"core_changed"`
	AddedFields   []FieldChange `json:"added_fields,omitempty"`
	RemovedFields []FieldChange `json:"removed_fields,omitempty"`
}

// CompareAppInfos compares two AppInfo objects and generates a ChangeLog
func CompareAppInfos(oldInfo, newInfo *AppInfo) (*ChangeLog, error) {
	if oldInfo == nil || newInfo == nil {
		return nil, fmt.Errorf("both app infos must be non-nil")
	}

	log := &ChangeLog{
		CompareVersionA: oldInfo.Version,
		CompareVersionB: newInfo.Version,
	}

	// Track all forms in both versions
	allForms := make(map[string]bool)
	for formName := range oldInfo.Forms {
		allForms[formName] = true
	}
	for formName := range newInfo.Forms {
		allForms[formName] = true
	}

	// Check each form
	for formName := range allForms {
		oldForm, oldExists := oldInfo.Forms[formName]
		newForm, newExists := newInfo.Forms[formName]

		switch {
		case !oldExists && newExists:
			// New form added
			log.NewForms = append(log.NewForms, FormDiff{Name: formName})
			log.FormChanges = true

		case oldExists && !newExists:
			// Form removed
			log.RemovedForms = append(log.RemovedForms, FormDiff{Name: formName})
			log.FormChanges = true

		case oldExists && newExists:
			// Form exists in both, check for changes
			mod := FormModification{FormName: formName}

			// Check form schema changes
			if oldForm.FormHash != newForm.FormHash {
				mod.SchemaChange = true
				log.FormChanges = true

				// Check for field additions/removals
				added, removed := compareFieldLists(oldForm.Fields, newForm.Fields)
				if len(added) > 0 {
					mod.AddedFields = added
				}
				if len(removed) > 0 {
					mod.RemovedFields = removed
				}
			}

			// Check UI changes
			if oldForm.UIHash != newForm.UIHash {
				mod.UIChange = true
				log.UIChanges = true
			}

			// Check core field changes
			if oldForm.CoreHash != newForm.CoreHash {
				mod.CoreChange = true
				log.FormChanges = true
			}

			if mod.SchemaChange || mod.UIChange || mod.CoreChange {
				log.ModifiedForms = append(log.ModifiedForms, mod)
			}
		}
	}

	return log, nil
}

// compareFieldLists compares two lists of fields and returns added and removed fields with their types
func compareFieldLists(oldFields, newFields []FieldInfo) (added, removed []FieldChange) {
	// Create maps of field names to their types
	oldFieldMap := make(map[string]string) // field name -> type
	newFieldMap := make(map[string]string) // field name -> type

	// Populate field maps
	for _, field := range oldFields {
		oldFieldMap[field.Name] = field.Type
	}

	for _, field := range newFields {
		newFieldMap[field.Name] = field.Type

		// Check if field is new or has a different type
		oldType, exists := oldFieldMap[field.Name]
		if !exists {
			// Completely new field
			added = append(added, FieldChange{
				Name: field.Name,
				Type: field.Type,
			})
		} else if oldType != field.Type {
			// Field type changed - treat as removed and added
			removed = append(removed, FieldChange{
				Name: field.Name,
				Type: oldType,
			})
			added = append(added, FieldChange{
				Name: field.Name,
				Type: field.Type,
			})
		}
	}

	// Check for removed fields (present in old but not in new with same type)
	for _, field := range oldFields {
		if _, exists := newFieldMap[field.Name]; !exists {
			removed = append(removed, FieldChange{
				Name: field.Name,
				Type: field.Type,
			})
		}
	}

	return added, removed
}

// GenerateChangeLog generates a CHANGE_LOG.json by comparing two APP_INFO.json files
func (s *Service) GenerateChangeLog(oldAppInfo, newAppInfo []byte) ([]byte, error) {
	var oldInfo, newInfo AppInfo

	if err := json.Unmarshal(oldAppInfo, &oldInfo); err != nil {
		return nil, fmt.Errorf("failed to parse old app info: %w", err)
	}

	if err := json.Unmarshal(newAppInfo, &newInfo); err != nil {
		return nil, fmt.Errorf("failed to parse new app info: %w", err)
	}

	changeLog, err := CompareAppInfos(&oldInfo, &newInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to compare app infos: %w", err)
	}

	// Convert to JSON
	jsonData, err := json.MarshalIndent(changeLog, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal change log: %w", err)
	}

	return jsonData, nil
}

// GetChangeLogBetweenVersions gets the change log between two versions
func (s *Service) GetChangeLogBetweenVersions(versionA, versionB string) ([]byte, error) {
	// Read APP_INFO.json from both versions
	appInfoA, err := s.readAppInfo(versionA)
	if err != nil {
		return nil, fmt.Errorf("failed to read app info for version %s: %w", versionA, err)
	}

	appInfoB, err := s.readAppInfo(versionB)
	if err != nil {
		return nil, fmt.Errorf("failed to read app info for version %s: %w", versionB, err)
	}

	return s.GenerateChangeLog(appInfoA, appInfoB)
}

// readAppInfo reads the APP_INFO.json file for a specific version
func (s *Service) readAppInfo(version string) ([]byte, error) {
	versionPath := filepath.Join(s.versionsPath, version)
	appInfoPath := filepath.Join(versionPath, "APP_INFO.json")

	data, err := os.ReadFile(appInfoPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read APP_INFO.json: %w", err)
	}

	return data, nil
}
