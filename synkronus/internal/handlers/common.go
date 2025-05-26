package handlers

import (
	"encoding/json"
	"net/http"
)

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
