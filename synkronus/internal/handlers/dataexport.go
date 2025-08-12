package handlers

import (
	"io"
	"net/http"
)

// ParquetExportHandler handles GET /dataexport/parquet
// @Summary Download a ZIP archive of Parquet exports
// @Description Returns a ZIP file containing multiple Parquet files, each representing a flattened export of observations per form type. Supports downloading the entire dataset as separate Parquet files bundled together.
// @Tags DataExport
// @Produce application/zip
// @Success 200 {file} binary "ZIP archive stream containing Parquet files"
// @Failure 401 {object} ErrorResponse "Unauthorized"
// @Failure 403 {object} ErrorResponse "Forbidden"
// @Failure 500 {object} ErrorResponse "Internal Server Error"
// @Security BearerAuth
// @Router /dataexport/parquet [get]
func (h *Handler) ParquetExportHandler(w http.ResponseWriter, r *http.Request) {
	// Export data as parquet ZIP
	zipReader, err := h.dataExportService.ExportParquetZip(r.Context())
	if err != nil {
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to export parquet data")
		return
	}
	defer zipReader.Close()

	// Set headers for ZIP file download
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=\"observations_export.zip\"")
	w.WriteHeader(http.StatusOK)

	// Stream the ZIP file to the response
	if _, err := io.Copy(w, zipReader); err != nil {
		// Response already started, can't send error response
		h.log.Error("Failed to stream parquet export", "error", err)
		return
	}
}
