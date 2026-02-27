package formulusversion

import (
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
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUpgradeRequired {
			t.Errorf("expected 426 when no header, got %d", rec.Code)
		}
		if body := rec.Body.String(); body != "" && !strings.Contains(body, "Missing x-formulus-version header") {
			t.Errorf("expected body with version error message, got %q", body)
		}
		// Check that server version is advertised in header
		if rec.Header().Get("X-Synkronus-Version") == "" {
			t.Error("expected X-Synkronus-Version header to be set")
		}
	})

	t.Run("unparseable_client_version_returns_426", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		req.Header.Set("X-Formulus-Version", "not-a-version")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUpgradeRequired {
			t.Errorf("expected 426 for unparseable client version, got %d", rec.Code)
		}
		if body := rec.Body.String(); !strings.Contains(body, "valid semantic version") {
			t.Errorf("expected body with version error message, got %q", body)
		}
	})

	t.Run("unparseable_server_version_returns_426", func(t *testing.T) {
		// Server BuildVersion() in test is "dev" (unparseable) → middleware returns 426
		req := httptest.NewRequest(http.MethodPost, "/auth/login", nil)
		req.Header.Set("X-Formulus-Version", "1.0.0")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUpgradeRequired {
			t.Errorf("expected 426 when server version unparseable (dev), got %d body %s", rec.Code, rec.Body.String())
		}
		if body := rec.Body.String(); !strings.Contains(body, "Server version is not configured") {
			t.Errorf("expected body with server version error message, got %q", body)
		}
	})
}
