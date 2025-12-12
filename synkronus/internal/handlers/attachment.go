package handlers

import (
	"errors"
	"io"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

type AttachmentHandler struct {
	service attachment.Service
	log     *logger.Logger
}

func NewAttachmentHandler(log *logger.Logger, service attachment.Service) *AttachmentHandler {
	return &AttachmentHandler{
		service: service,
		log:     log,
	}
}

// RegisterRoutes registers the attachment routes
func (h *AttachmentHandler) RegisterRoutes(r chi.Router, manifestHandler func(http.ResponseWriter, *http.Request)) {
	r.Route("/attachments", func(r chi.Router) {
		// Manifest endpoint
		r.Post("/manifest", manifestHandler)

		// Individual attachment routes
		r.Route("/{attachment_id}", func(r chi.Router) {
			r.Put("/", h.UploadAttachment)
			r.Get("/", h.DownloadAttachment)
			r.Head("/", h.CheckAttachment)
		})
	})
}

// UploadAttachment handles PUT /attachments/{attachment_id}
func (h *AttachmentHandler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	// Get attachment ID from URL
	attachmentID := chi.URLParam(r, "attachment_id")
	if attachmentID == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "attachment_id is required")
		return
	}

	// Parse the multipart form
	err := r.ParseMultipartForm(32 << 20) // 32MB max memory
	if err != nil {
		SendErrorResponse(w, http.StatusBadRequest, err, "Failed to parse multipart form")
		return
	}

	// Get the file from the form data
	file, _, err := r.FormFile("file")
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) {
			SendErrorResponse(w, http.StatusBadRequest, nil, "file is required")
			return
		}
		SendErrorResponse(w, http.StatusBadRequest, err, "Failed to get file from form data")
		return
	}
	defer file.Close()

	// Save the attachment
	err = h.service.Save(r.Context(), attachmentID, file)
	if err != nil {
		if os.IsExist(err) {
			SendErrorResponse(w, http.StatusConflict, err, "Attachment already exists")
			return
		}
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to save attachment")
		return
	}

	// Return success response
	SendJSONResponse(w, http.StatusOK, map[string]string{
		"status": "success",
	})
}

// DownloadAttachment handles GET /attachments/{attachment_id}
func (h *AttachmentHandler) DownloadAttachment(w http.ResponseWriter, r *http.Request) {
	// Get attachment ID from URL
	attachmentID := chi.URLParam(r, "attachment_id")
	if attachmentID == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "attachment_id is required")
		return
	}

	// Check if attachment exists
	exists, err := h.service.Exists(r.Context(), attachmentID)
	if err != nil {
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to check attachment existence")
		return
	}
	if !exists {
		SendErrorResponse(w, http.StatusNotFound, nil, "Attachment not found")
		return
	}

	// Get the attachment
	file, err := h.service.Get(r.Context(), attachmentID)
	if err != nil {
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to get attachment")
		return
	}
	defer file.Close()

	// Set headers for file download
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename="+attachmentID)

	// Stream the file to the response
	_, err = io.Copy(w, file)
	if err != nil {
		// Can't change status code here as we've already started writing the response
		// Log the error instead
		h.log.Error("Failed to stream attachment", "error", err)
	}
}

// CheckAttachment handles HEAD /attachments/{attachment_id}
func (h *AttachmentHandler) CheckAttachment(w http.ResponseWriter, r *http.Request) {
	// Get attachment ID from URL
	attachmentID := chi.URLParam(r, "attachment_id")
	if attachmentID == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	// Check if attachment exists
	exists, err := h.service.Exists(r.Context(), attachmentID)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	if !exists {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	// Return 200 OK if file exists
	w.WriteHeader(http.StatusOK)
}
