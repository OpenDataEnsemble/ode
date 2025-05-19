package user

import (
	"context"
	"fmt"

	"github.com/collectakit/synkronus/internal/models"
	"github.com/collectakit/synkronus/internal/repository"
	"github.com/collectakit/synkronus/pkg/auth"
	"github.com/collectakit/synkronus/pkg/logger"
	"github.com/google/uuid"
)

// Service implements the UserServiceInterface
type Service struct {
	userRepo    repository.UserRepositoryInterface
	authService auth.AuthServiceInterface
	log         *logger.Logger
}

// NewService creates a new user service
func NewService(userRepo repository.UserRepositoryInterface, authService auth.AuthServiceInterface, log *logger.Logger) *Service {
	return &Service{
		userRepo:    userRepo,
		authService: authService,
		log:         log,
	}
}

// CreateUser creates a new user with the specified username, password, and role
func (s *Service) CreateUser(ctx context.Context, username, password string, role models.Role) (*models.User, error) {
	// Check if role is valid
	if role != models.RoleReadOnly && role != models.RoleReadWrite && role != models.RoleAdmin {
		return nil, ErrInvalidRole
	}

	// Check if user already exists
	existingUser, err := s.userRepo.GetByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("failed to check for existing user: %w", err)
	}

	if existingUser != nil {
		return nil, ErrUserExists
	}

	// Hash the password
	hashedPassword, err := s.authService.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create the user
	user := models.NewUser(
		uuid.New(),
		username,
		hashedPassword,
		role,
	)

	// Save the user to the database
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	s.log.Info("User created successfully", "username", username, "role", role)
	return user, nil
}

// DeleteUser deletes a user by username
func (s *Service) DeleteUser(ctx context.Context, username string) error {
	// Get the user
	user, err := s.userRepo.GetByUsername(ctx, username)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	if user == nil {
		return ErrUserNotFound
	}

	// Delete the user
	if err := s.userRepo.Delete(ctx, user.ID); err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	s.log.Info("User deleted successfully", "username", username)
	return nil
}

// ResetPassword resets a user's password (admin operation)
func (s *Service) ResetPassword(ctx context.Context, username, newPassword string) error {
	// Get the user
	user, err := s.userRepo.GetByUsername(ctx, username)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	if user == nil {
		return ErrUserNotFound
	}

	// Hash the new password
	hashedPassword, err := s.authService.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update the user's password
	user.PasswordHash = hashedPassword
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	s.log.Info("User password reset successfully", "username", username)
	return nil
}

// ChangePassword changes a user's password after verifying the current password
func (s *Service) ChangePassword(ctx context.Context, username, currentPassword, newPassword string) error {
	// Get the user
	user, err := s.userRepo.GetByUsername(ctx, username)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	if user == nil {
		return ErrUserNotFound
	}

	// Verify the current password
	if !s.authService.VerifyPassword(currentPassword, user.PasswordHash) {
		return ErrInvalidPassword
	}

	// Hash the new password
	hashedPassword, err := s.authService.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update the user's password
	user.PasswordHash = hashedPassword
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	s.log.Info("User password changed successfully", "username", username)
	return nil
}

// ListUsers lists all users in the system (admin operation)
func (s *Service) ListUsers(ctx context.Context) ([]models.User, error) {
	userList, err := s.userRepo.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	return userList, nil
}
