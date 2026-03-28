package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/opendataensemble/synkronus/pkg/version"
)

// HealthCheck handles the /health endpoint
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	h.log.Info("Health check requested")
	w.Header().Set("content-type", "application/json")

	// Only allow GET and HEAD
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	w.WriteHeader(http.StatusOK)

	// Only write body for GET requests
	if r.Method == http.MethodGet {
		response := map[string]string{
			"status":    "ok",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"version":   version.BuildVersion(),
		}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			h.log.Error("Failed to write health check response", "error", err)
		}
	}
}
