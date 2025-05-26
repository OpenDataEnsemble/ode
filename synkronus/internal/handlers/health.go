package handlers

import (
	"net/http"
)

// HealthCheck handles the /health endpoint
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	h.log.Info("Health check requested")
	w.Header().Set("content-type", "text/plain")
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write([]byte("OK")); err != nil {
		h.log.Error("Failed to write health check response", "error", err)
	}
}
