package sync

import (
	"errors"
	"net/http"
	"strconv"
)

// HeaderRepositoryGeneration is the HTTP header for the repository epoch (synkronus ↔ clients).
const HeaderRepositoryGeneration = "X-Repository-Generation"

// ErrRepositoryGenerationMismatch means the client's repository_generation does not match the server.
var ErrRepositoryGenerationMismatch = errors.New("repository generation mismatch")

// ParseClientRepositoryGeneration reads the epoch from the request header, then optional JSON body field.
// Omitted or invalid values are treated as 1.
func ParseClientRepositoryGeneration(r *http.Request, body *int64) int64 {
	if h := r.Header.Get(HeaderRepositoryGeneration); h != "" {
		if v, err := strconv.ParseInt(h, 10, 64); err == nil && v > 0 {
			return v
		}
	}
	if body != nil && *body > 0 {
		return *body
	}
	return 1
}
