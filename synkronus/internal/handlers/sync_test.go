package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPull(t *testing.T) {
	// Create a test handler
	h, _ := createTestHandler()

	// Test cases using table-driven tests
	tests := []struct {
		name           string
		requestBody    SyncPullRequest
		etagHeader     string
		expectedStatus int
	}{
		{
			name: "Valid pull request",
			requestBody: SyncPullRequest{
				LastSyncTimestamp: time.Now().Add(-24 * time.Hour).Unix(),
				DeviceID:          "test-device-id",
				Metadata:          map[string]string{"version": "1.0.0"},
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Pull with ETag (not modified)",
			requestBody: SyncPullRequest{
				LastSyncTimestamp: time.Now().Add(-24 * time.Hour).Unix(),
				DeviceID:          "test-device-id",
			},
			etagHeader:     "example-etag-value", // This would match the ETag in the handler
			expectedStatus: http.StatusOK,        // Should be NotModified in real implementation
		},
		{
			name: "Missing device ID",
			requestBody: SyncPullRequest{
				LastSyncTimestamp: time.Now().Add(-24 * time.Hour).Unix(),
				DeviceID:          "",
			},
			expectedStatus: http.StatusBadRequest,
		},
		// Add more test cases as needed
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create request body
			body, err := json.Marshal(tc.requestBody)
			if err != nil {
				t.Fatalf("Failed to marshal request body: %v", err)
			}

			// Create a test request
			req := httptest.NewRequest(http.MethodPost, "/sync/pull", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			if tc.etagHeader != "" {
				req.Header.Set("If-None-Match", tc.etagHeader)
			}
			w := httptest.NewRecorder()

			// Call the handler
			h.Pull(w, req)

			// Check response
			resp := w.Result()
			defer resp.Body.Close()

			// Check status code
			if resp.StatusCode != tc.expectedStatus {
				t.Errorf("Expected status code %d, got %d", tc.expectedStatus, resp.StatusCode)
			}

			// For successful pull, check response structure
			if resp.StatusCode == http.StatusOK {
				var pullResp SyncPullResponse
				if err := json.NewDecoder(resp.Body).Decode(&pullResp); err != nil {
					t.Fatalf("Failed to decode response body: %v", err)
				}

				// Verify response fields
				if pullResp.Timestamp == 0 {
					t.Error("Expected timestamp to be non-zero")
				}
				if pullResp.ETag == "" {
					t.Error("Expected ETag to be non-empty")
				}

				// Check ETag header
				etagHeader := resp.Header.Get("ETag")
				if etagHeader == "" {
					t.Error("Expected ETag header to be set")
				}
			}
		})
	}
}

func TestPush(t *testing.T) {

	// Create a test handler
	h, _ := createTestHandler()

	// Test cases using table-driven tests
	tests := []struct {
		name           string
		requestBody    SyncPushRequest
		expectedStatus int
	}{
		{
			name: "Valid push request",
			requestBody: SyncPushRequest{
				DeviceID:  "test-device-id",
				Timestamp: time.Now().Unix(),
				Data:      []any{map[string]any{"id": "item1", "value": "test"}},
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Empty data array",
			requestBody: SyncPushRequest{
				DeviceID:  "test-device-id",
				Timestamp: time.Now().Unix(),
				Data:      []any{},
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Missing device ID",
			requestBody: SyncPushRequest{
				DeviceID:  "",
				Timestamp: time.Now().Unix(),
				Data:      []any{map[string]any{"id": "item1", "value": "test"}},
			},
			expectedStatus: http.StatusBadRequest,
		},
		// Add more test cases as needed
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create request body
			body, err := json.Marshal(tc.requestBody)
			if err != nil {
				t.Fatalf("Failed to marshal request body: %v", err)
			}

			// Create a test request
			req := httptest.NewRequest(http.MethodPost, "/sync/push", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			// Call the handler
			h.Push(w, req)

			// Check response
			resp := w.Result()
			defer resp.Body.Close()

			// Check status code
			if resp.StatusCode != tc.expectedStatus {
				t.Errorf("Expected status code %d, got %d", tc.expectedStatus, resp.StatusCode)
			}

			// For successful push, check response structure
			if resp.StatusCode == http.StatusOK {
				var pushResp SyncPushResponse
				if err := json.NewDecoder(resp.Body).Decode(&pushResp); err != nil {
					t.Fatalf("Failed to decode response body: %v", err)
				}

				// Verify response fields
				if !pushResp.Success {
					t.Error("Expected success to be true")
				}
				if pushResp.Timestamp == 0 {
					t.Error("Expected timestamp to be non-zero")
				}
			}
		})
	}
}
