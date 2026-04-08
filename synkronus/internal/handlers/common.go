package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
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

// SendJSONResponse is a helper to send JSON responses
func SendJSONResponse(w http.ResponseWriter, status int, data any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		if err := json.NewEncoder(w).Encode(data); err != nil {
			http.Error(w, "Error encoding response", http.StatusInternalServerError)
		}
	}
}

// ErrorResponse represents a standard error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

// SendErrorResponse is a helper to send error responses
func SendErrorResponse(w http.ResponseWriter, status int, err error, message string) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(status)
	errMsg := "An error occurred"
	if err != nil {
		errMsg = err.Error()
	}
	if encodeErr := json.NewEncoder(w).Encode(ErrorResponse{
		Error:   errMsg,
		Message: message,
	}); encodeErr != nil {
		http.Error(w, "Failed to encode error response", http.StatusInternalServerError)
	}
}

func odeVersionFromRequest(r *http.Request) *string {
	v := strings.TrimSpace(r.Header.Get("x-ode-version"))
	if v == "" {
		v = strings.TrimSpace(r.Header.Get("x-formulus-version"))
	}
	if v == "" {
		return nil
	}
	return &v
}
