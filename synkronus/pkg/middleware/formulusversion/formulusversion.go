package formulusversion

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/opendataensemble/synkronus/pkg/version"
)

const headerFormulusVersion = "X-Formulus-Version"

// VersionMismatchResponse is the JSON body returned when version check fails (mismatch or invalid/missing version).
// Uses HTTP 426 Upgrade Required status code - the standard HTTP status for version incompatibility.
type VersionMismatchResponse struct {
	Message          string `json:"message"`
	SynkronusVersion string `json:"synkronus_version"`
}

// Middleware returns a middleware that requires X-Formulus-Version and checks major version match.
// No fallbacks: missing header, unparseable client version, or unparseable server version all result in 426.
func Middleware(log *logger.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			serverVer := version.BuildVersion()
			clientVer := strings.TrimSpace(r.Header.Get(headerFormulusVersion))
			if clientVer == "" {
				log.Warn("Missing x-formulus-version header")
				writeVersionError(w, "Missing x-formulus-version header. Client must send a valid semantic version.", serverVer)
				return
			}
			clientMajor, ok := parseMajor(clientVer)
			if !ok {
				log.Warn("Formulus version header unparseable", "x-formulus-version", clientVer)
				writeVersionError(w, "x-formulus-version must be a valid semantic version (e.g. 1.0.0).", serverVer)
				return
			}
			serverMajor, ok := parseMajor(serverVer)
			if !ok {
				log.Error("Server version is not set or unparseable; build must inject version via ldflags", "server_version", serverVer)
				writeVersionError(w, "Server version is not configured. Cannot validate client version.", serverVer)
				return
			}
			if clientMajor != serverMajor {
				log.Warn("Formulus-Synkronus version mismatch",
					"formulus_version", clientVer,
					"synkronus_version", serverVer,
					"client_major", clientMajor,
					"server_major", serverMajor)
				writeVersionError(w, fmt.Sprintf("Formulus v%s is not compatible with this server (v%s). Please update the app.", clientVer, serverVer), serverVer)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func writeVersionError(w http.ResponseWriter, message, serverVer string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Synkronus-Version", serverVer) // Always advertise server version in header
	w.WriteHeader(http.StatusUpgradeRequired)        // 426 - standard HTTP status for version incompatibility
	_ = json.NewEncoder(w).Encode(VersionMismatchResponse{
		Message:          message,
		SynkronusVersion: serverVer,
	})
}

// parseMajor returns the major version number and true if the version string looks like [v]MAJOR.MINOR.PATCH or [v]MAJOR (e.g. v1.0.0-alpha.20, 1.7.2).
func parseMajor(v string) (int, bool) {
	v = strings.TrimSpace(v)
	if v == "" {
		return 0, false
	}
	// Strip leading "v" or "V" so git-style tags (v1.0.0-alpha.20-23-g8b4fcad-dirty) parse.
	if len(v) > 1 && (v[0] == 'v' || v[0] == 'V') {
		v = v[1:]
	}
	parts := strings.SplitN(v, ".", 2)
	segment := strings.TrimSpace(parts[0])
	n, err := strconv.Atoi(segment)
	if err != nil {
		return 0, false
	}
	if n < 0 {
		return 0, false
	}
	return n, true
}
