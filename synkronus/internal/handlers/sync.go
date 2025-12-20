package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/opendataensemble/synkronus/pkg/sync"
)

// SyncPullRequest represents the sync pull request payload according to OpenAPI spec
type SyncPullRequest struct {
	ClientID    string                `json:"client_id"`
	Since       *SyncPullRequestSince `json:"since,omitempty"`
	SchemaTypes []string              `json:"schema_types,omitempty"`
}

// SyncPullRequestSince represents the pagination cursor in sync pull request
type SyncPullRequestSince struct {
	Version int64  `json:"version"`
	ID      string `json:"id"`
}

// SyncPullResponse represents the sync pull response payload according to OpenAPI spec
type SyncPullResponse struct {
	CurrentVersion    int64              `json:"current_version"`
	Records           []sync.Observation `json:"records"`
	ChangeCutoff      int64              `json:"change_cutoff"`
	HasMore           *bool              `json:"has_more,omitempty"`
	SyncFormatVersion *string            `json:"sync_format_version,omitempty"`
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
	apiVersion := r.Header.Get("x-api-version")

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
		CurrentVersion:    result.CurrentVersion,
		Records:           result.Records,
		ChangeCutoff:      result.ChangeCutoff,
		HasMore:           &result.HasMore,
		SyncFormatVersion: &syncFormatVersion,
	}

	// Note: Clients should use change_cutoff as the next since.version for pagination

	h.log.Info("Sync pull request processed",
		"clientId", req.ClientID,
		"sinceVersion", sinceVersion,
		"currentVersion", result.CurrentVersion,
		"recordCount", len(result.Records),
		"hasMore", result.HasMore,
		"apiVersion", apiVersion)

	SendJSONResponse(w, http.StatusOK, response)
}

// SyncPushRequest represents the sync push request payload according to OpenAPI spec
type SyncPushRequest struct {
	TransmissionID string             `json:"transmission_id"`
	ClientID       string             `json:"client_id"`
	Records        []sync.Observation `json:"records"`
}

// SyncPushResponse represents the sync push response payload according to OpenAPI spec
type SyncPushResponse struct {
	CurrentVersion int64                    `json:"current_version"`
	SuccessCount   int                      `json:"success_count"`
	FailedRecords  []map[string]interface{} `json:"failed_records,omitempty"`
	Warnings       []sync.SyncWarning       `json:"warnings,omitempty"`
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

	// Parse API version header
	apiVersion := r.Header.Get("x-api-version")

	// Process the records using the sync service
	result, err := h.syncService.ProcessPushedRecords(r.Context(), req.Records, req.ClientID, req.TransmissionID)
	if err != nil {
		h.log.Error("Failed to process pushed records", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to process sync data")
		return
	}

	// Build response from service result
	response := SyncPushResponse{
		CurrentVersion: result.CurrentVersion,
		SuccessCount:   result.SuccessCount,
		FailedRecords:  result.FailedRecords,
		Warnings:       result.Warnings,
	}

	h.log.Info("Sync push request processed",
		"transmissionId", req.TransmissionID,
		"clientId", req.ClientID,
		"recordCount", len(req.Records),
		"successCount", result.SuccessCount,
		"failedCount", len(result.FailedRecords),
		"warningCount", len(result.Warnings),
		"currentVersion", result.CurrentVersion,
		"apiVersion", apiVersion)

	// Send response
	SendJSONResponse(w, http.StatusOK, response)
}
