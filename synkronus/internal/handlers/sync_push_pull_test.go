package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/opendataensemble/synkronus/pkg/sync"
)

func TestPushThenPull(t *testing.T) {
	h, _ := createTestHandler()

	t.Run("Push initial observations", func(t *testing.T) {
		t.Log("1. Pushing initial observations...")
		reqBody := SyncPushRequest{
			TransmissionID: "test-transmission-1",
			ClientID:       "test-client",
			Records: []sync.Observation{
				{
					ObservationID: "test-obs-1",
					FormType:      "test_form",
					FormVersion:   "1.0",
					Data:          json.RawMessage(`{"field1":"value1"}`),
					CreatedAt:     "2025-06-25T12:00:00Z",
					UpdatedAt:     "2025-06-25T12:00:00Z",
					Deleted:       false,
				},
				{
					ObservationID: "test-obs-2",
					FormType:      "test_form",
					FormVersion:   "1.0",
					Data:          json.RawMessage(`{"field2":"value2"}`),
					CreatedAt:     "2025-06-25T12:00:00Z",
					UpdatedAt:     "2025-06-25T12:00:00Z",
					Deleted:       false,
				},
			},
		}

		reqBytes, _ := json.Marshal(reqBody)
		rr := httptest.NewRecorder()
		h.Push(rr, httptest.NewRequest("POST", "/sync/push", bytes.NewReader(reqBytes)))

		if status := rr.Code; status != http.StatusOK {
			t.Fatalf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
		}

		var resp SyncPushResponse
		if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp.CurrentVersion <= 0 {
			t.Error("expected current version to be greater than 0")
		}
		if resp.SuccessCount != len(reqBody.Records) {
			t.Errorf("expected success count to be %d, got %d", len(reqBody.Records), resp.SuccessCount)
		}
		t.Logf("Initial push successful. Current version: %d, Success count: %d", resp.CurrentVersion, resp.SuccessCount)

		// Now pull the observations back
		t.Run("Pull observations after push", func(t *testing.T) {
			t.Log("2. Pulling observations after initial push...")
			reqBody := SyncPullRequest{
				ClientID:    "test-client",
				SchemaTypes: []string{"test_form"},
			}

			reqBytes, _ := json.Marshal(reqBody)
			rr := httptest.NewRecorder()
			h.Pull(rr, httptest.NewRequest("POST", "/sync/pull", bytes.NewReader(reqBytes)))

			if status := rr.Code; status != http.StatusOK {
				t.Fatalf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
			}

			var pullResp SyncPullResponse
			if err := json.Unmarshal(rr.Body.Bytes(), &pullResp); err != nil {
				t.Fatalf("failed to decode pull response: %v", err)
			}

			// Verify we got both observations back
			if len(pullResp.Records) < 2 {
				t.Fatalf("expected at least 2 records, got %d", len(pullResp.Records))
			}

			// Verify the observations match what we pushed
			foundObs1, foundObs2 := false, false
			for _, obs := range pullResp.Records {
				switch obs.ObservationID {
				case "test-obs-1":
					foundObs1 = true
					if string(obs.Data) != `{"field1":"value1"}` {
						t.Errorf("unexpected data for obs-1: %s", string(obs.Data))
					}
				case "test-obs-2":
					foundObs2 = true
					if string(obs.Data) != `{"field2":"value2"}` {
						t.Errorf("unexpected data for obs-2: %s", string(obs.Data))
					}
				}
			}

			if !foundObs1 || !foundObs2 {
				t.Error("not all test observations were found in pull response")
			}

			// Save the current version for the update test
			currentVersion := pullResp.CurrentVersion
			if currentVersion <= 0 {
				t.Fatal("invalid current version from pull response")
			}
			t.Logf("Initial pull successful. Current version: %d, Records found: %d", currentVersion, len(pullResp.Records))

			// Test updating an observation
			t.Run("Update observation and verify change", func(t *testing.T) {
				t.Logf("3. Updating observation test-obs-1 at version %d...", currentVersion)
				// Update obs-1
				reqBody := SyncPushRequest{
					TransmissionID: "test-transmission-2",
					ClientID:       "test-client",
					Records: []sync.Observation{
						{
							ObservationID: "test-obs-1",
							FormType:      "test_form",
							FormVersion:   "1.0",
							Data:          json.RawMessage(`{"field1":"updated_value1"}`),
							CreatedAt:     "2025-06-25T12:00:00Z",
							UpdatedAt:     "2025-06-25T12:05:00Z", // Updated time
							Deleted:       false,
						},
					},
				}

				reqBytes, _ := json.Marshal(reqBody)
				rr := httptest.NewRecorder()
				h.Push(rr, httptest.NewRequest("POST", "/sync/push", bytes.NewReader(reqBytes)))

				if status := rr.Code; status != http.StatusOK {
					t.Fatalf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
				}

				// Pull with since_version set to the version before our update
				sinceVersion := currentVersion
				reqBodyPull := SyncPullRequest{
					ClientID:    "test-client",
					SchemaTypes: []string{"test_form"},
					Since: &SyncPullRequestSince{
						Version: sinceVersion,
					},
				}

				reqBytes, _ = json.Marshal(reqBodyPull)
				rr = httptest.NewRecorder()
				h.Pull(rr, httptest.NewRequest("POST", "/sync/pull", bytes.NewReader(reqBytes)))

				if status := rr.Code; status != http.StatusOK {
					t.Fatalf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
				}

				var pullResp SyncPullResponse
				if err := json.Unmarshal(rr.Body.Bytes(), &pullResp); err != nil {
					t.Fatalf("failed to decode pull response: %v", err)
				}

				// We should get back the updated observation
				if len(pullResp.Records) == 0 {
					t.Fatal("expected at least one updated record, got none")
				}

				// Find our updated observation
				var updatedObs *sync.Observation
				for i, obs := range pullResp.Records {
					if obs.ObservationID == "test-obs-1" {
						updatedObs = &pullResp.Records[i]
						break
					}
				}

				if updatedObs == nil {
					t.Fatal("did not find updated observation in pull response")
				}

				// Verify the data was updated
				if string(updatedObs.Data) != `{"field1":"updated_value1"}` {
					t.Errorf("unexpected data for updated record: %s", string(updatedObs.Data))
				}

				// The new version should be greater than our previous version
				t.Logf("4. Pulling changes since version %d...", currentVersion)
				if pullResp.CurrentVersion <= currentVersion {
					t.Errorf("expected new version (%d) to be greater than previous version (%d)",
						pullResp.CurrentVersion, currentVersion)
				} else {
					t.Logf("Success! New version: %d > previous version: %d", pullResp.CurrentVersion, currentVersion)
				}
			})
		})
	})
}
