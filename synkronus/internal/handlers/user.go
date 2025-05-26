package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/pkg/user"
)

// UserCreateRequest represents the request body for creating a user
type UserCreateRequest struct {
	Username string      `json:"username"`
	Password string      `json:"password"`
	Role     models.Role `json:"role"`
}

// UserResponse represents the response body for a user
// (Stub - expand as needed for your schema)
type UserResponse struct {
	Username string      `json:"username"`
	Role     models.Role `json:"role"`
}

// CreateUserHandler handles POST /users/create (admin only)
func (h *Handler) CreateUserHandler(w http.ResponseWriter, r *http.Request) {
	var req UserCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendErrorResponse(w, http.StatusBadRequest, err, "Invalid request body")
		return
	}
	if req.Username == "" || req.Password == "" || req.Role == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "Missing required fields")
		return
	}
	newUser, err := h.userService.CreateUser(r.Context(), req.Username, req.Password, req.Role)
	if err != nil {
		if err == user.ErrUserExists {
			SendErrorResponse(w, http.StatusConflict, err, "Username already exists")
			return
		}
		SendErrorResponse(w, http.StatusBadRequest, err, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(UserResponse{Username: newUser.Username, Role: newUser.Role}); err != nil {
		h.log.Error("Failed to encode user response", "error", err)
	}
}

// DeleteUserHandler handles DELETE /users/delete/{username} (admin only)
func (h *Handler) DeleteUserHandler(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	if username == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "Username is required")
		return
	}
	err := h.userService.DeleteUser(r.Context(), username)
	if err != nil {
		if err == user.ErrUserNotFound {
			SendErrorResponse(w, http.StatusNotFound, err, "User not found")
			return
		}
		SendErrorResponse(w, http.StatusBadRequest, err, err.Error())
		return
	}
	if err := json.NewEncoder(w).Encode(map[string]string{"message": "User deleted successfully"}); err != nil {
		h.log.Error("Failed to encode delete response", "error", err)
	}
}

// ResetPasswordRequest represents the request body for resetting a password
type ResetPasswordRequest struct {
	Username    string `json:"username"`
	NewPassword string `json:"newPassword"`
}

// ResetPasswordHandler handles POST /users/reset-password (admin only)
func (h *Handler) ResetPasswordHandler(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendErrorResponse(w, http.StatusBadRequest, err, "Invalid request body")
		return
	}
	if req.Username == "" || req.NewPassword == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "Missing required fields")
		return
	}
	err := h.userService.ResetPassword(r.Context(), req.Username, req.NewPassword)
	if err != nil {
		if err == user.ErrUserNotFound {
			SendErrorResponse(w, http.StatusNotFound, err, "User not found")
			return
		}
		SendErrorResponse(w, http.StatusBadRequest, err, err.Error())
		return
	}
	if err := json.NewEncoder(w).Encode(map[string]string{"message": "Password reset successfully"}); err != nil {
		h.log.Error("Failed to encode reset password response", "error", err)
	}
}

// ListUsersHandler handles GET /users/list (admin only)
func (h *Handler) ListUsersHandler(w http.ResponseWriter, r *http.Request) {
	userList, err := h.userService.ListUsers(r.Context())
	if err != nil {
		SendErrorResponse(w, http.StatusBadRequest, err, err.Error())
		return
	}
	if err := json.NewEncoder(w).Encode(userList); err != nil {
		h.log.Error("Failed to encode user list response", "error", err)
	}
}

// ChangePasswordRequest represents the request body for changing password
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// ChangePasswordHandler handles POST /users/change-password (authenticated user)
func (h *Handler) ChangePasswordHandler(w http.ResponseWriter, r *http.Request) {
	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		SendErrorResponse(w, http.StatusBadRequest, err, "Invalid request body")
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		SendErrorResponse(w, http.StatusBadRequest, nil, "Missing required fields")
		return
	}
	// Get username from context (set by auth middleware)
	username, ok := r.Context().Value("username").(string)
	if !ok || username == "" {
		SendErrorResponse(w, http.StatusUnauthorized, nil, "Unauthorized")
		return
	}
	err := h.userService.ChangePassword(r.Context(), username, req.CurrentPassword, req.NewPassword)
	if err != nil {
		SendErrorResponse(w, http.StatusUnauthorized, err, err.Error())
		return
	}
	if err := json.NewEncoder(w).Encode(map[string]string{"message": "Password changed successfully"}); err != nil {
		h.log.Error("Failed to encode change password response", "error", err)
	}
}
