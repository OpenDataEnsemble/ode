package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/collectakit/synkronus/internal/models"
	"github.com/collectakit/synkronus/pkg/auth"
	"github.com/collectakit/synkronus/pkg/logger"
)

// AuthMiddleware creates a middleware that validates JWT tokens using the auth service interface
func AuthMiddleware(authService auth.AuthServiceInterface, log *logger.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				log.Warn("Missing Authorization header")
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Check if the header has the Bearer prefix
			if !strings.HasPrefix(authHeader, "Bearer ") {
				log.Warn("Invalid Authorization header format")
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Extract the token
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")

			// Validate the token
			claims, err := authService.ValidateToken(tokenString)
			if err != nil {
				log.Warn("Invalid token", "error", err)
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Create a user from claims
			user := &models.User{
				Username: claims.Username,
				Role:     getModelRole(string(claims.Role)), // Convert auth.Role to models.Role
			}

			// Add user to context
			ctx := context.WithValue(r.Context(), UserKey, user)

			// Call the next handler with the updated context
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// Note: RequireRole function is defined in jwt.go

// getModelRole converts a role string to models.Role
func getModelRole(role string) models.Role {
	switch role {
	case "admin":
		return models.RoleAdmin
	case "read-write":
		return models.RoleReadWrite
	case "read-only":
		return models.RoleReadOnly
	default:
		return models.RoleReadOnly // Default to read-only for safety
	}
}
