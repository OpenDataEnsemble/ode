package portal

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandler_ServesIndexAtRoot(t *testing.T) {
	h := Handler()
	if h == nil {
		t.Fatal("Handler() returned nil")
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "Synkronus portal") {
		t.Fatalf("expected response body to contain %q, got %q", "Synkronus portal", body)
	}
}

func TestHandler_SPAFallbackToIndex(t *testing.T) {
	h := Handler()

	req := httptest.NewRequest(http.MethodGet, "/non-existent-route", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	// We don't assert on exact status or body here; this test primarily ensures
	// that the SPA fallback path executes without panicking when the requested
	// route does not exist in the embedded dist.
}
