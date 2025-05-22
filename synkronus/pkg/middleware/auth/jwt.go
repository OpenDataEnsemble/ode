package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/pkg/auth"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

// ContextKey is a type for context keys
type ContextKey string

const (
	// UserKey is the context key for the user
	UserKey ContextKey = "user"
	// ClaimsKey is the context key for the JWT claims
	ClaimsKey ContextKey = "claims"
)

// JWTMiddleware creates a middleware that validates JWT tokens
func JWTMiddleware(authService auth.AuthServiceInterface, log *logger.Logger) func(http.Handler) http.Handler {
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

			// Add claims to context
			ctx := context.WithValue(r.Context(), ClaimsKey, claims)

			// Create a user from claims
			user := &models.User{
				Username: claims.Username,
				Role:     claims.Role,
			}

			// Add user to context
			ctx = context.WithValue(ctx, UserKey, user)

			// Call the next handler with the updated context
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole creates a middleware that requires a specific role
func RequireRole(roles ...models.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get user from context
			user, ok := r.Context().Value(UserKey).(*models.User)
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// User found, now check if they have the required role

			// Check if user has one of the required roles
			hasRole := false
			for _, role := range roles {
				if user.Role == role {
					hasRole = true
					break
				}
			}

			if !hasRole {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			// Call the next handler
			next.ServeHTTP(w, r)
		})
	}
}

// GetUserFromContext gets the user from the request context
func GetUserFromContext(ctx context.Context) *models.User {
	user, _ := ctx.Value(UserKey).(*models.User)
	return user
}

// GetClaimsFromContext gets the JWT claims from the request context
func GetClaimsFromContext(ctx context.Context) *auth.AuthClaims {
	claims, _ := ctx.Value(ClaimsKey).(*auth.AuthClaims)
	return claims
}
