package presencemw

import (
	"net/http"
	"strings"
	"time"

	"github.com/opendataensemble/synkronus/pkg/middleware/auth"
	"github.com/opendataensemble/synkronus/pkg/presence"
)

const (
	headerODEClientID = "x-ode-client-id"
	headerODEVersion  = "x-ode-version"
)

// Middleware records throttled presence for authenticated requests (after AuthMiddleware).
func Middleware(rec *presence.Recorder) func(http.Handler) http.Handler {
	if rec == nil {
		return func(next http.Handler) http.Handler { return next }
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			u := auth.GetUserFromContext(r.Context())
			if u == nil || u.Username == "" {
				next.ServeHTTP(w, r)
				return
			}
			clientID := strings.TrimSpace(r.Header.Get(headerODEClientID))
			odeVer := strings.TrimSpace(r.Header.Get(headerODEVersion))
			var odePtr *string
			if odeVer != "" {
				odePtr = &odeVer
			}
			rec.Enqueue(presence.Event{
				Username:       u.Username,
				ClientID:       clientID,
				LastSeen:       time.Now().UTC(),
				LastOdeVersion: odePtr,
				SkipThrottle:   false,
			})
			next.ServeHTTP(w, r)
		})
	}
}
