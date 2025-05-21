package appbundle

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func createTestAppInfo(version string, forms map[string]FormInfo) *AppInfo {
	return &AppInfo{
		Version: version,
		Forms:   forms,
	}
}

func createTestFormInfo(schemaHash, uiHash, coreHash string, fields []FieldInfo) FormInfo {
	return FormInfo{
		FormHash: schemaHash,
		UIHash:   uiHash,
		CoreHash:  coreHash,
		Fields:    fields,
	}
}

func TestCompareAppInfos_NewForm(t *testing.T) {
	// Setup test data
	oldInfo := createTestAppInfo("0001", map[string]FormInfo{})
	
	newForms := map[string]FormInfo{
		"user": createTestFormInfo(
			"schema1", "ui1", "core1",
			[]FieldInfo{
				{Name: "username", Type: "string"},
				{Name: "age", Type: "number"},
			},
		),
	}
	newInfo := createTestAppInfo("0002", newForms)

	// Execute
	log, err := CompareAppInfos(oldInfo, newInfo)

	// Verify
	assert.NoError(t, err)
	assert.Equal(t, "0001", log.CompareVersionA)
	assert.Equal(t, "0002", log.CompareVersionB)
	assert.True(t, log.FormChanges)
	assert.Len(t, log.NewForms, 1)
	assert.Equal(t, "user", log.NewForms[0].Name)
	assert.Empty(t, log.RemovedForms)
}

func TestCompareAppInfos_RemovedForm(t *testing.T) {
	// Setup test data
	oldForms := map[string]FormInfo{
		"user": createTestFormInfo("schema1", "ui1", "core1", []FieldInfo{}),
	}
	oldInfo := createTestAppInfo("0001", oldForms)
	newInfo := createTestAppInfo("0002", map[string]FormInfo{})

	// Execute
	log, err := CompareAppInfos(oldInfo, newInfo)

	// Verify
	assert.NoError(t, err)
	assert.True(t, log.FormChanges)
	assert.Len(t, log.RemovedForms, 1)
	assert.Equal(t, "user", log.RemovedForms[0].Name)
	assert.Empty(t, log.NewForms)
}

func TestCompareAppInfos_ModifiedForm_FieldChanges(t *testing.T) {
	// Setup test data
	oldForms := map[string]FormInfo{
		"user": createTestFormInfo(
			"schema1", "ui1", "core1",
			[]FieldInfo{
				{Name: "username", Type: "string"},
				{Name: "age", Type: "string"}, // Will change to number
			},
		),
	}
	oldInfo := createTestAppInfo("0001", oldForms)

	newForms := map[string]FormInfo{
		"user": createTestFormInfo(
			"schema2", "ui1", "core1", // Schema changed, UI and core same
			[]FieldInfo{
				{Name: "username", Type: "string"}, // Same
				{Name: "age", Type: "number"},       // Type changed
				{Name: "email", Type: "string"},     // New field
			},
		),
	}
	newInfo := createTestAppInfo("0002", newForms)

	// Execute
	log, err := CompareAppInfos(oldInfo, newInfo)


	// Verify
	assert.NoError(t, err)
	assert.True(t, log.FormChanges)
	assert.False(t, log.UIChanges) // UI hash didn't change
	assert.Len(t, log.ModifiedForms, 1)

	mod := log.ModifiedForms[0]
	assert.Equal(t, "user", mod.FormName)
	assert.True(t, mod.SchemaChange)
	assert.False(t, mod.CoreChange)

	// Verify field changes
	assert.Len(t, mod.AddedFields, 2)
	assert.Len(t, mod.RemovedFields, 1)

	// Check added fields (including type-changed field)
	addedFields := make(map[string]string)
	for _, f := range mod.AddedFields {
		addedFields[f.Name] = f.Type
	}
	assert.Equal(t, "number", addedFields["age"])
	assert.Equal(t, "string", addedFields["email"])

	// Check removed fields (original type of changed field)
	assert.Equal(t, "string", mod.RemovedFields[0].Type)
}

func TestCompareAppInfos_TypeChangeDetection(t *testing.T) {
	// Setup test data
	oldForms := map[string]FormInfo{
		"product": createTestFormInfo(
			"schema1", "ui1", "core1",
			[]FieldInfo{
				{Name: "price", Type: "string"},
			},
		),
	}
	oldInfo := createTestAppInfo("0001", oldForms)

	newForms := map[string]FormInfo{
		"product": createTestFormInfo(
			"schema2", "ui1", "core1",
			[]FieldInfo{
				{Name: "price", Type: "number"}, // Type changed
			},
		),
	}
	newInfo := createTestAppInfo("0002", newForms)

	// Execute
	log, err := CompareAppInfos(oldInfo, newInfo)

	// Verify
	assert.NoError(t, err)
	assert.Len(t, log.ModifiedForms, 1)
	mod := log.ModifiedForms[0]
	
	// Should show price as both removed (string) and added (number)
	assert.Len(t, mod.AddedFields, 1)
	assert.Len(t, mod.RemovedFields, 1)
	
	assert.Equal(t, "price", mod.AddedFields[0].Name)
	assert.Equal(t, "number", mod.AddedFields[0].Type)
	assert.Equal(t, "price", mod.RemovedFields[0].Name)
	assert.Equal(t, "string", mod.RemovedFields[0].Type)
}

func TestGenerateChangeLog_JSON(t *testing.T) {
	// Setup test data
	oldInfo := &AppInfo{
		Version: "0001",
		Forms: map[string]FormInfo{
			"user": {
				FormHash: "old_schema",
				UIHash:   "ui1",
				CoreHash:  "core1",
				Fields: []FieldInfo{
					{Name: "username", Type: "string"},
				},
			},
		},
	}

	newInfo := &AppInfo{
		Version: "0002",
		Forms: map[string]FormInfo{
			"user": {
				FormHash: "new_schema",
				UIHash:   "ui1",
				CoreHash:  "core1",
				Fields: []FieldInfo{
					{Name: "username", Type: "string"},
					{Name: "email", Type: "string"},
				},
			},
		},
	}

	// Execute
	oldJSON, _ := json.Marshal(oldInfo)
	newJSON, _ := json.Marshal(newInfo)

	service := &Service{}
	changeLogJSON, err := service.GenerateChangeLog(oldJSON, newJSON)

	// Verify
	assert.NoError(t, err)
	
	var result map[string]interface{}
	err = json.Unmarshal(changeLogJSON, &result)
	assert.NoError(t, err)

	// Basic structure check
	assert.Equal(t, "0001", result["compare_version_a"])
	assert.Equal(t, "0002", result["compare_version_b"])
	assert.True(t, result["form_changes"].(bool))
	
	// Check modified forms
	modifiedForms := result["modified_forms"].([]interface{})
	assert.Len(t, modifiedForms, 1)
	
	userMod := modifiedForms[0].(map[string]interface{})
	assert.Equal(t, "user", userMod["form"])
	assert.True(t, userMod["schema_changed"].(bool))
	
	// Check added fields
	addedFields := userMod["added_fields"].([]interface{})
	assert.Len(t, addedFields, 1)
	addedField := addedFields[0].(map[string]interface{})
	assert.Equal(t, "email", addedField["field"])
	assert.Equal(t, "string", addedField["type"])
}

func TestGetChangeLogBetweenVersions(t *testing.T) {
	// Setup test service with mock file reading
	service := &Service{
		versionsPath: "testdata/versions",
	}

	// Test with non-existent versions (should error)
	_, err := service.GetChangeLogBetweenVersions("9999", "9998")
	assert.Error(t, err)
}
