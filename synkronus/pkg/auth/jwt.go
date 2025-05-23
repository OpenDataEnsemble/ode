package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	// ErrInvalidToken is returned when the token is invalid
	ErrInvalidToken = errors.New("invalid token")

	// ErrExpiredToken is returned when the token has expired
	ErrExpiredToken = errors.New("token has expired")

	// ErrInsufficientPermissions is returned when the token doesn't have required permissions
	ErrInsufficientPermissions = errors.New("insufficient permissions")
)

// Role represents a user role
type Role string

const (
	// ReadOnly role can only read data
	ReadOnly Role = "read-only"

	// ReadWrite role can read and write data
	ReadWrite Role = "read-write"

	// Admin role has full access
	Admin Role = "admin"
)

// Claims represents JWT claims
type Claims struct {
	Username string `json:"username"`
	Role     Role   `json:"role"`
	jwt.RegisteredClaims
}

// TokenService handles JWT token operations
type TokenService struct {
	secretKey     []byte
	tokenDuration time.Duration
	issuer        string
}

// NewTokenService creates a new TokenService
func NewTokenService(secretKey []byte, duration time.Duration) *TokenService {
	return &TokenService{
		secretKey:     secretKey,
		tokenDuration: duration,
		issuer:        "synkronus",
	}
}

// GenerateToken generates a new JWT token
func (s *TokenService) GenerateToken(userID string, username string, role Role, duration time.Duration) (string, error) {
	now := time.Now()

	claims := Claims{
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    s.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return token.SignedString(s.secretKey)
}

// ValidateToken validates a JWT token and returns the claims
func (s *TokenService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.secretKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// HasRole checks if the claims have at least the specified role
func (claims *Claims) HasRole(requiredRole Role) bool {
	// ReadWrite users can do everything ReadOnly users can
	if claims.Role == ReadWrite {
		return true
	}

	// ReadOnly users can only do ReadOnly operations
	if claims.Role == ReadOnly && requiredRole == ReadOnly {
		return true
	}

	return false
}
