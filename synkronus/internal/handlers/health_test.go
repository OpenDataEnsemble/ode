package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
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
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, resp.StatusCode)
	}
	
	// Check content type
	contentType := resp.Header.Get("content-type")
	if contentType != "text/plain" {
		t.Errorf("Expected content type %s, got %s", "text/plain", contentType)
	}
	
	// Check response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("Failed to read response body: %v", err)
	}
	
	if string(body) != "OK" {
		t.Errorf("Expected response body %s, got %s", "OK", string(body))
	}
}
