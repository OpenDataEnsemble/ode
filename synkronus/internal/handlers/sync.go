package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/opendataensemble/synkronus/pkg/middleware/auth"
	"github.com/opendataensemble/synkronus/pkg/presence"
	"github.com/opendataensemble/synkronus/pkg/sync"
)

// SyncPullRequest represents the sync pull request payload according to OpenAPI spec
type SyncPullRequest struct {
	ClientID             string                `json:"client_id"`
	Since                *SyncPullRequestSince `json:"since,omitempty"`
	SchemaTypes          []string              `json:"schema_types,omitempty"`
	RepositoryGeneration *int64                `json:"repository_generation,omitempty"`
}

// SyncPullRequestSince represents the pagination cursor in sync pull request
type SyncPullRequestSince struct {
	Version int64  `json:"version"`
	ID      string `json:"id"`
}

// SyncPullResponse represents the sync pull response payload according to OpenAPI spec
type SyncPullResponse struct {
	CurrentVersion       int64              `json:"current_version"`
	RepositoryGeneration int64              `json:"repository_generation"`
	Records              []sync.Observation `json:"records"`
	ChangeCutoff         int64              `json:"change_cutoff"`
	HasMore              *bool              `json:"has_more,omitempty"`
	SyncFormatVersion    *string            `json:"sync_format_version,omitempty"`
}

// Pull handles the /sync/pull endpoint
func (h *Handler) Pull(w http.ResponseWriter, r *http.Request) {
	var req SyncPullRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendErrorResponse(w, http.StatusBadRequest, err, "Invalid request format")
		return
	}

	// Validate required fields
	if req.ClientID == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "client_id is required")
		return
	}

	// Parse query parameters
	limitStr := r.URL.Query().Get("limit")
	limit := 100 // default limit
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	schemaType := r.URL.Query().Get("schemaType")
	// Determine schema types to filter by
	var schemaTypes []string
	if schemaType != "" {
		schemaTypes = append(schemaTypes, schemaType)
	}
	if len(req.SchemaTypes) > 0 {
		schemaTypes = append(schemaTypes, req.SchemaTypes...)
	}

	// Determine starting version and cursor
	var sinceVersion int64 = 0
	var cursor *sync.SyncPullCursor

	if req.Since != nil {
		sinceVersion = req.Since.Version
		cursor = &sync.SyncPullCursor{
			Version: req.Since.Version,
			ID:      req.Since.ID,
		}
	}

	// Call the sync service to get records
	result, err := h.syncService.GetRecordsSinceVersion(r.Context(), sinceVersion, req.ClientID, schemaTypes, limit, cursor)
	if err != nil {
		h.log.Error("Failed to get records since version", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to retrieve sync data")
		return
	}

	// Build response
	syncFormatVersion := "1.0"
	response := SyncPullResponse{
		CurrentVersion:       result.CurrentVersion,
		RepositoryGeneration: result.RepositoryGeneration,
		Records:              result.Records,
		ChangeCutoff:         result.ChangeCutoff,
		HasMore:              &result.HasMore,
		SyncFormatVersion:    &syncFormatVersion,
	}

	// Note: Clients should use change_cutoff as the next since.version for pagination

	h.log.Info("Sync pull request processed",
		"clientId", req.ClientID,
		"sinceVersion", sinceVersion,
		"currentVersion", result.CurrentVersion,
		"recordCount", len(result.Records),
		"hasMore", result.HasMore)

	h.recordPresenceAfterSyncPull(r, req.ClientID, sinceVersion)

	w.Header().Set(sync.HeaderRepositoryGeneration, strconv.FormatInt(result.RepositoryGeneration, 10))
	SendJSONResponse(w, http.StatusOK, response)
}

// SyncPushRequest represents the sync push request payload according to OpenAPI spec
type SyncPushRequest struct {
	TransmissionID       string             `json:"transmission_id"`
	ClientID             string             `json:"client_id"`
	Records              []sync.Observation `json:"records"`
	RepositoryGeneration *int64             `json:"repository_generation,omitempty"`
}

// SyncPushResponse represents the sync push response payload according to OpenAPI spec
type SyncPushResponse struct {
	CurrentVersion       int64                    `json:"current_version"`
	RepositoryGeneration int64                    `json:"repository_generation"`
	SuccessCount         int                      `json:"success_count"`
	FailedRecords        []map[string]interface{} `json:"failed_records,omitempty"`
	Warnings             []sync.SyncWarning       `json:"warnings,omitempty"`
}

// Push handles the /sync/push endpoint
func (h *Handler) Push(w http.ResponseWriter, r *http.Request) {
	var req SyncPushRequest

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.log.Error("Failed to decode sync push request", "error", err)
		SendErrorResponse(w, http.StatusBadRequest, err, "Invalid request format")
		return
	}

	// Validate required fields
	if req.TransmissionID == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "transmission_id is required")
		return
	}
	if req.ClientID == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "client_id is required")
		return
	}
	if req.Records == nil {
		SendErrorResponse(w, http.StatusBadRequest, nil, "records array is required")
		return
	}

	clientGen := sync.ParseClientRepositoryGeneration(r, req.RepositoryGeneration)
	result, err := h.syncService.ProcessPushedRecords(r.Context(), req.Records, req.ClientID, req.TransmissionID, clientGen)
	if err != nil {
		if errors.Is(err, sync.ErrRepositoryGenerationMismatch) {
			serverGen, gerr := h.syncService.GetRepositoryGeneration(r.Context())
			if gerr != nil {
				h.log.Error("Failed to read repository generation", "error", gerr)
				SendErrorResponse(w, http.StatusInternalServerError, gerr, "Failed to verify repository generation")
				return
			}
			w.Header().Set(sync.HeaderRepositoryGeneration, strconv.FormatInt(serverGen, 10))
			SendErrorResponseWithCode(w, http.StatusConflict, err,
				"Client repository_generation does not match the server; the repository was reset or upgraded. Pull sync state and align generation before pushing.",
				CodeRepositoryResetRequired)
			return
		}
		h.log.Error("Failed to process pushed records", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to process sync data")
		return
	}

	// Build response from service result
	response := SyncPushResponse{
		CurrentVersion:       result.CurrentVersion,
		RepositoryGeneration: result.RepositoryGeneration,
		SuccessCount:         result.SuccessCount,
		FailedRecords:        result.FailedRecords,
		Warnings:             result.Warnings,
	}

	h.log.Info("Sync push request processed",
		"transmissionId", req.TransmissionID,
		"clientId", req.ClientID,
		"recordCount", len(req.Records),
		"successCount", result.SuccessCount,
		"failedCount", len(result.FailedRecords),
		"warningCount", len(result.Warnings),
		"currentVersion", result.CurrentVersion)

	h.recordPresenceAfterSyncPush(r, req.ClientID, result.CurrentVersion)

	w.Header().Set(sync.HeaderRepositoryGeneration, strconv.FormatInt(result.RepositoryGeneration, 10))
	SendJSONResponse(w, http.StatusOK, response)
}

func (h *Handler) recordPresenceAfterSyncPull(r *http.Request, clientID string, sinceVersion int64) {
	rec := h.PresenceRecorder()
	if rec == nil {
		return
	}
	u := auth.GetUserFromContext(r.Context())
	if u == nil || u.Username == "" {
		return
	}
	sv := sinceVersion
	ode := odeVersionFromRequest(r)
	ev := presence.Event{
		Username:        u.Username,
		ClientID:        clientID,
		LastSeen:        time.Now().UTC(),
		LastDataVersion: &sv,
		SkipThrottle:    true,
	}
	if ode != nil {
		ev.LastOdeVersion = ode
	}
	rec.Enqueue(ev)
}

func (h *Handler) recordPresenceAfterSyncPush(r *http.Request, clientID string, currentVersion int64) {
	rec := h.PresenceRecorder()
	if rec == nil {
		return
	}
	u := auth.GetUserFromContext(r.Context())
	if u == nil || u.Username == "" {
		return
	}
	cv := currentVersion
	ode := odeVersionFromRequest(r)
	ev := presence.Event{
		Username:        u.Username,
		ClientID:        clientID,
		LastSeen:        time.Now().UTC(),
		LastDataVersion: &cv,
		SkipThrottle:    true,
	}
	if ode != nil {
		ev.LastOdeVersion = ode
	}
	rec.Enqueue(ev)
}
