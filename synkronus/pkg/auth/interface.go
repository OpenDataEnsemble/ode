package auth

import (
	"context"

	"github.com/collectakit/synkronus/internal/models"
)

// AuthServiceInterface defines the interface for authentication services
type AuthServiceInterface interface {
	// Config returns the service configuration
	Config() Config

	// Authenticate authenticates a user with the given username and password
	Authenticate(ctx context.Context, username, password string) (*models.User, error)

	// GenerateToken generates a JWT token for the given user
	GenerateToken(user *models.User) (string, error)

	// GenerateRefreshToken generates a refresh token for the given user
	GenerateRefreshToken(user *models.User) (string, error)

	// RefreshToken refreshes a token using the given refresh token
	RefreshToken(ctx context.Context, refreshToken string) (string, string, error)

	// ValidateToken validates a JWT token and returns the claims
	ValidateToken(tokenString string) (*AuthClaims, error)

	// Initialize initializes the authentication service
	Initialize(ctx context.Context) error

	// HashPassword hashes a password using bcrypt
	HashPassword(password string) (string, error)

	// CheckPasswordHash compares a password with a hash
	CheckPasswordHash(password, hash string) bool

	// VerifyPassword checks if a password matches a hash
	VerifyPassword(password, hash string) bool
}
