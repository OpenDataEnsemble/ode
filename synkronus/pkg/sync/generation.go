package sync

import (
	"net/http"
	"strconv"
	"strings"
)

const (
	// HeaderRepositoryGeneration is the HTTP header for the repository epoch (synkronus ↔ clients).
	HeaderRepositoryGeneration = "X-Repository-Generation"
	// DefaultRepositoryGeneration is the effective generation when the client omits header/body (backwards compatibility).
	DefaultRepositoryGeneration int64 = 1
)

// ParseClientRepositoryGeneration reads the epoch from the request header, then optional JSON body field.
// Omitted or invalid values are treated as 1.
func ParseClientRepositoryGeneration(r *http.Request, body *int64) int64 {
	if h := strings.TrimSpace(r.Header.Get(HeaderRepositoryGeneration)); h != "" {
		if v, err := strconv.ParseInt(h, 10, 64); err == nil && v >= 1 {
			return v
		}
		return DefaultRepositoryGeneration
	}
	if body != nil && *body >= 1 {
		return *body
	}
	return DefaultRepositoryGeneration
}
