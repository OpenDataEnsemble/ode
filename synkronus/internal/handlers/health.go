package handlers

import (
	"net/http"
)

// HealthCheck handles the /health endpoint
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	h.log.Info("Health check requested")
	w.Header().Set("content-type", "text/plain")

	// Only allow GET and HEAD
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	w.WriteHeader(http.StatusOK)

	// Only write body for GET requests
	if r.Method == http.MethodGet {
		if _, err := w.Write([]byte("OK")); err != nil {
			h.log.Error("Failed to write health check response", "error", err)
		}
	}
}
