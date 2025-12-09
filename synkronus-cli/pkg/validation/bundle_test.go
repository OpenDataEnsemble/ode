package validation

import (
	"archive/zip"
	"bytes"
	"os"
	"strings"
	"testing"
)

func createTestBundle(t *testing.T, files map[string]string) string {
	buf := new(bytes.Buffer)
	w := zip.NewWriter(buf)

	for name, content := range files {
		f, err := w.Create(name)
		if err != nil {
			t.Fatalf("failed to create zip entry %s: %v", name, err)
		}
		_, err = f.Write([]byte(content))
		if err != nil {
			t.Fatalf("failed to write zip entry content %s: %v", name, err)
		}
	}

	err := w.Close()
	if err != nil {
		t.Fatalf("failed to close zip writer: %v", err)
	}

	// Write to temp file
	tmpFile, err := os.CreateTemp("", "test-bundle-*.zip")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer tmpFile.Close()

	_, err = tmpFile.Write(buf.Bytes())
	if err != nil {
		t.Fatalf("failed to write zip data: %v", err)
	}

	return tmpFile.Name()
}

func TestValidateBundle(t *testing.T) {
	tests := []struct {
		name    string
		files   map[string]string
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid bundle",
			files: map[string]string{
				"app/index.html":                "<html></html>",
				"forms/user/schema.json":        `{"type": "object", "properties": {"name": {"type": "string", "x-question-type": "text"}}}`,
				"forms/user/ui.json":            "{}",
				"renderers/button/renderer.jsx": "export default function Button() {}",
			},
			wantErr: false,
		},
		{
			name: "missing app/index.html",
			files: map[string]string{
				"forms/user/schema.json": `{"type": "object"}`,
				"forms/user/ui.json":     "{}",
			},
			wantErr: true,
			errMsg:  "missing app/index.html",
		},
		{
			name: "invalid top-level directory",
			files: map[string]string{
				"app/index.html":       "<html></html>",
				"invalid-dir/file.txt": "should not be here",
			},
			wantErr: true,
			errMsg:  "unexpected top-level directory",
		},
		{
			name: "missing schema.json",
			files: map[string]string{
				"app/index.html":     "<html></html>",
				"forms/user/ui.json": "{}",
			},
			wantErr: true,
			errMsg:  "missing required files",
		},
		{
			name: "missing ui.json",
			files: map[string]string{
				"app/index.html":          "<html></html>",
				"forms/user/schema.json":  `{"type": "object"}`,
			},
			wantErr: true,
			errMsg:  "missing required files",
		},
		{
			name: "invalid form file path",
			files: map[string]string{
				"app/index.html":              "<html></html>",
				"forms/user/invalid-file.txt":  "should not be here",
				"forms/user/schema.json":       `{"type": "object"}`,
				"forms/user/ui.json":          "{}",
			},
			wantErr: true,
			errMsg:  "invalid form file path",
		},
		{
			name: "invalid renderer structure - wrong extension",
			files: map[string]string{
				"app/index.html":               "<html></html>",
				"renderers/button/renderer.js": "should be .jsx",
			},
			wantErr: true,
			errMsg:  "invalid renderer file path",
		},
		{
			name: "invalid renderer structure - wrong filename",
			files: map[string]string{
				"app/index.html":                "<html></html>",
				"renderers/button/component.jsx": "should be renderer.jsx",
			},
			wantErr: true,
			errMsg:  "invalid renderer file path",
		},
		{
			name: "missing renderer reference",
			files: map[string]string{
				"app/index.html":                "<html></html>",
				"forms/user/schema.json":         `{"type": "object", "properties": {"field": {"type": "string", "x-question-type": "custom-renderer"}}}`,
				"forms/user/ui.json":            "{}",
			},
			wantErr: true,
			errMsg:  "references non-existent renderer",
		},
		{
			name: "valid renderer reference",
			files: map[string]string{
				"app/index.html":                "<html></html>",
				"forms/user/schema.json":         `{"type": "object", "properties": {"field": {"type": "string", "x-question-type": "custom-renderer"}}}`,
				"forms/user/ui.json":            "{}",
				"renderers/custom-renderer/renderer.jsx": "export default function CustomRenderer() {}",
			},
			wantErr: false,
		},
		{
			name: "built-in renderer reference",
			files: map[string]string{
				"app/index.html":                "<html></html>",
				"forms/user/schema.json":         `{"type": "object", "properties": {"field": {"type": "string", "x-question-type": "text"}}}`,
				"forms/user/ui.json":            "{}",
			},
			wantErr: false,
		},
		{
			name: "invalid JSON in schema",
			files: map[string]string{
				"app/index.html":       "<html></html>",
				"forms/user/schema.json": "invalid json {",
				"forms/user/ui.json":    "{}",
			},
			wantErr: true,
			errMsg:  "invalid JSON",
		},
		{
			name: "invalid JSON in ui",
			files: map[string]string{
				"app/index.html":       "<html></html>",
				"forms/user/schema.json": `{"type": "object"}`,
				"forms/user/ui.json":   "invalid json {",
			},
			wantErr: true,
			errMsg:  "invalid JSON",
		},
		{
			name: "schema.json outside forms/ directory should be ignored",
			files: map[string]string{
				"app/index.html":        "<html></html>",
				"app/schema.json":       `{"type": "object", "properties": {"field": {"type": "string", "x-question-type": "missing-renderer"}}}`,
				"forms/user/schema.json": `{"type": "object", "properties": {"name": {"type": "string", "x-question-type": "text"}}}`,
				"forms/user/ui.json":    "{}",
			},
			wantErr: false, // Should pass because schema.json files outside forms/ are ignored (app/schema.json should not be processed)
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bundlePath := createTestBundle(t, tt.files)
			defer os.Remove(bundlePath)

			err := ValidateBundle(bundlePath)
			if tt.wantErr {
				if err == nil {
					t.Errorf("ValidateBundle() expected error but got none")
					return
				}
				if tt.errMsg != "" && !contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidateBundle() error = %v, want error containing %q", err, tt.errMsg)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateBundle() unexpected error = %v", err)
				}
			}
		})
	}
}

func TestGetBundleInfo(t *testing.T) {
	files := map[string]string{
		"app/index.html":                "<html></html>",
		"forms/user/schema.json":        `{"type": "object"}`,
		"forms/user/ui.json":            "{}",
		"forms/admin/schema.json":       `{"type": "object"}`,
		"forms/admin/ui.json":           "{}",
		"renderers/button/renderer.jsx": "export default function Button() {}",
		"renderers/custom/renderer.jsx": "export default function Custom() {}",
	}

	bundlePath := createTestBundle(t, files)
	defer os.Remove(bundlePath)

	info, err := GetBundleInfo(bundlePath)
	if err != nil {
		t.Fatalf("GetBundleInfo() error = %v", err)
	}

	if info["file_count"].(int) != 7 {
		t.Errorf("GetBundleInfo() file_count = %v, want 7", info["file_count"])
	}
	if info["form_count"].(int) != 2 {
		t.Errorf("GetBundleInfo() form_count = %v, want 2", info["form_count"])
	}
	if info["renderer_count"].(int) != 2 {
		t.Errorf("GetBundleInfo() renderer_count = %v, want 2", info["renderer_count"])
	}
	if !info["has_app_index"].(bool) {
		t.Errorf("GetBundleInfo() has_app_index = %v, want true", info["has_app_index"])
	}
}

func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}

