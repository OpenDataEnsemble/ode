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

	// Check if we should get the preview version
	preview := false
	if previewParam := r.URL.Query().Get("preview"); previewParam != "" {
		var err error
		preview, err = strconv.ParseBool(previewParam)
		if err != nil {
			h.log.Warn("Invalid value for 'preview' parameter, using default (false)", "value", previewParam, "error", err)
		}
	}

	var (
		file     io.ReadCloser
		fileInfo *appbundle.File
		err      error
	)

	// Get the file from either the preview version or the active version
	if preview {
		file, fileInfo, err = h.appBundleService.GetLatestVersionFile(r.Context(), filePath)
	} else {
		file, fileInfo, err = h.appBundleService.GetFile(r.Context(), filePath)
	}

	if err != nil {
		h.log.Error("Failed to get file from app bundle", "error", err, "path", filePath, "preview", preview)
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
	if preview {
		w.Header().Set("x-is-preview", "true")
	}

	// Check If-None-Match header for caching
	if match := r.Header.Get("If-None-Match"); match != "" {
		if match == etag || match == "*" {
			w.WriteHeader(http.StatusNotModified)
			return
		}
	}

	// Stream the file to the response
	h.streamFile(w, file, fileInfo)
}

func (h *Handler) streamFile(w http.ResponseWriter, file io.ReadCloser, fileInfo *appbundle.File) {
	defer file.Close()

	// Set content type and headers
	w.Header().Set("Content-Type", fileInfo.MimeType)
	w.Header().Set("Content-Length", strconv.FormatInt(fileInfo.Size, 10))
	w.Header().Set("ETag", "\""+fileInfo.Hash+"\"")

	// Stream the file
	if _, err := io.Copy(w, file); err != nil {
		h.log.Error("Failed to stream file", "error", err)
	}
}

// CompareAppBundleVersions handles the /app-bundle/changes endpoint
func (h *Handler) CompareAppBundleVersions(w http.ResponseWriter, r *http.Request) {
	h.log.Info("App bundle comparison requested")
	ctx := r.Context()

	// Get query parameters
	preview := r.URL.Query().Get("preview") == "true"

	// Get the current version
	currentVersion := r.URL.Query().Get("current")
	if currentVersion == "" {
		// If no current version is specified, use the latest released version
		versions, err := h.appBundleService.GetVersions(ctx)
		if err != nil || len(versions) == 0 {
			h.log.Error("Failed to get current version", "error", err)
			SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to get current version")
			return
		}
		currentVersion = versions[len(versions)-1]
	}

	// Determine the target version (preview or previous)
	targetVersion := "latest"
	if !preview {
		// If not preview, compare with the previous version
		versions, err := h.appBundleService.GetVersions(ctx)
		if err != nil {
			h.log.Error("Failed to get versions", "error", err)
			SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to get versions")
			return
		}

		// Find the index of the current version
		currentIdx := -1
		for i, v := range versions {
			if v == currentVersion {
				currentIdx = i
				break
			}
		}

		if currentIdx <= 0 {
			// If no previous version exists, return an empty change log
			SendJSONResponse(w, http.StatusOK, &appbundle.ChangeLog{
				CompareVersionA: currentVersion,
				CompareVersionB: currentVersion,
			})
			return
		}

		targetVersion = versions[currentIdx-1]
	}

	// Compare the versions
	changeLog, err := h.appBundleService.CompareAppInfos(ctx, currentVersion, targetVersion)
	if err != nil {
		h.log.Error("Failed to compare app bundle versions",
			"versionA", currentVersion,
			"versionB", targetVersion,
			"error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to compare versions")
		return
	}

	// Send the response
	SendJSONResponse(w, http.StatusOK, changeLog)
}
