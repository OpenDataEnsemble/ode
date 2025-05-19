package handlers

import (
	"net/http"
)

// VersionInfo represents API version information
type VersionInfo struct {
	Version     string `json:"version"`
	ReleaseDate string `json:"releaseDate"`
	Deprecated  bool   `json:"deprecated"`
}

// APIVersionsResponse represents the API versions response
type APIVersionsResponse struct {
	Versions []VersionInfo `json:"versions"`
	Current  string        `json:"current"`
}

// GetAPIVersions handles the /api/versions endpoint
func (h *Handler) GetAPIVersions(w http.ResponseWriter, r *http.Request) {
	h.log.Info("API versions requested")

	// For now we will just hardcode the version information here
	versions := []VersionInfo{
		{
			Version:     "1.0.0",
			ReleaseDate: "2025-01-01",
			Deprecated:  false,
		},
	}

	response := APIVersionsResponse{
		Versions: versions,
		Current:  "1.0.0",
	}

	SendJSONResponse(w, http.StatusOK, response)
}
