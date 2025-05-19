package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/collectakit/synkronus/internal/handlers/mocks"
	"github.com/collectakit/synkronus/internal/models"
	"github.com/collectakit/synkronus/pkg/logger"
	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
)

// userHandlerTestHelper returns a Handler and its MockUserService for user handler tests
func userHandlerTestHelper() (*Handler, *mocks.MockUserService) {
	log := logger.NewLogger()
	mockUserService := mocks.NewMockUserService()
	return NewHandler(log, nil, nil, nil, mockUserService), mockUserService
}

func TestCreateUserHandler(t *testing.T) {
	h, mockUserService := userHandlerTestHelper()

	t.Run("success", func(t *testing.T) {
		// Ensure the user does not exist (no setup needed)
		payload := map[string]interface{}{"username": "testuser", "password": "password", "role": "read-only"}
		body, _ := json.Marshal(payload)
		r := httptest.NewRequest(http.MethodPost, "/users/create", bytes.NewReader(body))
		w := httptest.NewRecorder()
		h.CreateUserHandler(w, r)
		resp := w.Result()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("user exists", func(t *testing.T) {
		// Pre-populate the user to simulate existing user
		existingUser := &models.User{Username: "testuser", PasswordHash: "password", Role: models.RoleReadOnly}
		mockUserService.AddUser(existingUser)
		payload := map[string]interface{}{"username": "testuser", "password": "password", "role": "read-only"}
		body, _ := json.Marshal(payload)
		r := httptest.NewRequest(http.MethodPost, "/users/create", bytes.NewReader(body))
		w := httptest.NewRecorder()
		h.CreateUserHandler(w, r)
		resp := w.Result()
		assert.Equal(t, http.StatusConflict, resp.StatusCode)
	})
}

func TestDeleteUserHandler(t *testing.T) {
	h, mockUserService := userHandlerTestHelper()

	existingUser := &models.User{Username: "deleteuser", PasswordHash: "pw", Role: models.RoleReadOnly}
	mockUserService.AddUser(existingUser)

	tests := []struct {
		name           string
		username       string
		setup          func()
		expectedStatus int
	}{
		{
			name:           "success",
			username:       "deleteuser",
			setup:          func() { mockUserService.AddUser(existingUser) },
			expectedStatus: http.StatusOK,
		},
		{
			name:           "user not found",
			username:       "nonexistent",
			setup:          func() {},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "missing username",
			username:       "",
			setup:          func() {},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tc.setup()
			r := httptest.NewRequest(http.MethodDelete, "/users/delete/"+tc.username, nil)
			ctx := chi.NewRouteContext()
			if tc.username != "" {
				ctx.URLParams.Add("username", tc.username)
			}
			r = r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, ctx))
			w := httptest.NewRecorder()
			h.DeleteUserHandler(w, r)
			resp := w.Result()
			assert.Equal(t, tc.expectedStatus, resp.StatusCode)
		})
	}
}

func TestResetPasswordHandler(t *testing.T) {
	h, mockUserService := userHandlerTestHelper()
	mockUserService.AddUser(&models.User{Username: "resetuser", PasswordHash: "pw", Role: models.RoleReadOnly})

	tests := []struct {
		name           string
		payload        map[string]interface{}
		expectedStatus int
	}{
		{
			name:           "success",
			payload:        map[string]interface{}{"username": "resetuser", "newPassword": "newpw"},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "user not found",
			payload:        map[string]interface{}{"username": "nouser", "newPassword": "pw"},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "missing fields",
			payload:        map[string]interface{}{"username": ""},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.payload)
			r := httptest.NewRequest(http.MethodPost, "/users/reset-password", bytes.NewReader(body))
			w := httptest.NewRecorder()
			h.ResetPasswordHandler(w, r)
			resp := w.Result()
			assert.Equal(t, tc.expectedStatus, resp.StatusCode)
		})
	}
}

func TestChangePasswordHandler(t *testing.T) {
	h, mockUserService := userHandlerTestHelper()
	mockUserService.AddUser(&models.User{Username: "changepw", PasswordHash: "oldpw", Role: models.RoleReadOnly})

	tests := []struct {
		name           string
		username       string
		payload        map[string]interface{}
		expectedStatus int
	}{
		{
			name:           "success",
			username:       "changepw",
			payload:        map[string]interface{}{"currentPassword": "oldpw", "newPassword": "newpw"},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "wrong current password",
			username:       "changepw",
			payload:        map[string]interface{}{"currentPassword": "wrongpw", "newPassword": "newpw"},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "missing fields",
			username:       "changepw",
			payload:        map[string]interface{}{},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "unauthorized (no username in context)",
			username:       "",
			payload:        map[string]interface{}{"currentPassword": "oldpw", "newPassword": "newpw"},
			expectedStatus: http.StatusUnauthorized,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.payload)
			r := httptest.NewRequest(http.MethodPost, "/users/change-password", bytes.NewReader(body))
			ctx := r.Context()
			if tc.username != "" {
				ctx = context.WithValue(ctx, "username", tc.username)
			}
			r = r.WithContext(ctx)
			w := httptest.NewRecorder()
			h.ChangePasswordHandler(w, r)
			resp := w.Result()
			assert.Equal(t, tc.expectedStatus, resp.StatusCode)
		})
	}
}
