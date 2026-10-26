package client

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/OpenDataEnsemble/ode/synkronus-cli/pkg/client/generated"
)

func TestListUsersParsesSuccessfulJSONResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET request, got %s", r.Method)
		}
		if r.URL.Path != "/api/users" {
			t.Errorf("expected /api/users path, got %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		if _, err := w.Write([]byte(`[
			{
				"username": "admin",
				"role": "admin",
				"created_at": "2026-10-24T12:00:00Z",
				"updated_at": "2026-10-24T12:00:00Z"
			}
		]`)); err != nil {
			t.Errorf("failed to write response: %v", err)
		}
	}))
	defer server.Close()

	api, err := generated.NewClientWithResponses(server.URL)
	if err != nil {
		t.Fatalf("failed to create generated client: %v", err)
	}

	c := &Client{
		BaseURL:    server.URL,
		APIVersion: "1.0",
		api:        api,
	}

	users, err := c.ListUsers()
	if err != nil {
		t.Fatalf("ListUsers returned an error: %v", err)
	}

	if len(users) != 1 {
		t.Fatalf("expected 1 user, got %d", len(users))
	}

	if users[0].Username != "admin" {
		t.Errorf("expected username admin, got %s", users[0].Username)
	}

	if users[0].Role != generated.UserListItemRole("admin") {
		t.Errorf("expected role admin, got %s", users[0].Role)
	}
}
