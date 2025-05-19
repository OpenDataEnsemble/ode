package repository

import (
	"context"

	"github.com/collectakit/synkronus/internal/models"
	"github.com/google/uuid"
)

// UserRepositoryInterface defines the interface for user repository operations
type UserRepositoryInterface interface {
	// GetByUsername retrieves a user by username
	GetByUsername(ctx context.Context, username string) (*models.User, error)

	// Create creates a new user
	Create(ctx context.Context, user *models.User) error

	// Update updates an existing user
	Update(ctx context.Context, user *models.User) error

	// Delete deletes a user
	Delete(ctx context.Context, id uuid.UUID) error

	// CreateAdminUserIfNotExists creates an admin user if no users exist
	CreateAdminUserIfNotExists(ctx context.Context, username, passwordHash string) error

	// List lists all users
	List(ctx context.Context) ([]models.User, error)
}
