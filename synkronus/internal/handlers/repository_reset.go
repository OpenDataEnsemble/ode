package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/middleware/auth"
	"github.com/opendataensemble/synkronus/pkg/sync"
)

const confirmResetRepository = "RESET_REPOSITORY"

// RepositoryResetRequest is the JSON body for POST /api/admin/repository/reset.
type RepositoryResetRequest struct {
	Confirm string `json:"confirm"`
}

// RepositoryResetResponse is returned after a successful hard reset.
type RepositoryResetResponse struct {
	RepositoryGeneration int64  `json:"repository_generation"`
	Message              string `json:"message"`
}

// PostRepositoryReset handles POST /api/admin/repository/reset (admin only).
func (h *Handler) PostRepositoryReset(w http.ResponseWriter, r *http.Request) {
	var req RepositoryResetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendErrorResponse(w, http.StatusBadRequest, err, "Invalid request format")
		return
	}
	if req.Confirm != confirmResetRepository {
		SendErrorResponse(w, http.StatusBadRequest, nil, `confirm must be exactly "RESET_REPOSITORY"`)
		return
	}
	u := auth.GetUserFromContext(r.Context())
	if u == nil || u.Username == "" {
		SendErrorResponse(w, http.StatusUnauthorized, nil, "Unauthorized")
		return
	}

	newGen, err := h.syncService.HardResetRepository(r.Context(), u.Username)
	if err != nil {
		h.log.Error("Hard repository reset failed", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to reset repository")
		return
	}

	if err := attachment.WipeStorageDirectories(h.config); err != nil {
		h.log.Error("Failed to wipe attachment files after reset", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Repository was reset but attachment files could not be cleared; check server logs")
		return
	}

	w.Header().Set(sync.HeaderRepositoryGeneration, strconv.FormatInt(newGen, 10))
	SendJSONResponse(w, http.StatusOK, RepositoryResetResponse{
		RepositoryGeneration: newGen,
		Message:              "Repository data reset; repository_generation incremented and attachment storage cleared.",
	})
}
