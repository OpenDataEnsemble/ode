package handlers

import (
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"

	"github.com/go-chi/chi/v5"
)

// GetAppBundleManifest handles the /app-bundle/manifest endpoint
func (h *Handler) GetAppBundleManifest(w http.ResponseWriter, r *http.Request) {
	h.log.Info("App bundle manifest requested")
	ctx := r.Context()

	// Get the manifest from the service
	manifest, err := h.appBundleService.GetManifest(ctx)
	if err != nil {
		h.log.Error("Failed to get app bundle manifest", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to get app bundle manifest")
		return
	}

	// Check if ETag matches
	etag := fmt.Sprintf("\"%s\"", manifest.Hash)
	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	// Set ETag header
	w.Header().Set("ETag", etag)

	// Send the response
	SendJSONResponse(w, http.StatusOK, manifest)
}

// GetAppBundleFile handles the /app-bundle/{path} endpoint
func (h *Handler) GetAppBundleFile(w http.ResponseWriter, r *http.Request) {
	// Get the file path from the URL
	filePath := chi.URLParam(r, "path")
	if filePath == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "File path is required")
		return
	}

	// Clean the path to prevent directory traversal
	filePath = path.Clean(filePath)
	if strings.Contains(filePath, "..") {
		SendErrorResponse(w, http.StatusBadRequest, nil, "Invalid file path")
		return
	}

	h.log.Info("App bundle file requested", "path", filePath)
	ctx := r.Context()

	// Get the file hash for ETag
	hash, err := h.appBundleService.GetFileHash(ctx, filePath)
	if err != nil {
		h.log.Error("Failed to get file hash", "error", err, "path", filePath)
		// Continue anyway, we'll handle the error when getting the file
	} else {
		// Check if ETag matches
		etag := fmt.Sprintf("\"%s\"", hash)
		if r.Header.Get("If-None-Match") == etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		// Set ETag header
		w.Header().Set("ETag", etag)
	}

	// Get the file from the service
	fileReader, fileInfo, err := h.appBundleService.GetFile(ctx, filePath)
	if err != nil {
		h.log.Error("Failed to get app bundle file", "error", err, "path", filePath)
		SendErrorResponse(w, http.StatusNotFound, err, "File not found")
		return
	}
	defer fileReader.Close()

	// Set content type header
	if fileInfo.MimeType != "" {
		w.Header().Set("Content-Type", fileInfo.MimeType)
	} else {
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	// Set content length header
	w.Header().Set("Content-Length", fmt.Sprintf("%d", fileInfo.Size))

	// Stream the file to the response
	_, err = io.Copy(w, fileReader)
	if err != nil {
		h.log.Error("Failed to stream file", "error", err, "path", filePath)
		// Error already sent to client, nothing more to do
	}
}
