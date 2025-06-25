package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// SyncPullRequest represents the sync pull request payload according to OpenAPI spec
type SyncPullRequest struct {
	ClientID    string                 `json:"client_id"`
	Since       *SyncPullRequestSince  `json:"since,omitempty"`
	SchemaTypes []string               `json:"schema_types,omitempty"`
}

// SyncPullRequestSince represents the pagination cursor
type SyncPullRequestSince struct {
	Version int    `json:"version"`
	ID      string `json:"id"`
}

// SyncPullResponse represents the sync pull response payload according to OpenAPI spec
type SyncPullResponse struct {
	CurrentVersion    int           `json:"current_version"`
	Records           []Observation `json:"records"`
	ChangeCutoff      int           `json:"change_cutoff"`
	NextPageToken     *string       `json:"next_page_token,omitempty"`
	HasMore           *bool         `json:"has_more,omitempty"`
	SyncFormatVersion *string       `json:"sync_format_version,omitempty"`
}

// Observation represents an observation record according to OpenAPI spec
type Observation struct {
	ObservationID string  `json:"observation_id"`
	FormType      string  `json:"form_type"`
	FormVersion   string  `json:"form_version"`
	Data          string  `json:"data"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
	SyncedAt      *string `json:"synced_at"`
	Deleted       bool    `json:"deleted"`
}

// Pull handles the /sync/pull endpoint
func (h *Handler) Pull(w http.ResponseWriter, r *http.Request) {
	var req SyncPullRequest

	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.log.Error("Failed to decode sync pull request", "error", err)
		SendErrorResponse(w, http.StatusBadRequest, err, "Invalid request format")
		return
	}

	// Validate required fields
	if req.ClientID == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "client_id is required")
		return
	}

	// Parse query parameters
	schemaType := r.URL.Query().Get("schemaType")
	limitStr := r.URL.Query().Get("limit")
	pageToken := r.URL.Query().Get("page_token")
	apiVersion := r.Header.Get("x-api-version")

	// Parse limit with default value
	limit := 50 // default
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil {
			if parsedLimit >= 1 && parsedLimit <= 500 {
				limit = parsedLimit
			}
		}
	}

	// For now, return a dummy but valid response matching the OpenAPI spec
	// TODO: Implement actual running number-based sync logic
	syncFormatVersion := "1.0"
	hasMore := false
	
	response := SyncPullResponse{
		CurrentVersion:    1,                // Dummy version number
		Records:           []Observation{}, // Empty array as requested
		ChangeCutoff:      0,               // Dummy value
		NextPageToken:     nil,             // No pagination for dummy response
		HasMore:           &hasMore,
		SyncFormatVersion: &syncFormatVersion,
	}

	h.log.Info("Sync pull request processed", 
		"clientId", req.ClientID, 
		"schemaType", schemaType,
		"limit", limit,
		"pageToken", pageToken,
		"apiVersion", apiVersion,
		"since", req.Since)

	// Send response
	SendJSONResponse(w, http.StatusOK, response)
}

// SyncPushRequest represents the sync push request payload according to OpenAPI spec
type SyncPushRequest struct {
	TransmissionID string        `json:"transmission_id"`
	ClientID       string        `json:"client_id"`
	Records        []Observation `json:"records"`
}

// SyncPushResponse represents the sync push response payload according to OpenAPI spec
type SyncPushResponse struct {
	CurrentVersion int                      `json:"current_version"`
	SuccessCount   int                      `json:"success_count"`
	FailedRecords  []map[string]interface{} `json:"failed_records,omitempty"`
	Warnings       []SyncWarning            `json:"warnings,omitempty"`
}

// SyncWarning represents a warning in the sync push response
type SyncWarning struct {
	ID      string `json:"id"`
	Code    string `json:"code"`
	Message string `json:"message"`
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

	// Validate each record (basic validation for dummy implementation)
	var warnings []SyncWarning
	var failedRecords []map[string]interface{}
	successCount := 0

	for i, record := range req.Records {
		// Basic validation
		if record.ObservationID == "" {
			failedRecords = append(failedRecords, map[string]interface{}{
				"index": i,
				"error": "observation_id is required",
				"record": record,
			})
			continue
		}
		if record.FormType == "" {
			warnings = append(warnings, SyncWarning{
				ID:      record.ObservationID,
				Code:    "MISSING_FORM_TYPE",
				Message: "form_type is empty but record was processed",
			})
		}
		
		// For dummy implementation, assume all valid records succeed
		successCount++
	}

	// For now, return a dummy but valid response
	// TODO: Implement actual record processing logic with database operations
	response := SyncPushResponse{
		CurrentVersion: 2,                    // Dummy version number after processing (incremented)
		SuccessCount:   successCount,
		FailedRecords:  failedRecords,
		Warnings:       warnings,
	}

	h.log.Info("Sync push request processed", 
		"transmissionId", req.TransmissionID,
		"clientId", req.ClientID, 
		"recordCount", len(req.Records),
		"successCount", successCount,
		"failedCount", len(failedRecords),
		"warningCount", len(warnings),
		"apiVersion", apiVersion)

	// Send response
	SendJSONResponse(w, http.StatusOK, response)
}
