package auth

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/internal/repository/mocks"
	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestService() (*Service, *mocks.MockUserRepository) {
	// Create a mock user repository
	mockRepo := mocks.NewMockUserRepository()

	// Create a test config
	config := Config{
		JWTSecret:              "test-secret",
		TokenExpiration:        time.Hour,
		RefreshTokenExpiration: time.Hour * 24,
		AdminUsername:          "admin",
		AdminPassword:          "admin",
	}

	// Create a logger
	log := logger.NewLogger()

	// Create the auth service with the mock repository
	service := NewService(config, mockRepo, log)

	return service, mockRepo
}

func TestAuthenticate(t *testing.T) {
	// Setup
	service, _ := setupTestService()
	ctx := context.Background()

	// Test cases - using the predefined users in the mock repository
	tests := []struct {
		name          string
		username      string
		password      string
		expectedError bool
	}{
		{
			name:          "Valid admin credentials",
			username:      "admin",
			password:      "admin",
			expectedError: false,
		},
		{
			name:          "Valid user credentials",
			username:      "testuser",
			password:      "password123",
			expectedError: false,
		},
		{
			name:          "Invalid username",
			username:      "nonexistent",
			password:      "password123",
			expectedError: true,
		},
		{
			name:          "Invalid password",
			username:      "admin",
			password:      "wrongpassword",
			expectedError: true,
		},
	}

	// Run tests
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			user, err := service.Authenticate(ctx, tc.username, tc.password)

			if tc.expectedError {
				assert.Error(t, err)
				assert.Nil(t, user)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, user)
				assert.Equal(t, tc.username, user.Username)
			}
		})
	}
}

func TestGenerateToken(t *testing.T) {
	// Setup
	service, _ := setupTestService()

	// Create a test user
	user := &models.User{
		ID:       uuid.New(),
		Username: "testuser",
		Role:     models.RoleReadWrite,
	}

	// Generate token
	token, err := service.GenerateToken(user)

	// Assertions
	require.NoError(t, err)
	assert.NotEmpty(t, token)
}

func TestRefreshToken(t *testing.T) {
	// Setup
	service, mockRepo := setupTestService()
	ctx := context.Background()

	// Create a test user
	user := &models.User{
		ID:           uuid.New(),
		Username:     "refreshtest",
		PasswordHash: "password-hash",
		Role:         models.RoleReadWrite,
	}

	// Add the user to the repository
	err := mockRepo.Create(ctx, user)
	require.NoError(t, err)

	// Generate a valid refresh token
	refreshToken, err := service.GenerateRefreshToken(user)
	require.NoError(t, err)
	assert.NotEmpty(t, refreshToken)

	// Test the refresh token functionality
	newToken, newRefreshToken, err := service.RefreshToken(ctx, refreshToken)

	// Assertions
	require.NoError(t, err)
	assert.NotEmpty(t, newToken)
	assert.NotEmpty(t, newRefreshToken)
	// The tokens should be different, but we don't need to check the exact value

	// We can't test the old refresh token because the real implementation validates
	// the token based on JWT claims rather than storing it in a map like our mock did
}

func TestHashPassword(t *testing.T) {
	// Setup
	service, _ := setupTestService()

	// Test password hashing
	password := "test-password"
	hash, err := service.HashPassword(password)

	// Assertions
	require.NoError(t, err)
	assert.NotEqual(t, password, hash)
	assert.True(t, service.CheckPasswordHash(password, hash))
	assert.False(t, service.CheckPasswordHash("wrong-password", hash))
}

func TestValidateToken(t *testing.T) {
	// Setup
	service, _ := setupTestService()

	// Create a test user
	user := &models.User{
		ID:       uuid.New(),
		Username: "validateuser",
		Role:     models.RoleReadWrite,
	}

	// Generate a token
	token, err := service.GenerateToken(user)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	// Validate the token
	claims, err := service.ValidateToken(token)

	// Assertions
	require.NoError(t, err)
	assert.NotNil(t, claims)
	assert.Equal(t, user.Username, claims.Username)
	assert.Equal(t, user.Role, claims.Role)
	assert.Equal(t, user.ID.String(), claims.Subject)

	// Test invalid token
	_, err = service.ValidateToken("invalid-token")
	assert.Error(t, err)
}

func TestInitialize(t *testing.T) {
	// Setup - use a fresh repository with no users
	mockRepo := mocks.NewMockUserRepository()
	config := Config{
		JWTSecret:              "test-secret",
		TokenExpiration:        time.Hour,
		RefreshTokenExpiration: time.Hour * 24,
		AdminUsername:          "admin",
		AdminPassword:          "admin",
	}
	log := logger.NewLogger()
	service := NewService(config, mockRepo, log)
	ctx := context.Background()

	// Test initialization
	err := service.Initialize(ctx)

	// Assertions
	require.NoError(t, err)

	// Verify admin user was created
	user, err := mockRepo.GetByUsername(ctx, service.config.AdminUsername)
	require.NoError(t, err)
	assert.NotNil(t, user)
	assert.Equal(t, service.config.AdminUsername, user.Username)
	assert.Equal(t, models.RoleAdmin, user.Role)

	// Verify password was hashed correctly - use bcrypt's own verification
	// since we're using real password hashing in the service
	assert.True(t, service.CheckPasswordHash(service.config.AdminPassword, user.PasswordHash))
}
