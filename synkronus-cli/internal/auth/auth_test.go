package auth

import (
	"errors"
	"net/http"
	"testing"
	"time"
)

func TestRateLimitError(t *testing.T) {
	response := &http.Response{StatusCode: http.StatusTooManyRequests, Header: make(http.Header)}
	response.Header.Set("Retry-After", "12")
	err := rateLimitError(response)
	var limited *RateLimitError
	if !errors.As(err, &limited) {
		t.Fatalf("expected RateLimitError, got %v", err)
	}
	if limited.RetryAfter != 12*time.Second {
		t.Fatalf("retry after = %s", limited.RetryAfter)
	}
}

func TestRateLimitErrorIgnoresOtherStatuses(t *testing.T) {
	if err := rateLimitError(&http.Response{StatusCode: http.StatusUnauthorized}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
