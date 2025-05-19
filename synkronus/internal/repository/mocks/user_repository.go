package mocks

import (
	"context"
	"errors"
	"time"

	"github.com/collectakit/synkronus/internal/models"
	"github.com/collectakit/synkronus/pkg/logger"
	"github.com/google/uuid"
)

// MockUserRepository is a mock implementation of the repository.UserRepositoryInterface for testing
type MockUserRepository struct {
	users map[string]*models.User // Map of username to user
	log   *logger.Logger
}

// NewMockUserRepository creates a new mock user repository
func NewMockUserRepository() *MockUserRepository {
	mock := &MockUserRepository{
		users: make(map[string]*models.User),
		log:   logger.NewLogger(),
	}

	// Add a test admin user with real bcrypt hash
	adminUser := &models.User{
		ID:           uuid.New(),
		Username:     "admin",
		PasswordHash: "$2a$10$rFxBB9hZVG4Ue1ld9lXLvemhzTnLuv4n/VF81kkQKu0BjD2/9x6Sm", // Real bcrypt hash for "admin"
		Role:         models.RoleAdmin,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	mock.users[adminUser.Username] = adminUser

	// Add a test regular user with real bcrypt hash
	regularUser := &models.User{
		ID:           uuid.New(),
		Username:     "testuser",
		PasswordHash: "$2a$10$1dEUGtlCyqrVgfRKnQmaU.PYuMBKh.NynRzXGn/W9HdeJGp5Zxp3.", // Real bcrypt hash for "password123"
		Role:         models.RoleReadWrite,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	mock.users[regularUser.Username] = regularUser

	return mock
}

// GetByUsername retrieves a user by username
func (m *MockUserRepository) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	user, exists := m.users[username]
	if !exists {
		return nil, nil // User not found, matching real implementation behavior
	}
	return user, nil
}

// Create creates a new user
func (m *MockUserRepository) Create(ctx context.Context, user *models.User) error {
	// Check if user already exists
	if _, exists := m.users[user.Username]; exists {
		return errors.New("user already exists")
	}

	// Set ID if not provided
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}

	// Set timestamps
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now

	// Store the user
	m.users[user.Username] = user
	return nil
}

// Update updates an existing user
func (m *MockUserRepository) Update(ctx context.Context, user *models.User) error {
	// Check if user exists
	if _, exists := m.users[user.Username]; !exists {
		return errors.New("user not found")
	}

	// Update timestamp
	user.UpdatedAt = time.Now()

	// Update the user
	m.users[user.Username] = user
	return nil
}

// Delete deletes a user by ID
func (m *MockUserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	// Find user by ID
	var username string
	for uname, user := range m.users {
		if user.ID == id {
			username = uname
			break
		}
	}

	// Check if user was found
	if username == "" {
		return errors.New("user not found")
	}

	// Delete the user
	delete(m.users, username)
	return nil
}

// CreateAdminUserIfNotExists creates an admin user if no users exist
func (m *MockUserRepository) CreateAdminUserIfNotExists(ctx context.Context, username, passwordHash string) error {
	// Check if any users exist
	if len(m.users) > 0 {
		return nil // Users already exist, no need to create admin
	}

	// Create admin user
	adminUser := models.NewUser(
		uuid.New(),
		username,
		passwordHash,
		models.RoleAdmin,
	)

	return m.Create(ctx, adminUser)
}

// Count returns the number of users
func (m *MockUserRepository) Count(ctx context.Context) (int, error) {
	return len(m.users), nil
}

// List lists all users in the system (admin operation)
func (m *MockUserRepository) List(ctx context.Context) ([]models.User, error) {
	var users []models.User
	for _, user := range m.users {
		users = append(users, *user)
	}
	return users, nil
}
