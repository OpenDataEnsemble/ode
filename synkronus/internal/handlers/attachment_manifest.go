package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/sync"
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

	clientGen := sync.ParseClientRepositoryGeneration(r, req.RepositoryGeneration)
	serverGen, err := h.syncService.GetRepositoryGeneration(r.Context())
	if err != nil {
		h.log.Error("Failed to read repository generation", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to verify repository generation")
		return
	}
	if clientGen != serverGen {
		w.Header().Set(sync.HeaderRepositoryGeneration, strconv.FormatInt(serverGen, 10))
		SendErrorResponseWithCode(w, http.StatusConflict, sync.ErrRepositoryGenerationMismatch,
			"Client repository_generation does not match the server; pull sync state and align generation before requesting the attachment manifest.",
			CodeRepositoryResetRequired)
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
