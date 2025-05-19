package mocks

import (
	"context"
	"errors"
	"time"

	"github.com/collectakit/synkronus/internal/models"
	"github.com/collectakit/synkronus/internal/repository"
	"github.com/collectakit/synkronus/internal/repository/mocks"
	"github.com/collectakit/synkronus/pkg/auth"
	"github.com/collectakit/synkronus/pkg/logger"
	"github.com/google/uuid"
)

// MockAuthService is a mock implementation of the auth.ServiceInterface for testing
type MockAuthService struct {
	// Mock data for testing
	userRepository     repository.UserRepositoryInterface
	validRefreshTokens map[string]string // map[refreshToken]username
	config             auth.Config
	log                *logger.Logger
}

// NewMockAuthService creates a new mock auth service
func NewMockAuthService(mockUserRepo ...repository.UserRepositoryInterface) *MockAuthService {
	// Create a default config
	config := auth.Config{
		JWTSecret:              "mock-jwt-secret",
		TokenExpiration:        time.Hour,
		RefreshTokenExpiration: time.Hour * 24,
		AdminUsername:          "admin",
		AdminPassword:          "admin",
	}

	// Create the mock service
	mock := &MockAuthService{
		validRefreshTokens: make(map[string]string),
		config:             config,
		log:                logger.NewLogger(),
	}

	// Set the user repository
	if len(mockUserRepo) > 0 {
		mock.userRepository = mockUserRepo[0]
	} else {
		// Create a default mock user repository if none provided
		mock.userRepository = mocks.NewMockUserRepository()
	}

	// Add a test admin user
	mock.AddUser(&models.User{
		ID:           uuid.New(),
		Username:     "admin",
		PasswordHash: "admin-hash", // Not a real hash, just for testing
		Role:         models.RoleAdmin,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	})

	// Add a test regular user with read-write permissions
	mock.AddUser(&models.User{
		ID:           uuid.New(),
		Username:     "testuser",
		PasswordHash: "password123-hash", // Not a real hash, just for testing
		Role:         models.RoleReadWrite,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	})

	// Add a test read-only user
	mock.AddUser(&models.User{
		ID:           uuid.New(),
		Username:     "readonly",
		PasswordHash: "readonly-hash", // Not a real hash, just for testing
		Role:         models.RoleReadOnly,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	})

	// Add a valid refresh token for the test user
	mock.validRefreshTokens["valid-refresh-token"] = "testuser"

	return mock
}

// AddUser adds a user to the mock service
func (m *MockAuthService) AddUser(user *models.User) {
	// Use the repository to create the user
	m.userRepository.Create(context.Background(), user)
}

// GetTestUser returns a test user by username
func (m *MockAuthService) GetTestUser(username string) models.User {
	user, _ := m.userRepository.GetByUsername(context.Background(), username)
	if user != nil {
		return *user
	}

	// Return a default user if not found
	return models.User{
		ID:        uuid.New(),
		Username:  username,
		Role:      models.RoleReadWrite,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// Config returns the service configuration
func (m *MockAuthService) Config() auth.Config {
	return m.config
}

// Authenticate mocks the authentication process
func (m *MockAuthService) Authenticate(ctx context.Context, username, password string) (*models.User, error) {
	// Get the user from the repository
	user, err := m.userRepository.GetByUsername(ctx, username)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// For testing purposes, we'll accept the test credentials directly
	if username == "testuser" && password == "password123" {
		return user, nil
	}

	// For admin user
	if username == "admin" && password == "admin" {
		return user, nil
	}

	// If not a special test case, return invalid credentials
	return nil, errors.New("invalid credentials")
}

// GenerateToken mocks token generation
func (m *MockAuthService) GenerateToken(user *models.User) (string, error) {
	// For testing, just return a predictable token
	return "mock-jwt-token-for-" + user.Username, nil
}

// GenerateRefreshToken mocks refresh token generation
func (m *MockAuthService) GenerateRefreshToken(user *models.User) (string, error) {
	// For testing, just return a predictable refresh token
	refreshToken := "mock-refresh-token-for-" + user.Username

	// Store it in our valid tokens map
	m.validRefreshTokens[refreshToken] = user.Username

	return refreshToken, nil
}

// RefreshToken mocks the token refresh process
func (m *MockAuthService) RefreshToken(ctx context.Context, refreshToken string) (string, string, error) {
	// Check if the refresh token is valid
	username, valid := m.validRefreshTokens[refreshToken]
	if !valid {
		return "", "", errors.New("invalid refresh token")
	}

	// Get the user from the repository
	user, err := m.userRepository.GetByUsername(ctx, username)
	if err != nil {
		return "", "", err
	}
	if user == nil {
		return "", "", errors.New("user not found")
	}

	// Generate new tokens
	token, err := m.GenerateToken(user)
	if err != nil {
		return "", "", err
	}

	newRefreshToken, err := m.GenerateRefreshToken(user)
	if err != nil {
		return "", "", err
	}

	// Invalidate the old refresh token
	delete(m.validRefreshTokens, refreshToken)

	return token, newRefreshToken, nil
}

// Initialize mocks the initialization process
func (m *MockAuthService) Initialize(ctx context.Context) error {
	// Nothing to do for the mock
	return nil
}

// HashPassword mocks password hashing
func (m *MockAuthService) HashPassword(password string) (string, error) {
	// For testing, just append "-hash" to the password
	return password + "-hash", nil
}

// CheckPasswordHash mocks password verification
func (m *MockAuthService) CheckPasswordHash(password, hash string) bool {
	// For testing, just check if hash equals password + "-hash"
	return hash == password+"-hash"
}

// ValidateToken mocks token validation
func (m *MockAuthService) ValidateToken(tokenString string) (*auth.AuthClaims, error) {
	// For testing, we'll accept tokens that match a specific pattern
	if tokenString == "invalid-token" {
		return nil, errors.New("invalid token")
	}

	// Handle expired tokens
	if tokenString == "expired-token" {
		return nil, errors.New("token is expired")
	}

	// Extract username from token (assuming token format is "mock-jwt-token-for-{username}")
	username := ""
	if len(tokenString) > 18 && tokenString[:18] == "mock-jwt-token-for-" {
		username = tokenString[18:]
	} else if tokenString == "readOnlyToken" {
		// Special case for read-only user testing
		username = "readonly"
	} else if tokenString == "adminToken" {
		// Special case for admin user testing
		username = "admin"
	} else {
		// For testing, accept any non-empty token that doesn't match the invalid pattern
		username = "testuser"
	}

	// Get the user from the repository
	user, err := m.userRepository.GetByUsername(context.Background(), username)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	// Create claims
	claims := &auth.AuthClaims{
		Username: user.Username,
		Role:     user.Role,
	}

	return claims, nil
}

// VerifyPassword mocks password verification
func (m *MockAuthService) VerifyPassword(password, hash string) bool {
	return hash == password+"-hash"
}
