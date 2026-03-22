package handlers

import (
	"context"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/opendataensemble/synkronus/pkg/middleware/auth"
)

type AttachmentHandler struct {
	service  attachment.Service
	manifest attachment.ManifestService
	log      *logger.Logger
}

func NewAttachmentHandler(
	log *logger.Logger,
	service attachment.Service,
	manifest attachment.ManifestService,
) *AttachmentHandler {
	return &AttachmentHandler{
		service:  service,
		manifest: manifest,
		log:      log,
	}
}

// RegisterRoutes registers the attachment routes
func (h *AttachmentHandler) RegisterRoutes(r chi.Router, manifestHandler func(http.ResponseWriter, *http.Request)) {
	r.Route("/attachments", func(r chi.Router) {
		r.Post("/manifest", manifestHandler)
		// Literal route before /{attachment_id} so "export-zip" is not treated as an ID.
		r.With(auth.RequireRole(models.RoleReadOnly, models.RoleReadWrite, models.RoleAdmin)).Get("/export-zip", h.ExportAllAttachmentsZip)

		r.Route("/{attachment_id}", func(r chi.Router) {
			r.Put("/", h.UploadAttachment)
			r.Get("/", h.DownloadAttachment)
			r.Head("/", h.CheckAttachment)
		})
	})
}

// ExportAllAttachmentsZip handles GET /attachments/export-zip
// @Summary Download all attachments as a streamed ZIP
// @Description Returns a ZIP archive containing every attachment whose latest manifest operation is create or update. Large exports stream without buffering the full archive in memory.
// @Tags Attachments
// @Produce application/zip
// @Success 200 {file} binary "ZIP archive stream"
// @Failure 401 {object} ErrorResponse "Unauthorized"
// @Failure 403 {object} ErrorResponse "Forbidden"
// @Failure 500 {object} ErrorResponse "Internal Server Error"
// @Failure 503 {object} ErrorResponse "Service Unavailable"
// @Security BearerAuth
// @Router /api/attachments/export-zip [get]
func (h *AttachmentHandler) ExportAllAttachmentsZip(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		SendErrorResponse(w, http.StatusServiceUnavailable, nil, "Attachment storage is not available")
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=\"attachments_export.zip\"")

	cw := &countingResponseWriter{ResponseWriter: w}
	ids, err := h.manifest.ListAllCurrentAttachmentIDs(r.Context())
	if err != nil {
		if cw.n == 0 {
			SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to list attachments for export")
			return
		}
		h.log.Error("List attachments for export failed after response started", "error", err)
		return
	}

	if err := h.service.WriteZip(r.Context(), cw, ids); err != nil {
		if cw.n == 0 {
			SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to export attachments")
			return
		}
		h.log.Error("Attachment export failed after response started", "error", err)
	}
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
	file, header, err := r.FormFile("file")
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

	// Record manifest operation so other clients receive a download op in /attachments/manifest.
	// client_id empty => NULL, meaning all clients (see migration comment on attachment_operations).
	if err := h.recordAttachmentCreate(r.Context(), attachmentID, header); err != nil {
		h.log.Error("Failed to record attachment manifest operation", "attachmentId", attachmentID, "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to register attachment for sync")
		return
	}

	// Return success response
	SendJSONResponse(w, http.StatusOK, map[string]string{
		"status": "success",
	})
}

func (h *AttachmentHandler) recordAttachmentCreate(ctx context.Context, attachmentID string, header *multipart.FileHeader) error {
	var sizePtr *int
	if header != nil && header.Size > 0 {
		s := int(header.Size)
		sizePtr = &s
	}
	var contentType *string
	if header != nil {
		if ct := header.Header.Get("Content-Type"); ct != "" {
			contentType = &ct
		}
	}
	return h.manifest.RecordOperation(ctx, attachmentID, "create", "", sizePtr, contentType)
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
