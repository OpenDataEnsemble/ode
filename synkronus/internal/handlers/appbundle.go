package handlers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"

	"github.com/collectakit/synkronus/pkg/appbundle"
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

	// Check if we should get the latest version
	latest := false
	if latestParam := r.URL.Query().Get("latest"); latestParam != "" {
		var err error
		latest, err = strconv.ParseBool(latestParam)
		if err != nil {
			h.log.Warn("Invalid value for 'latest' parameter, using default (false)", "value", latestParam, "error", err)
		}
	}

	var (
		file     io.ReadCloser
		fileInfo *appbundle.File
		err      error
	)

	// Get the file from either the latest version or the active version
	if latest {
		file, fileInfo, err = h.appBundleService.GetLatestVersionFile(r.Context(), filePath)
	} else {
		file, fileInfo, err = h.appBundleService.GetFile(r.Context(), filePath)
	}

	if err != nil {
		h.log.Error("Failed to get file from app bundle", "error", err, "path", filePath, "latest", latest)
		if errors.Is(err, os.ErrNotExist) || errors.Is(err, appbundle.ErrFileNotFound) {
			SendErrorResponse(w, http.StatusNotFound, err, "File not found")
		} else {
			SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to get file")
		}
		return
	}
	defer file.Close()

	// Set the appropriate headers
	etag := fmt.Sprintf("\"%s\"", fileInfo.Hash)
	w.Header().Set("Content-Type", fileInfo.MimeType)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", fileInfo.Size))
	w.Header().Set("ETag", etag)
	if latest {
		w.Header().Set("X-Is-Latest", "true")
	}

	// Check If-None-Match header for caching
	if match := r.Header.Get("If-None-Match"); match != "" {
		if match == etag || match == "*" {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}

	// Stream the file to the response
	h.streamFile(w, r, file, fileInfo)
}

func (h *Handler) streamFile(w http.ResponseWriter, r *http.Request, file io.ReadCloser, fileInfo *appbundle.File) {
	// Stream the file to the response
	if _, err := io.Copy(w, file); err != nil {
		h.log.Error("Failed to stream file", "error", err, "path", fileInfo.Path)
		// Error already sent to client, nothing more to do
	}
}
