package appbundle

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

const appInfoFixtureIndexHTML = `<html><body><h1>HELLO</h1></body></html>`

var appInfoFixtureUISchema = map[string]any{
	"type": "VerticalLayout",
	"elements": []any{
		map[string]any{
			"type": "HorizontalLayout",
			"elements": []any{
				map[string]any{
					"type":  "Control",
					"scope": "#/properties/name",
				},
				map[string]any{
					"type":  "Control",
					"scope": "#/properties/personalData/properties/age",
				},
				map[string]any{
					"type":  "Control",
					"scope": "#/properties/birthDate",
				},
			},
		},
		map[string]any{
			"type": "Label",
			"text": "Additional Information",
		},
		map[string]any{
			"type": "HorizontalLayout",
			"elements": []any{
				map[string]any{
					"type":  "Control",
					"scope": "#/properties/personalData/properties/height",
				},
				map[string]any{
					"type":  "Control",
					"scope": "#/properties/nationality",
				},
				map[string]any{
					"type":       "Control",
					"scope":      "#/properties/occupation",
					"suggestion": []string{"Accountant", "Engineer", "Freelancer", "Journalism", "Physician", "Student", "Teacher", "Other"},
				},
			},
		},
	},
}

// createAppInfoFixtureBundle replaces the historical binary ZIP fixtures with
// small bundles generated on demand for app-info and version-change tests.
func createAppInfoFixtureBundle(t *testing.T, includeVersionTwoChanges bool) string {
	t.Helper()

	schema := appInfoFixtureSchema(includeVersionTwoChanges)

	schemaJSON, err := json.Marshal(schema)
	if err != nil {
		t.Fatalf("failed to marshal app-info fixture schema: %v", err)
	}

	uiJSON, err := json.Marshal(appInfoFixtureUISchema)
	if err != nil {
		t.Fatalf("failed to marshal app-info fixture UI schema: %v", err)
	}

	files := map[string][]byte{
		"app/index.html":            []byte(appInfoFixtureIndexHTML),
		"forms/example/schema.json": schemaJSON,
		"forms/example/ui.json":     uiJSON,
	}

	if includeVersionTwoChanges {
		files["app/THIS_IS_VERSION_2.txt"] = []byte("Something...")
	}

	bundlePath := filepath.Join(t.TempDir(), "app-info-fixture.zip")
	if err := writeFixtureZip(bundlePath, files); err != nil {
		t.Fatalf("failed to create app-info fixture bundle: %v", err)
	}

	return bundlePath
}

func appInfoFixtureSchema(includeLastname bool) map[string]any {
	properties := map[string]any{
		"name": map[string]any{
			"type":        "string",
			"minLength":   3,
			"description": "Please enter your name",
		},
		"vegetarian": map[string]any{
			"type": "boolean",
		},
		"birthDate": map[string]any{
			"type":   "string",
			"format": "date",
		},
		"nationality": map[string]any{
			"type": "string",
			"enum": []string{"DE", "IT", "JP", "US", "RU", "Other"},
		},
		"personalData": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"age": map[string]any{
					"type":        "integer",
					"description": "Please enter your age.",
				},
				"height": map[string]any{
					"type": "number",
				},
				"drivingSkill": map[string]any{
					"type":    "number",
					"maximum": 10,
					"minimum": 1,
					"default": 7,
				},
			},
			"required": []string{"age", "height"},
		},
		"occupation": map[string]any{
			"type": "string",
		},
		"postalCode": map[string]any{
			"type":      "string",
			"maxLength": 5,
		},
	}

	if includeLastname {
		properties["lastname"] = map[string]any{
			"type":        "string",
			"minLength":   3,
			"description": "Please enter your last name",
		}
	}

	return map[string]any{
		"type":       "object",
		"properties": properties,
		"required":   []string{"occupation", "nationality"},
	}
}

func writeFixtureZip(path string, files map[string][]byte) error {
	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create zip file: %w", err)
	}

	writer := zip.NewWriter(file)

	// Stable entry ordering makes the generated fixture reproducible.
	names := make([]string, 0, len(files))
	for name := range files {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		entry, err := writer.Create(name)
		if err != nil {
			_ = writer.Close()
			_ = file.Close()
			return fmt.Errorf("create zip entry %q: %w", name, err)
		}

		if _, err := entry.Write(files[name]); err != nil {
			_ = writer.Close()
			_ = file.Close()
			return fmt.Errorf("write zip entry %q: %w", name, err)
		}
	}

	if err := writer.Close(); err != nil {
		_ = file.Close()
		return fmt.Errorf("close zip writer: %w", err)
	}

	if err := file.Close(); err != nil {
		return fmt.Errorf("close zip file: %w", err)
	}

	return nil
}
