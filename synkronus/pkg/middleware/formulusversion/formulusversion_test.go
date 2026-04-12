package formulusversion

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/opendataensemble/synkronus/pkg/logger"
)

func TestParseMajor(t *testing.T) {
	tests := []struct {
		input     string
		wantMajor int
		wantOK    bool
	}{
		{"1.0.0", 1, true},
		{"v1.0.0", 1, true},
		{"V2.0.0", 2, true},
		{"v1.0.0-alpha.20-23-g8b4fcad-dirty", 1, true},
		{"0.0.1", 0, true},
		{"2.5.10", 2, true},
		{"1", 1, true},
		{" 1.2.3 ", 1, true},
		{"", 0, false},
		{"abc", 0, false},
		{"1.2.3-beta", 1, true},
	}
	for _, tt := range tests {
		got, ok := parseMajor(tt.input)
		if ok != tt.wantOK || got != tt.wantMajor {
			t.Errorf("parseMajor(%q) = (%d, %v), want (%d, %v)", tt.input, got, ok, tt.wantMajor, tt.wantOK)
		}
	}
}

func TestMiddleware(t *testing.T) {
	log := logger.NewLogger(logger.WithLevel(logger.LevelDebug))
	mw := Middleware(log)
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	handler := mw(next)

	t.Run("no_header_returns_426", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUpgradeRequired {
			t.Errorf("expected 426 when no header, got %d", rec.Code)
		}
		if body := rec.Body.String(); body != "" && !strings.Contains(body, "missing x-ode-version header") {
			t.Errorf("expected body with version error message, got %q", body)
		}
		// Check that server version is advertised in header
		headerVersion := rec.Header().Get("x-synkronus-version")
		if headerVersion == "" {
			t.Error("expected x-synkronus-version header to be set")
		}

		var payload VersionMismatchResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatalf("expected JSON version mismatch payload: %v", err)
		}
		if payload.SynkronusVersion == "" {
			t.Error("expected synkronus_version in payload")
		}
		if headerVersion != "" && payload.SynkronusVersion != headerVersion {
			t.Errorf("expected payload synkronus_version (%q) to match header (%q)", payload.SynkronusVersion, headerVersion)
		}
	})

	t.Run("unparseable_client_version_returns_426", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
		req.Header.Set("x-ode-version", "not-a-version")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUpgradeRequired {
			t.Errorf("expected 426 for unparseable client version, got %d", rec.Code)
		}
		if body := rec.Body.String(); !strings.Contains(body, "valid semantic version") {
			t.Errorf("expected body with version error message, got %q", body)
		}
	})

	t.Run("matching_major_versions_pass", func(t *testing.T) {
		// Server BuildVersion() default is "1.0.0" and client sends "1.0.0" → major versions match (1 == 1)
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
		req.Header.Set("x-ode-version", "1.0.0")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("expected 200 when versions match, got %d body %s", rec.Code, rec.Body.String())
		}
		if rec.Body.String() != "ok" {
			t.Errorf("expected body 'ok', got %q", rec.Body.String())
		}
	})

	t.Run("mismatched_major_versions_return_426", func(t *testing.T) {
		// Client sends "2.0.0" but server is "1.0.0" → major versions mismatch (2 != 1)
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
		req.Header.Set("x-ode-version", "2.0.0")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUpgradeRequired {
			t.Errorf("expected 426 when major versions mismatch, got %d body %s", rec.Code, rec.Body.String())
		}
		if body := rec.Body.String(); !strings.Contains(body, "not compatible") {
			t.Errorf("expected body with version mismatch message, got %q", body)
		}
	})

	t.Run("x_formulus_version_alone_returns_426", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
		req.Header.Set("x-formulus-version", "1.0.0")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUpgradeRequired {
			t.Errorf("expected 426 when only x-formulus-version is sent, got %d", rec.Code)
		}
	})
}
