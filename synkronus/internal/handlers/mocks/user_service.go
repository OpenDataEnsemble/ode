package mocks

import (
	"context"

	"github.com/collectakit/synkronus/internal/models"
	userPkg "github.com/collectakit/synkronus/pkg/user"
	"github.com/google/uuid"
)

// MockUserService is a mock implementation of the userPkg.UserServiceInterface for testing
type MockUserService struct {
	users map[string]*models.User
}

// NewMockUserService creates a new mock user service
func NewMockUserService() *MockUserService {
	return &MockUserService{
		users: make(map[string]*models.User),
	}
}

// AddUser adds a user to the mock service
func (m *MockUserService) AddUser(user *models.User) {
	m.users[user.Username] = user
}

// CreateUser implements userPkg.UserServiceInterface
func (m *MockUserService) CreateUser(ctx context.Context, username, password string, role models.Role) (*models.User, error) {
	// Check if user already exists
	if _, exists := m.users[username]; exists {
		return nil, userPkg.ErrUserExists
	}

	// Create new user
	newUser := &models.User{
		ID:           uuid.New(),
		Username:     username,
		PasswordHash: password, // In the mock, we don't actually hash the password
		Role:         role,
	}

	// Add to users map
	m.users[username] = newUser

	return newUser, nil
}

// DeleteUser implements userPkg.UserServiceInterface
func (m *MockUserService) DeleteUser(ctx context.Context, username string) error {
	// Check if user exists
	if _, exists := m.users[username]; !exists {
		return userPkg.ErrUserNotFound
	}

	// Delete user
	delete(m.users, username)

	return nil
}

// ResetPassword implements userPkg.UserServiceInterface
func (m *MockUserService) ResetPassword(ctx context.Context, username, newPassword string) error {
	// Check if user exists
	userRecord, exists := m.users[username]
	if !exists {
		return userPkg.ErrUserNotFound
	}

	// Update password
	userRecord.PasswordHash = newPassword // In the mock, we don't actually hash the password

	return nil
}

// ChangePassword implements userPkg.UserServiceInterface
func (m *MockUserService) ChangePassword(ctx context.Context, username, currentPassword, newPassword string) error {
	// Check if user exists
	userRecord, exists := m.users[username]
	if !exists {
		return userPkg.ErrUserNotFound
	}

	// Check current password
	if userRecord.PasswordHash != currentPassword { // In the mock, we don't actually hash the password
		return userPkg.ErrInvalidPassword
	}

	// Update password
	userRecord.PasswordHash = newPassword // In the mock, we don't actually hash the password

	return nil
}

// ListUsers implements userPkg.UserServiceInterface
func (m *MockUserService) ListUsers(ctx context.Context) ([]models.User, error) {
	var users []models.User
	for _, user := range m.users {
		users = append(users, *user)
	}
	return users, nil
}
