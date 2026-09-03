package handlers

import (
	"context"
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/config"
	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/opendataensemble/synkronus/pkg/middleware/auth"
	"github.com/opendataensemble/synkronus/pkg/sync"
)

type AttachmentHandler struct {
	service        attachment.Service
	manifest       attachment.ManifestService
	syncService    sync.ServiceInterface
	log            *logger.Logger
	maxUploadBytes int64
	uploadSlots    chan struct{}
}

const multipartMemoryBytes = 1 << 20

func NewAttachmentHandler(
	log *logger.Logger,
	service attachment.Service,
	manifest attachment.ManifestService,
	syncService sync.ServiceInterface,
	configs ...*config.Config,
) *AttachmentHandler {
	maxUploadBytes := config.DefaultMaxAttachmentUploadBytes
	maxConcurrentUploads := config.DefaultMaxConcurrentAttachmentUploads
	if len(configs) > 0 && configs[0] != nil {
		if configs[0].MaxAttachmentUploadBytes > 0 {
			maxUploadBytes = configs[0].MaxAttachmentUploadBytes
		}
		if configs[0].MaxConcurrentAttachmentUploads > 0 {
			maxConcurrentUploads = configs[0].MaxConcurrentAttachmentUploads
		}
	}
	return &AttachmentHandler{
		service:        service,
		manifest:       manifest,
		syncService:    syncService,
		log:            log,
		maxUploadBytes: maxUploadBytes,
		uploadSlots:    make(chan struct{}, maxConcurrentUploads),
	}
}

// RegisterRoutes registers the attachment routes
func (h *AttachmentHandler) RegisterRoutes(r chi.Router, manifestHandler func(http.ResponseWriter, *http.Request)) {
	r.Route("/attachments", func(r chi.Router) {
		r.Post("/manifest", manifestHandler)
		// Literal route before /{attachment_id} so "export-zip" is not treated as an ID.
		r.With(auth.RequireRole(models.RoleReadOnly, models.RoleReadWrite, models.RoleAdmin)).Get("/export-zip", h.ExportAllAttachmentsZip)

		r.Route("/{attachment_id}", func(r chi.Router) {
			r.With(auth.RequireRole(models.RoleReadWrite, models.RoleAdmin)).Put("/", h.UploadAttachment)
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
	if err := attachment.ValidateAttachmentID(attachmentID); err != nil {
		SendErrorResponse(w, http.StatusBadRequest, nil, "attachment_id is invalid")
		return
	}
	select {
	case h.uploadSlots <- struct{}{}:
		defer func() { <-h.uploadSlots }()
	case <-r.Context().Done():
		SendErrorResponse(w, http.StatusRequestTimeout, nil, "Upload cancelled")
		return
	}

	clientGen, clientGenSent := sync.ParseClientRepositoryGenerationSent(r, nil)
	serverGen, err := h.syncService.GetRepositoryGeneration(r.Context())
	if err != nil {
		h.log.Error("Failed to read repository generation", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to verify repository generation")
		return
	}
	// Fresh install (no header): adopt server generation — see Pull handler.
	if clientGenSent && clientGen != serverGen {
		w.Header().Set(sync.HeaderRepositoryGeneration, strconv.FormatInt(serverGen, 10))
		SendErrorResponseWithCode(w, http.StatusConflict, sync.ErrRepositoryGenerationMismatch,
			"Client repository_generation does not match the server; align generation before uploading attachments.",
			CodeRepositoryResetRequired)
		return
	}

	// Bound the complete multipart request separately from the attachment content.
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadBytes+multipartMemoryBytes)
	err = r.ParseMultipartForm(multipartMemoryBytes)
	if err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			SendErrorResponse(w, http.StatusRequestEntityTooLarge, nil, "Attachment exceeds upload size limit")
			return
		}
		SendErrorResponse(w, http.StatusBadRequest, nil, "Failed to parse multipart form")
		return
	}
	defer r.MultipartForm.RemoveAll()
	if len(r.MultipartForm.File) != 1 || len(r.MultipartForm.File["file"]) != 1 || len(r.MultipartForm.Value) != 0 {
		SendErrorResponse(w, http.StatusBadRequest, nil, "Exactly one file part is required")
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

	saveResult, err := h.service.SaveUpload(r.Context(), attachmentID, file, header.Header.Get("Content-Type"))
	if err != nil {
		if errors.Is(err, attachment.ErrAttachmentTooLarge) {
			SendErrorResponse(w, http.StatusRequestEntityTooLarge, nil, "Attachment exceeds upload size limit")
			return
		}
		if os.IsExist(err) {
			SendErrorResponse(w, http.StatusConflict, err, "Attachment already exists")
			return
		}
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to save attachment")
		return
	}

	// Record manifest operation so other clients receive a download op in /attachments/manifest.
	// client_id empty => NULL, meaning all clients (see migration comment on attachment_operations).
	if err := h.recordAttachmentCreate(r.Context(), attachmentID, saveResult.ServedSize, saveResult.ServedContentType); err != nil {
		h.log.Error("Failed to record attachment manifest operation", "attachmentId", attachmentID, "error", err)
		if rollbackErr := h.service.RemoveUpload(context.WithoutCancel(r.Context()), attachmentID); rollbackErr != nil {
			h.log.Error("Failed to roll back attachment after manifest error", "attachmentId", attachmentID, "error", rollbackErr)
		}
		SendErrorResponse(w, http.StatusInternalServerError, nil, "Failed to register attachment for sync")
		return
	}

	// Return success response
	SendJSONResponse(w, http.StatusOK, map[string]string{
		"status": "success",
	})
}

func (h *AttachmentHandler) recordAttachmentCreate(ctx context.Context, attachmentID string, size int, contentType string) error {
	var sizePtr *int
	if size > 0 {
		s := size
		sizePtr = &s
	}
	var contentTypePtr *string
	if ct := strings.TrimSpace(contentType); ct != "" {
		contentTypePtr = &ct
	}
	return h.manifest.RecordOperation(ctx, attachmentID, "create", "", sizePtr, contentTypePtr)
}

// DownloadAttachment handles GET /attachments/{attachment_id}
func (h *AttachmentHandler) DownloadAttachment(w http.ResponseWriter, r *http.Request) {
	// Get attachment ID from URL
	attachmentID := chi.URLParam(r, "attachment_id")
	if attachmentID == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "attachment_id is required")
		return
	}

	preferOriginal := preferOriginalAttachment(r)

	// Check if attachment exists
	exists, err := h.service.ExistsForDownload(r.Context(), attachmentID, preferOriginal)
	if err != nil {
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to check attachment existence")
		return
	}
	if !exists {
		SendErrorResponse(w, http.StatusNotFound, nil, "Attachment not found")
		return
	}

	// Get the attachment
	file, err := h.service.OpenForDownload(r.Context(), attachmentID, preferOriginal)
	if err != nil {
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to get attachment")
		return
	}
	defer file.Close()

	// Set headers for file download
	w.Header().Set("Content-Type", "application/octet-stream")
	disposition := mime.FormatMediaType("attachment", map[string]string{"filename": filepath.Base(attachmentID)})
	w.Header().Set("Content-Disposition", disposition)

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
	exists, err := h.service.ExistsForDownload(r.Context(), attachmentID, preferOriginalAttachment(r))
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

func preferOriginalAttachment(r *http.Request) bool {
	raw := strings.TrimSpace(r.URL.Query().Get("original"))
	if raw == "" {
		return false
	}
	switch strings.ToLower(raw) {
	case "1", "true", "yes":
		return true
	default:
		parsed, err := strconv.ParseBool(raw)
		return err == nil && parsed
	}
}
