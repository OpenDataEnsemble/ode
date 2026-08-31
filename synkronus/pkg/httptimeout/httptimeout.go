package httptimeout

import (
	"net/http"
	"time"
)

const (
	// ReadHeaderTimeout is the Slowloris bound: time to finish sending
	// request headers. Bodies (sync JSON, attachments, bundle zip) are
	// not covered by this.
	ReadHeaderTimeout = 25 * time.Second

	// AuthHandlerTimeout bounds login and refresh only. Those payloads
	// are tiny; 25s is headroom for high-latency radio, not for bcrypt.
	AuthHandlerTimeout = 25 * time.Second

	// IdleTimeout is keep-alive idle between requests.
	IdleTimeout = 60 * time.Second

	TimeoutMessage = "request timeout\n"
)

// Auth wraps login/refresh so a stuck credential POST cannot pin a
// goroutine. Do not use this on sync, attachments, or bundle download.
func Auth(next http.Handler) http.Handler {
	return Handler(AuthHandlerTimeout, next)
}

// Handler is TimeoutHandler with a caller-chosen deadline (tests).
func Handler(d time.Duration, next http.Handler) http.Handler {
	return http.TimeoutHandler(next, d, TimeoutMessage)
}
