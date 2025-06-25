package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/opendataensemble/synkronus/pkg/sync"
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
				ClientID: "test-client-id",
				Since: &SyncPullRequestSince{
					Version: 1,
					ID:      "test-id",
				},
				SchemaTypes: []string{"observation"},
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Pull without since parameter",
			requestBody: SyncPullRequest{
				ClientID:    "test-client-id",
				SchemaTypes: []string{"observation"},
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Missing client ID",
			requestBody: SyncPullRequest{
				ClientID: "",
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
				if pullResp.CurrentVersion <= 0 {
					t.Error("Expected current_version to be positive")
				}
				if pullResp.ChangeCutoff < 0 {
					t.Error("Expected change_cutoff to be non-negative")
				}
				// Records should be initialized as an empty slice, not nil
				if pullResp.Records == nil {
					t.Error("Expected records array to be initialized (not nil)")
				}
				// Verify optional fields are present
				if pullResp.HasMore == nil {
					t.Error("Expected has_more field to be present")
				}
				if pullResp.SyncFormatVersion == nil {
					t.Error("Expected sync_format_version field to be present")
				} else if *pullResp.SyncFormatVersion != "1.0" {
					t.Errorf("Expected sync_format_version to be '1.0', got '%s'", *pullResp.SyncFormatVersion)
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
				TransmissionID: "test-transmission-123",
				ClientID:       "test-client-id",
				Records: []sync.Observation{
					{
						ObservationID: "obs-1",
						FormType:      "survey",
						FormVersion:   "1.0",
						Data:          `{"question1": "answer1"}`,
						CreatedAt:     "2025-06-25T12:00:00Z",
						UpdatedAt:     "2025-06-25T12:00:00Z",
						Deleted:       false,
					},
				},
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Empty records array",
			requestBody: SyncPushRequest{
				TransmissionID: "test-transmission-124",
				ClientID:       "test-client-id",
				Records:        []sync.Observation{},
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Missing transmission ID",
			requestBody: SyncPushRequest{
				TransmissionID: "",
				ClientID:       "test-client-id",
				Records: []sync.Observation{
					{
						ObservationID: "obs-1",
						FormType:      "survey",
						FormVersion:   "1.0",
						Data:          `{"question1": "answer1"}`,
						CreatedAt:     "2025-06-25T12:00:00Z",
						UpdatedAt:     "2025-06-25T12:00:00Z",
						Deleted:       false,
					},
				},
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Missing client ID",
			requestBody: SyncPushRequest{
				TransmissionID: "test-transmission-125",
				ClientID:       "",
				Records: []sync.Observation{
					{
						ObservationID: "obs-1",
						FormType:      "survey",
						FormVersion:   "1.0",
						Data:          `{"question1": "answer1"}`,
						CreatedAt:     "2025-06-25T12:00:00Z",
						UpdatedAt:     "2025-06-25T12:00:00Z",
						Deleted:       false,
					},
				},
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Record with missing observation_id",
			requestBody: SyncPushRequest{
				TransmissionID: "test-transmission-126",
				ClientID:       "test-client-id",
				Records: []sync.Observation{
					{
						ObservationID: "", // Missing observation_id
						FormType:      "survey",
						FormVersion:   "1.0",
						Data:          `{"question1": "answer1"}`,
						CreatedAt:     "2025-06-25T12:00:00Z",
						UpdatedAt:     "2025-06-25T12:00:00Z",
						Deleted:       false,
					},
				},
			},
			expectedStatus: http.StatusOK, // Should still return OK but with failed records
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
				if pushResp.CurrentVersion <= 0 {
					t.Error("Expected current_version to be positive")
				}
				if pushResp.SuccessCount < 0 {
					t.Error("Expected success_count to be non-negative")
				}
				
				// Check specific test case expectations
				if tc.name == "Record with missing observation_id" {
					if len(pushResp.FailedRecords) == 0 {
						t.Error("Expected failed_records to contain the invalid record")
					}
					if pushResp.SuccessCount != 0 {
						t.Error("Expected success_count to be 0 for invalid records")
					}
				}
			}
		})
	}
}
