package handlers

import (
	"net/http"
)

// countingResponseWriter wraps http.ResponseWriter to detect whether any body bytes were written.
type countingResponseWriter struct {
	http.ResponseWriter
	n int64
}

func (c *countingResponseWriter) Write(p []byte) (int, error) {
	n, err := c.ResponseWriter.Write(p)
	c.n += int64(n)
	return n, err
}

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
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=\"observations_export.zip\"")

	cw := &countingResponseWriter{ResponseWriter: w}
	if err := h.dataExportService.ExportParquetZip(r.Context(), cw); err != nil {
		if cw.n == 0 {
			SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to export parquet data")
			return
		}
		h.log.Error("Parquet export failed after response started", "error", err)
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
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=\"observations_raw_json.zip\"")

	cw := &countingResponseWriter{ResponseWriter: w}
	if err := h.dataExportService.ExportRawJSONZip(r.Context(), cw); err != nil {
		if cw.n == 0 {
			SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to export raw JSON data")
			return
		}
		h.log.Error("Raw JSON export failed after response started", "error", err)
		return
	}
}
