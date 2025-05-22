package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/opendataensemble/synkronus/pkg/sync"
)

// SyncPullRequest represents the sync pull request payload
type SyncPullRequest struct {
	LastSyncTimestamp int64             `json:"lastSyncTimestamp"`
	DeviceID          string            `json:"deviceId"`
	Metadata          map[string]string `json:"metadata,omitempty"`
}

// SyncPullResponse represents the sync pull response payload
type SyncPullResponse struct {
	Timestamp int64         `json:"timestamp"`
	Data      []interface{} `json:"data"`
	ETag      string        `json:"etag,omitempty"`
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

	// Check if ETag matches (implement caching)
	ifNoneMatch := r.Header.Get("If-None-Match")
	if ifNoneMatch != "" {
		// Check if data hasn't changed
		unchanged, err := h.syncService.CheckETag(r.Context(), ifNoneMatch, req.DeviceID)
		if err == nil && unchanged {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}

	// Get data from the sync service
	data, etag, err := h.syncService.GetDataSince(r.Context(), req.LastSyncTimestamp, req.DeviceID)
	if err != nil {
		h.log.Error("Failed to get sync data", "error", err, "deviceId", req.DeviceID)

		// Handle specific errors
		if err == sync.ErrDeviceNotFound {
			SendErrorResponse(w, http.StatusBadRequest, err, "Device ID is required")
			return
		}

		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to retrieve sync data")
		return
	}

	// Convert sync items to interface{} for the response
	responseData := make([]interface{}, len(data))
	for i, item := range data {
		responseData[i] = item
	}

	h.log.Info("Sync pull request processed", "deviceId", req.DeviceID)

	// Set ETag header
	w.Header().Set("ETag", etag)

	// Send response
	SendJSONResponse(w, http.StatusOK, SyncPullResponse{
		Timestamp: time.Now().Unix(),
		Data:      responseData,
		ETag:      etag,
	})
}

// SyncPushRequest represents the sync push request payload
type SyncPushRequest struct {
	DeviceID  string        `json:"deviceId"`
	Timestamp int64         `json:"timestamp"`
	Data      []interface{} `json:"data"`
}

// SyncPushResponse represents the sync push response payload
type SyncPushResponse struct {
	Success   bool   `json:"success"`
	Timestamp int64  `json:"timestamp"`
	Message   string `json:"message,omitempty"`
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

	// Validate device ID
	if req.DeviceID == "" {
		h.log.Warn("Missing device ID in push request")
		SendErrorResponse(w, http.StatusBadRequest, sync.ErrDeviceNotFound, "Device ID is required")
		return
	}

	// Convert request data to sync items
	syncItems := make([]sync.SyncItem, len(req.Data))
	for i, item := range req.Data {
		syncItems[i] = item
	}

	// Process the data with the sync service
	err := h.syncService.ProcessPushedData(r.Context(), syncItems, req.DeviceID, req.Timestamp)
	if err != nil {
		h.log.Error("Failed to process pushed data", "error", err, "deviceId", req.DeviceID)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to process sync data")
		return
	}

	h.log.Info("Sync push request processed", "deviceId", req.DeviceID, "items", len(req.Data))

	// Send response
	SendJSONResponse(w, http.StatusOK, SyncPushResponse{
		Success:   true,
		Timestamp: time.Now().Unix(),
		Message:   "Data synchronized successfully",
	})
}
