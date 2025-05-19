package handlers

import (
	"encoding/json"
	"net/http"
	"time"
)

// LoginRequest represents the login request payload
type LoginRequest struct {
	Username string `json:"username"` // Using 'username' as per memory requirements
	Password string `json:"password"`
}

// LoginResponse represents the login response payload
type LoginResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refreshToken"`
	ExpiresAt    int64  `json:"expiresAt"`
}

// Login handles the /auth/login endpoint
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	
	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.log.Error("Failed to decode login request", "error", err)
		SendErrorResponse(w, http.StatusBadRequest, err, "Invalid request format")
		return
	}
	
	// Validate request fields
	if req.Username == "" {
		h.log.Warn("Missing username in login request")
		SendErrorResponse(w, http.StatusBadRequest, nil, "Username is required")
		return
	}
	
	if req.Password == "" {
		h.log.Warn("Missing password in login request")
		SendErrorResponse(w, http.StatusBadRequest, nil, "Password is required")
		return
	}
	
	// Authenticate user
	user, err := h.authService.Authenticate(r.Context(), req.Username, req.Password)
	if err != nil {
		h.log.Error("Authentication failed", "username", req.Username, "error", err)
		SendErrorResponse(w, http.StatusUnauthorized, err, "Invalid credentials")
		return
	}
	
	// Generate JWT token
	token, err := h.authService.GenerateToken(user)
	if err != nil {
		h.log.Error("Failed to generate token", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to generate token")
		return
	}
	
	// Generate refresh token
	refreshToken, err := h.authService.GenerateRefreshToken(user)
	if err != nil {
		h.log.Error("Failed to generate refresh token", "error", err)
		SendErrorResponse(w, http.StatusInternalServerError, err, "Failed to generate refresh token")
		return
	}
	
	// Calculate token expiration
	expiresAt := time.Now().Add(h.authService.Config().TokenExpiration).Unix()
	
	h.log.Info("User logged in successfully", "username", req.Username)
	
	// Send response
	SendJSONResponse(w, http.StatusOK, LoginResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	})
}

// RefreshRequest represents the token refresh request payload
type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// RefreshToken handles the /auth/refresh endpoint
func (h *Handler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	
	// Decode request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.log.Error("Failed to decode refresh token request", "error", err)
		SendErrorResponse(w, http.StatusBadRequest, err, "Invalid request format")
		return
	}
	
	// Validate request fields
	if req.RefreshToken == "" {
		h.log.Warn("Missing refresh token in request")
		SendErrorResponse(w, http.StatusBadRequest, nil, "Refresh token is required")
		return
	}
	
	// Refresh token
	token, refreshToken, err := h.authService.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		h.log.Error("Failed to refresh token", "error", err)
		SendErrorResponse(w, http.StatusUnauthorized, err, "Invalid refresh token")
		return
	}
	
	// Calculate token expiration
	expiresAt := time.Now().Add(h.authService.Config().TokenExpiration).Unix()
	
	h.log.Info("Token refreshed successfully")
	
	// Send response
	SendJSONResponse(w, http.StatusOK, LoginResponse{
		Token:        token,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
	})
}
