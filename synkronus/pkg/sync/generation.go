package sync

import (
	"net/http"
	"strconv"
	"strings"
)

const (
	// HeaderRepositoryGeneration is the HTTP header for the repository epoch (synkronus ↔ clients).
	HeaderRepositoryGeneration = "x-repository-generation"
	// DefaultRepositoryGeneration is the effective generation when the client omits header/body (backwards compatibility).
	DefaultRepositoryGeneration int64 = 1
)

// ParseClientRepositoryGeneration reads the epoch from the request header, then optional JSON body field.
// Omitted or invalid values are treated as 1.
func ParseClientRepositoryGeneration(r *http.Request, body *int64) int64 {
	gen, _ := ParseClientRepositoryGenerationSent(r, body)
	return gen
}

// ParseClientRepositoryGenerationSent is like ParseClientRepositoryGeneration but additionally
// reports whether the client actually sent a generation at all (header OR body). Handlers can use
// this to distinguish "fresh install, no generation seen yet" (sent=false) from "client has an
// explicit generation" (sent=true). Invalid values are treated as unsent so malformed headers
// never promote to `1` silently.
func ParseClientRepositoryGenerationSent(r *http.Request, body *int64) (int64, bool) {
	if h := strings.TrimSpace(r.Header.Get(HeaderRepositoryGeneration)); h != "" {
		if v, err := strconv.ParseInt(h, 10, 64); err == nil && v >= 1 {
			return v, true
		}
		return DefaultRepositoryGeneration, false
	}
	if body != nil && *body >= 1 {
		return *body, true
	}
	return DefaultRepositoryGeneration, false
}
