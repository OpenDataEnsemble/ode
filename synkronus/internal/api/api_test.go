package api

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/opendataensemble/synkronus/internal/handlers"
	"github.com/opendataensemble/synkronus/internal/handlers/mocks"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

func TestNewRouter(t *testing.T) {
	// Create a logger for testing
	log := logger.NewLogger()

	// Create mock services for testing
	mockAuthService := mocks.NewMockAuthService()
	mockAppBundleService := mocks.NewMockAppBundleService()
	mockSyncService := mocks.NewMockSyncService()
	mockUserService := mocks.NewMockUserService()

	// Create a mock version service
	mockVersionService := mocks.NewMockVersionService()

	// Create a mock handler for testing
	mockHandler := handlers.NewHandler(
		log,
		mockAuthService,
		mockAppBundleService,
		mockSyncService,
		mockUserService,
		mockVersionService,
	)

	// Create a new router
	router := NewRouter(log, mockHandler)

	// Ensure router is not nil
	if router == nil {
		t.Fatal("Router should not be nil")
	}

	// Test health endpoint
	server := httptest.NewServer(router)
	defer server.Close()

	// Make a request to the health endpoint
	resp, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatalf("Failed to make request: %v", err)
	}
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
