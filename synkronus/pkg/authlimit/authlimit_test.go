package authlimit

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testGuard(t *testing.T) *Guard {
	t.Helper()
	guard, err := New(Config{
		MaxBodyBytes:      128,
		MaxUsernameBytes:  32,
		MaxPasswordBytes:  64,
		MaxTokenBytes:     64,
		IPAttempts:        10,
		IPWindow:          time.Minute,
		LoginAttempts:     2,
		LoginWindow:       time.Minute,
		AccountAttempts:   5,
		AccountWindow:     time.Minute,
		MaxKeys:           100,
		TrustedProxyCIDRs: []string{"10.0.0.0/8"},
	})
	if err != nil {
		t.Fatal(err)
	}
	return guard
}

func TestLoginFailuresAreRateLimited(t *testing.T) {
	guard := testGuard(t)
	handler := CapturePeer(guard.Middleware(EndpointLogin)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})))

	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"user","password":"bad"}`))
		req.RemoteAddr = "192.0.2.1:1234"
		resp := httptest.NewRecorder()
		handler.ServeHTTP(resp, req)
		if resp.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: got %d", i, resp.Code)
		}
	}

	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(`{"username":"user","password":"bad"}`))
	req.RemoteAddr = "192.0.2.1:1234"
	resp := httptest.NewRecorder()
	handler.ServeHTTP(resp, req)
	if resp.Code != http.StatusTooManyRequests {
		t.Fatalf("got %d, want 429", resp.Code)
	}
	if resp.Header().Get("Retry-After") == "" {
		t.Fatal("missing Retry-After")
	}
}

func TestUntrustedForwardedIPIsIgnored(t *testing.T) {
	guard := testGuard(t)
	seen := ""
	handler := CapturePeer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		seen = guard.clientIP(r)
	}))
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.RemoteAddr = "192.0.2.10:1234"
	req.Header.Set("X-Real-IP", "203.0.113.4")
	handler.ServeHTTP(httptest.NewRecorder(), req)
	if seen != "192.0.2.10" {
		t.Fatalf("got %q", seen)
	}
}

func TestTrustedProxyUsesValidatedRealIP(t *testing.T) {
	guard := testGuard(t)
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.RemoteAddr = "10.0.0.2:1234"
	req.Header.Set("X-Real-IP", "203.0.113.4")
	CapturePeer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		if got := guard.clientIP(r); got != "203.0.113.4" {
			t.Fatalf("got %q", got)
		}
	})).ServeHTTP(httptest.NewRecorder(), req)
}

func TestOversizedAuthBodyIsRejected(t *testing.T) {
	guard := testGuard(t)
	handler := CapturePeer(guard.Middleware(EndpointLogin)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(strings.Repeat("x", 129)))
	resp := httptest.NewRecorder()
	handler.ServeHTTP(resp, req)
	if resp.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("got %d", resp.Code)
	}
}

func TestLimiterBoundsKeyCount(t *testing.T) {
	limiter := newWindowLimiter(1, time.Minute, 2)
	if ok, _ := limiter.take("one"); !ok {
		t.Fatal("first key rejected")
	}
	if ok, _ := limiter.take("two"); !ok {
		t.Fatal("second key rejected")
	}
	if ok, _ := limiter.take("three"); ok {
		t.Fatal("expected new key to be rejected at capacity")
	}
}
