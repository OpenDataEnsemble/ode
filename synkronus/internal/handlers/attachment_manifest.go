package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/opendataensemble/synkronus/pkg/attachment"
)

// AttachmentManifestHandler handles POST /attachments/manifest
func (h *Handler) AttachmentManifestHandler(w http.ResponseWriter, r *http.Request) {
	var req attachment.AttachmentManifestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendErrorResponse(w, http.StatusBadRequest, err, "Invalid request body")
		return
	}

	// Validate required fields
	if req.ClientID == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "client_id is required")
		return
	}

	if req.SinceVersion < 0 {
		SendErrorResponse(w, http.StatusBadRequest, nil, "since_version must be non-negative")
		return
	}

	// Get the manifest from the service
	manifest, err := h.attachmentManifestService.GetManifest(r.Context(), req)
	if err != nil {
		h.log.Error("Failed to get attachment manifest", "error", err, "clientId", req.ClientID, "sinceVersion", req.SinceVersion)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to generate attachment manifest")
		return
	}

	// Log the successful request
	h.log.Info("Attachment manifest request processed",
		"clientId", req.ClientID,
		"sinceVersion", req.SinceVersion,
		"currentVersion", manifest.CurrentVersion,
		"operationCount", len(manifest.Operations),
		"downloadCount", manifest.OperationCount.Download,
		"deleteCount", manifest.OperationCount.Delete,
		"totalDownloadSize", manifest.TotalDownloadSize)

	// Send the response
	SendJSONResponse(w, http.StatusOK, manifest)
}
