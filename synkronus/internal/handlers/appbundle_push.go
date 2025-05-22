package handlers

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/opendataensemble/synkronus/internal/models"
	authmw "github.com/opendataensemble/synkronus/pkg/middleware/auth"
)

// PushAppBundle handles the /app-bundle/push endpoint
func (h *Handler) PushAppBundle(w http.ResponseWriter, r *http.Request) {
	h.log.Info("App bundle push requested")
	ctx := r.Context()

	// Get user from context (this should be set by the auth middleware)
	user, ok := ctx.Value(authmw.UserKey).(*models.User)
	if !ok || user == nil {
		h.log.Warn("Unauthorized app bundle push attempt")
		SendErrorResponse(w, http.StatusUnauthorized, nil, "Unauthorized")
		return
	}

	// Check if the request is a multipart form
	if err := r.ParseMultipartForm(32 << 20); err != nil { // 32MB max
		h.log.Error("Failed to parse multipart form", "error", err)
		SendErrorResponse(w, http.StatusBadRequest, err, "Invalid request format. Expected multipart form with a 'bundle' file")
		return
	}

	// Get the file from the form
	file, header, err := r.FormFile("bundle")
	if err != nil {
		h.log.Error("Failed to get bundle file from form", "error", err)
		SendErrorResponse(w, http.StatusBadRequest, err, "Failed to get bundle file from form")
		return
	}
	defer file.Close()

	// Log the upload
	h.log.Info("Processing app bundle upload", "filename", header.Filename, "size", header.Size, "user", user.Username)

	// Push the bundle
	manifest, err := h.appBundleService.PushBundle(ctx, file)
	if err != nil {
		h.log.Error("Failed to push app bundle", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to process app bundle")
		return
	}

	// Return the new manifest
	h.log.Info("App bundle successfully pushed", "user", user.Username)
	SendJSONResponse(w, http.StatusOK, map[string]interface{}{
		"message":  "App bundle successfully pushed",
		"manifest": manifest,
	})
}

// GetAppBundleVersions handles the /app-bundle/versions endpoint
func (h *Handler) GetAppBundleVersions(w http.ResponseWriter, r *http.Request) {
	h.log.Info("App bundle versions requested")
	ctx := r.Context()

	// Get the versions
	versions, err := h.appBundleService.GetVersions(ctx)
	if err != nil {
		h.log.Error("Failed to get app bundle versions", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to get app bundle versions")
		return
	}

	// Return the versions
	SendJSONResponse(w, http.StatusOK, map[string]interface{}{
		"versions": versions,
	})
}

// SwitchAppBundleVersion handles the /app-bundle/switch/{version} endpoint
func (h *Handler) SwitchAppBundleVersion(w http.ResponseWriter, r *http.Request) {
	// Check if user is authenticated
	user, ok := r.Context().Value(authmw.UserKey).(*models.User)
	if !ok || user == nil {
		h.log.Warn("Unauthorized app bundle version switch attempt")
		SendErrorResponse(w, http.StatusUnauthorized, nil, "Unauthorized")
		return
	}

	// Get the version from the URL using Chi's URL parameter extraction
	version := chi.URLParam(r, "version")
	if version == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "Version is required")
		return
	}

	h.log.Info("App bundle version switch requested", "version", version, "user", user.Username)
	ctx := r.Context()

	// Switch to the version
	err := h.appBundleService.SwitchVersion(ctx, version)
	if err != nil {
		h.log.Error("Failed to switch app bundle version", "error", err, "version", version)
		SendErrorResponse(w, http.StatusInternalServerError, err, fmt.Sprintf("Failed to switch to version %s", version))
		return
	}

	// Return success
	h.log.Info("App bundle version switched", "version", version)
	SendJSONResponse(w, http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Switched to app bundle version %s", version),
	})
}
