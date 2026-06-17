package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/opendataensemble/synkronus/pkg/sync"
)

func TestPull_repositoryGenerationMismatch_returns409(t *testing.T) {
	h, mockSync, _ := createTestHandlerWithSync()
	mockSync.SetRepositoryGeneration(5)

	body, err := json.Marshal(SyncPullRequest{
		ClientID: "test-client",
		Since: &SyncPullRequestSince{
			Version: 0,
		},
		RepositoryGeneration: int64Ptr(4),
	})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/sync/pull", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	// No x-repository-generation header: parser uses body (4) vs server (5)
	w := httptest.NewRecorder()
	h.Pull(w, req)

	resp := w.Result()
	t.Cleanup(func() { _ = resp.Body.Close() })

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected HTTP 409 Conflict, got %d", resp.StatusCode)
	}
	var er ErrorResponse
	if err := json.NewDecoder(resp.Body).Decode(&er); err != nil {
		t.Fatalf("decode error body: %v", err)
	}
	if er.Code != CodeRepositoryResetRequired {
		t.Fatalf("expected code %q, got %q", CodeRepositoryResetRequired, er.Code)
	}
	hdr := resp.Header.Get(sync.HeaderRepositoryGeneration)
	if hdr != "5" {
		t.Fatalf("expected %s header %q, got %q", sync.HeaderRepositoryGeneration, "5", hdr)
	}
}

func TestPull_repositoryGenerationMatch_headerWinsOverBody_ok(t *testing.T) {
	h, mockSync, _ := createTestHandlerWithSync()
	mockSync.SetRepositoryGeneration(5)

	body, err := json.Marshal(SyncPullRequest{
		ClientID: "test-client",
		// Intentionally inconsistent with header — header must win (OpenAPI contract).
		RepositoryGeneration: int64Ptr(1),
	})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/sync/pull", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(sync.HeaderRepositoryGeneration, "5")
	w := httptest.NewRecorder()
	h.Pull(w, req)

	resp := w.Result()
	t.Cleanup(func() { _ = resp.Body.Close() })

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected HTTP 200, got %d", resp.StatusCode)
	}
}

func TestPull_repositoryGenerationMismatch_header_returns409(t *testing.T) {
	h, mockSync, _ := createTestHandlerWithSync()
	mockSync.SetRepositoryGeneration(5)

	body, err := json.Marshal(SyncPullRequest{
		ClientID:             "test-client",
		RepositoryGeneration: int64Ptr(5),
	})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/sync/pull", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(sync.HeaderRepositoryGeneration, "4")
	w := httptest.NewRecorder()
	h.Pull(w, req)

	resp := w.Result()
	t.Cleanup(func() { _ = resp.Body.Close() })

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected HTTP 409, got %d", resp.StatusCode)
	}
}

func TestPush_emptyRecords_missingRepositoryGeneration_ok(t *testing.T) {
	h, mockSync, _ := createTestHandlerWithSync()
	mockSync.SetRepositoryGeneration(5)

	body, err := json.Marshal(SyncPushRequest{
		TransmissionID: "tx-empty",
		ClientID:       "fresh-install",
		Records:        []sync.Observation{},
		// No RepositoryGeneration, no header — same fresh-install contract as Pull.
	})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/sync/push", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Push(w, req)

	resp := w.Result()
	t.Cleanup(func() { _ = resp.Body.Close() })

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected HTTP 200 for empty push without epoch, got %d", resp.StatusCode)
	}
	var out SyncPushResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if out.RepositoryGeneration != 5 {
		t.Fatalf("expected repository_generation 5, got %d", out.RepositoryGeneration)
	}
	if out.SuccessCount != 0 {
		t.Fatalf("expected success_count 0, got %d", out.SuccessCount)
	}
}

func TestPush_repositoryGenerationMismatch_returns409(t *testing.T) {
	h, mockSync, _ := createTestHandlerWithSync()
	mockSync.SetRepositoryGeneration(5)

	reqBody := SyncPushRequest{
		TransmissionID: "tx-1",
		ClientID:       "test-client",
		Records: []sync.Observation{
			{
				ObservationID: "obs-1",
				FormType:      "survey",
				FormVersion:   "1.0",
				Data:          json.RawMessage(`{}`),
				CreatedAt:     "2025-06-25T12:00:00Z",
				UpdatedAt:     "2025-06-25T12:00:00Z",
				Deleted:       false,
			},
		},
		RepositoryGeneration: int64Ptr(4),
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/sync/push", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Push(w, req)

	resp := w.Result()
	t.Cleanup(func() { _ = resp.Body.Close() })

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected HTTP 409 Conflict, got %d", resp.StatusCode)
	}
	var er ErrorResponse
	if err := json.NewDecoder(resp.Body).Decode(&er); err != nil {
		t.Fatalf("decode error body: %v", err)
	}
	if er.Code != CodeRepositoryResetRequired {
		t.Fatalf("expected code %q, got %q", CodeRepositoryResetRequired, er.Code)
	}
	if resp.Header.Get(sync.HeaderRepositoryGeneration) != strconv.FormatInt(5, 10) {
		t.Fatalf("expected x-repository-generation 5 on response")
	}
}

func int64Ptr(v int64) *int64 {
	return &v
}

// TestPull_missingRepositoryGeneration_adoptsServer verifies the fresh-install
// contract: when a client omits both the header AND the request body epoch,
// the server must NOT treat the request as "client sent 1" (which would 409 a
// fresh install against any previously-reset server). Instead it adopts the
// current server generation silently.
func TestPull_missingRepositoryGeneration_adoptsServer(t *testing.T) {
	h, mockSync, _ := createTestHandlerWithSync()
	mockSync.SetRepositoryGeneration(5)

	body, err := json.Marshal(SyncPullRequest{
		ClientID: "fresh-install",
		Since: &SyncPullRequestSince{
			Version: 0,
		},
		// Intentionally: no RepositoryGeneration, no header.
	})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/sync/pull", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Pull(w, req)

	resp := w.Result()
	t.Cleanup(func() { _ = resp.Body.Close() })

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected HTTP 200 for fresh install without epoch, got %d", resp.StatusCode)
	}
}

// TestAttachmentManifest_missingRepositoryGeneration_adoptsServer is the
// attachment-manifest counterpart of the fresh-install contract.
func TestAttachmentManifest_missingRepositoryGeneration_adoptsServer(t *testing.T) {
	h, mockSync, _ := createTestHandlerWithSync()
	mockSync.SetRepositoryGeneration(5)

	body := []byte(`{"client_id":"fresh-install","since_version":0}`)

	req := httptest.NewRequest(http.MethodPost, "/api/attachments/manifest", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.AttachmentManifestHandler(w, req)

	resp := w.Result()
	t.Cleanup(func() { _ = resp.Body.Close() })

	if resp.StatusCode == http.StatusConflict {
		t.Fatalf("expected non-409 for fresh install without epoch, got 409")
	}
}
