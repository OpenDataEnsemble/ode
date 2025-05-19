package user

import (
	"context"
	"errors"

	"github.com/collectakit/synkronus/internal/models"
)

// Common errors for user service
var (
	ErrUserNotFound    = errors.New("user not found")
	ErrUserExists      = errors.New("user already exists")
	ErrInvalidPassword = errors.New("invalid password")
	ErrInvalidRole     = errors.New("invalid role")
)

// UserServiceInterface defines the interface for user management operations
type UserServiceInterface interface {
	// CreateUser creates a new user with the specified username, password, and role
	// Returns the created user or an error
	CreateUser(ctx context.Context, username, password string, role models.Role) (*models.User, error)

	// DeleteUser deletes a user by username
	// Returns an error if the user doesn't exist
	DeleteUser(ctx context.Context, username string) error

	// ResetPassword resets a user's password (admin operation)
	// Returns an error if the user doesn't exist
	ResetPassword(ctx context.Context, username, newPassword string) error

	// ChangePassword changes a user's password after verifying the current password
	// Returns an error if the user doesn't exist or the current password is incorrect
	ChangePassword(ctx context.Context, username, currentPassword, newPassword string) error

	// ListUsers lists all users in the system (admin operation)
	ListUsers(ctx context.Context) ([]models.User, error)
}
