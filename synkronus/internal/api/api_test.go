package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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

	// Create a mock attachment manifest service
	mockAttachmentManifestService := &mocks.MockAttachmentManifestService{}

	// Create a mock config
	mockConfig := mocks.NewTestConfig()

	// Create a mock handler for testing
	mockDataExportService := mocks.NewMockDataExportService()
	mockHandler := handlers.NewHandler(
		log,
		mockConfig,
		mockAuthService,
		mockAppBundleService,
		mockSyncService,
		mockUserService,
		mockVersionService,
		mockAttachmentManifestService,
		mockDataExportService,
		nil,
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
	if contentType != "application/json" {
		t.Errorf("Expected content type %s, got %s", "application/json", contentType)
	}

	// Check response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("Failed to read response body: %v", err)
	}

	var payload map[string]string
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("Expected JSON health response, got error: %v body: %s", err, string(body))
	}
	if payload["status"] != "ok" {
		t.Errorf("Expected health status %q, got %q", "ok", payload["status"])
	}
	if payload["version"] == "" {
		t.Error("Expected version in health response")
	}
	if payload["timestamp"] == "" {
		t.Error("Expected timestamp in health response")
	} else if _, err := time.Parse(time.RFC3339, payload["timestamp"]); err != nil {
		t.Errorf("Expected timestamp in RFC3339 format, got %q (%v)", payload["timestamp"], err)
	}
}
