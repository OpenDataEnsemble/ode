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
// @Router /api/dataexport/parquet [get]
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

// RawJSONExportHandler handles GET /dataexport/raw-json
// @Summary Download a ZIP of per-observation JSON files
// @Description Returns a ZIP archive where each non-deleted observation is one pretty-printed JSON file, grouped by form type folder. Each file contains metadata fields and a nested `data` object with the form payload.
// @Tags DataExport
// @Produce application/zip
// @Success 200 {file} binary "ZIP archive stream containing JSON files"
// @Failure 401 {object} ErrorResponse "Unauthorized"
// @Failure 403 {object} ErrorResponse "Forbidden"
// @Failure 500 {object} ErrorResponse "Internal Server Error"
// @Security BearerAuth
// @Router /api/dataexport/raw-json [get]
func (h *Handler) RawJSONExportHandler(w http.ResponseWriter, r *http.Request) {
	zipReader, err := h.dataExportService.ExportRawJSONZip(r.Context())
	if err != nil {
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to export raw JSON data")
		return
	}
	defer zipReader.Close()

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=\"observations_raw_json.zip\"")
	w.WriteHeader(http.StatusOK)

	if _, err := io.Copy(w, zipReader); err != nil {
		h.log.Error("Failed to stream raw JSON export", "error", err)
		return
	}
}
