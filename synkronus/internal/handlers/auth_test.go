package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLogin(t *testing.T) {
	// Now using our mock auth service implementation

	// Create a test handler
	h, _ := createTestHandler()

	// Test cases using table-driven tests
	tests := []struct {
		name           string
		requestBody    LoginRequest
		expectedStatus int
	}{
		{
			name: "Valid login",
			requestBody: LoginRequest{
				Username: "testuser",
				Password: "password123",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Empty username",
			requestBody: LoginRequest{
				Username: "",
				Password: "password123",
			},
			expectedStatus: http.StatusBadRequest,
		},
		// Add more test cases as needed
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create request body
			body, err := json.Marshal(tc.requestBody)
			if err != nil {
				t.Fatalf("Failed to marshal request body: %v", err)
			}

			// Create a test request
			req := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			// Call the handler
			h.Login(w, req)

			// Check response
			resp := w.Result()
			defer resp.Body.Close()

			// Check status code
			if resp.StatusCode != tc.expectedStatus {
				t.Errorf("Expected status code %d, got %d", tc.expectedStatus, resp.StatusCode)
			}

			// For successful login, check response structure
			if resp.StatusCode == http.StatusOK {
				var loginResp LoginResponse
				if err := json.NewDecoder(resp.Body).Decode(&loginResp); err != nil {
					t.Fatalf("Failed to decode response body: %v", err)
				}

				// Verify response fields
				if loginResp.Token == "" {
					t.Error("Expected token to be non-empty")
				}
				if loginResp.RefreshToken == "" {
					t.Error("Expected refresh token to be non-empty")
				}
				if loginResp.ExpiresAt == 0 {
					t.Error("Expected expiresAt to be non-zero")
				}
			}
		})
	}
}

func TestRefreshToken(t *testing.T) {
	// Now using our mock auth service implementation

	// Create a test handler
	h, _ := createTestHandler()

	// Test cases using table-driven tests
	tests := []struct {
		name           string
		requestBody    RefreshRequest
		expectedStatus int
	}{
		{
			name: "Valid refresh token",
			requestBody: RefreshRequest{
				RefreshToken: "valid-refresh-token",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "Empty refresh token",
			requestBody: RefreshRequest{
				RefreshToken: "",
			},
			expectedStatus: http.StatusBadRequest,
		},
		// Add more test cases as needed
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create request body
			body, err := json.Marshal(tc.requestBody)
			if err != nil {
				t.Fatalf("Failed to marshal request body: %v", err)
			}

			// Create a test request
			req := httptest.NewRequest(http.MethodPost, "/auth/refresh", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			// Call the handler
			h.RefreshToken(w, req)

			// Check response
			resp := w.Result()
			defer resp.Body.Close()

			// Check status code
			if resp.StatusCode != tc.expectedStatus {
				t.Errorf("Expected status code %d, got %d", tc.expectedStatus, resp.StatusCode)
			}

			// For successful refresh, check response structure
			if resp.StatusCode == http.StatusOK {
				var refreshResp LoginResponse
				if err := json.NewDecoder(resp.Body).Decode(&refreshResp); err != nil {
					t.Fatalf("Failed to decode response body: %v", err)
				}

				// Verify response fields
				if refreshResp.Token == "" {
					t.Error("Expected token to be non-empty")
				}
				if refreshResp.RefreshToken == "" {
					t.Error("Expected refresh token to be non-empty")
				}
				if refreshResp.ExpiresAt == 0 {
					t.Error("Expected expiresAt to be non-zero")
				}
			}
		})
	}
}
