package middleware

import (
	"net/http"
	"strings"

	"github.com/collectakit/synkronus/pkg/auth"
)

// JWTAuth middleware authenticates requests using JWT tokens
func JWTAuth(tokenService *auth.TokenService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract token from Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
				return
			}

			// Check Bearer prefix
			if !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, "Invalid Authorization header format", http.StatusUnauthorized)
				return
			}

			// Extract token
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == "" {
				http.Error(w, "Missing token", http.StatusUnauthorized)
				return
			}

			// Validate token
			claims, err := tokenService.ValidateToken(tokenString)
			if err != nil {
				if err == auth.ErrExpiredToken {
					http.Error(w, "Token has expired", http.StatusUnauthorized)
				} else {
					http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
				}
				return
			}

			// Store claims in request context
			ctx := auth.WithClaims(r.Context(), claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole middleware checks if the user has the required role
func RequireRole(requiredRole auth.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get claims from context
			claims, err := auth.ClaimsFromContext(r.Context())
			if err != nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Check if user has required role
			if !claims.HasRole(requiredRole) {
				http.Error(w, "Insufficient permissions", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// ApiVersionCheck middleware handles API versioning via x-api-version header
func APIVersionCheck(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get API version from header
		apiVersion := r.Header.Get("x-api-version")
		if apiVersion != "" {
			// Store API version in request context
			ctx := r.Context()
			// TODO: Implement version compatibility check
			// For now, just pass through
			r = r.WithContext(ctx)
		}
		
		next.ServeHTTP(w, r)
	})
}
