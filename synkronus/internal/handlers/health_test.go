package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

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
	assert.Equal(t, "text/plain", contentType, "Expected content type text/plain, got %s", contentType)

	// Check response body
	body, err := io.ReadAll(resp.Body)
	assert.NoError(t, err, "Failed to read response body")
	assert.Equal(t, "OK", string(body), "Expected response body 'OK', got '%s'")
}
