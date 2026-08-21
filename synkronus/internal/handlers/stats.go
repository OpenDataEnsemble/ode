package handlers

import (
	"encoding/json"
	"net/http"
)

// GetObservationStats returns aggregated observation counts for dashboard charts.
// GET /api/stats/observations
func (h *Handler) GetObservationStats(w http.ResponseWriter, r *http.Request) {
	if h.statsService == nil {
		http.Error(w, "Stats service unavailable", http.StatusInternalServerError)
		return
	}

	stats, err := h.statsService.GetObservationStats(r.Context())
	if err != nil {
		h.log.Error("Failed to get observation stats", "error", err)
		http.Error(w, "Failed to get observation stats", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(stats); err != nil {
		h.log.Error("Failed to encode observation stats", "error", err)
	}
}
