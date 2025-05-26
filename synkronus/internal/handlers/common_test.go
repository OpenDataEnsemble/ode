package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSendJSONResponse(t *testing.T) {
	// Create a ResponseRecorder to record the response
	rr := httptest.NewRecorder()

	// Test data
	testData := map[string]string{"message": "test"}

	// Call the function
	SendJSONResponse(rr, http.StatusOK, testData)

	// Check the status code
	if rr.Code != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", rr.Code, http.StatusOK)
	}

	// Check the content type header
	if contentType := rr.Header().Get("content-type"); contentType != "application/json" {
		t.Errorf("handler returned wrong content type: got %v want %v", contentType, "application/json")
	}

	// Check the response body contains the expected JSON
	expected := map[string]string{"message": "test"}
	actual := map[string]string{}
	if err := json.Unmarshal(rr.Body.Bytes(), &actual); err != nil {
		t.Errorf("Error unmarshaling response: %v", err)
	}

	if actual["message"] != expected["message"] {
		t.Errorf("handler returned unexpected body: got %v want %v", actual, expected)
	}
}

func TestSendErrorResponse(t *testing.T) {
	// Create a ResponseRecorder to record the response
	rr := httptest.NewRecorder()

	// Call the function with an error
	testErr := errors.New("test error")
	testMessage := "Test error message"
	SendErrorResponse(rr, http.StatusBadRequest, testErr, testMessage)

	// Check the status code
	if rr.Code != http.StatusBadRequest {
		t.Errorf("handler returned wrong status code: got %v want %v", rr.Code, http.StatusBadRequest)
	}

	// Check the content type header
	if contentType := rr.Header().Get("content-type"); contentType != "application/json" {
		t.Errorf("handler returned wrong content type: got %v want %v", contentType, "application/json")
	}

	// Check the response body contains the expected JSON
	expected := ErrorResponse{
		Error:   testErr.Error(),
		Message: testMessage,
	}
	actual := ErrorResponse{}
	if err := json.Unmarshal(rr.Body.Bytes(), &actual); err != nil {
		t.Errorf("Error unmarshaling response: %v", err)
	}

	if actual.Error != expected.Error || actual.Message != expected.Message {
		t.Errorf("handler returned unexpected body: got %v want %v", actual, expected)
	}
}
