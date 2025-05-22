package handlers

import (
	"encoding/json"
	"net/http"
)

// GetVersion returns version and system information
func (h *Handler) GetVersion(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get version info from the version service
	info, err := h.versionService.GetVersion(ctx)
	if err != nil {
		h.log.Error("Failed to get version info", "error", err)
		http.Error(w, "Failed to get version info", http.StatusInternalServerError)
		return
	}

	// Set response headers
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	// Encode and send response
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(info); err != nil {
		h.log.Error("Failed to encode version info", "error", err)
		http.Error(w, "Failed to encode version info", http.StatusInternalServerError)
		return
	}
}
