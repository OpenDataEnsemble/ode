package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetAPIVersions(t *testing.T) {
	// Create a test handler
	h, _ := createTestHandler()

	// Create a test request
	req := httptest.NewRequest(http.MethodGet, "/api/versions", nil)
	w := httptest.NewRecorder()

	// Call the handler
	h.GetAPIVersions(w, req)

	// Check response
	resp := w.Result()
	defer resp.Body.Close()

	// Check status code
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
	}

	// Check content type
	contentType := resp.Header.Get("content-type")
	if contentType != "application/json" {
		t.Errorf("Expected content type %s, got %s", "application/json", contentType)
	}

	// Check response body structure
	var versionsResp APIVersionsResponse
	if err := json.NewDecoder(resp.Body).Decode(&versionsResp); err != nil {
		t.Fatalf("Failed to decode response body: %v", err)
	}

	// Verify response fields
	if versionsResp.Current == "" {
		t.Error("Expected current version to be non-empty")
	}

	if len(versionsResp.Versions) == 0 {
		t.Error("Expected versions array to be non-empty")
	}

	// Check that current version exists in versions array
	foundCurrent := false
	for _, v := range versionsResp.Versions {
		if v.Version == versionsResp.Current {
			foundCurrent = true
			break
		}
	}

	if !foundCurrent {
		t.Errorf("Current version %s not found in versions array", versionsResp.Current)
	}
}
