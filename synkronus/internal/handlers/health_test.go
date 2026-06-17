package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestHealthCheck(t *testing.T) {
	// Create a test handler
	h, _ := createTestHandler()

	// Create a test request
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	// Call the handler
	h.HealthCheck(w, req)

	// Check response
	resp := w.Result()
	defer resp.Body.Close()

	// Check status code
	assert.Equal(t, http.StatusOK, resp.StatusCode, "Expected status code %d, got %d", http.StatusOK, resp.StatusCode)

	// Check content type
	contentType := resp.Header.Get("content-type")
	assert.Equal(t, "application/json", contentType, "Expected content type application/json, got %s", contentType)

	// Check response body
	body, err := io.ReadAll(resp.Body)
	assert.NoError(t, err, "Failed to read response body")

	var payload map[string]string
	err = json.Unmarshal(body, &payload)
	assert.NoError(t, err, "Expected JSON health response")

	assert.Equal(t, "ok", payload["status"], "Expected status=ok")
	assert.NotEmpty(t, payload["version"], "Expected version in health response")
	assert.NotEmpty(t, payload["timestamp"], "Expected timestamp in health response")
	_, err = time.Parse(time.RFC3339, payload["timestamp"])
	assert.NoError(t, err, "Expected timestamp in RFC3339 format")
}
