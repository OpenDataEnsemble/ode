package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/pkg/database"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

// UserRepository handles database operations for users
// It implements the UserRepositoryInterface
type UserRepository struct {
	db  *database.Database
	log *logger.Logger
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *database.Database, log *logger.Logger) *UserRepository {
	return &UserRepository{
		db:  db,
		log: log,
	}
}

// GetByUsername retrieves a user by username
func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	query := `
		SELECT id, username, password_hash, role, created_at, updated_at
		FROM users
		WHERE username = $1
	`

	var user models.User
	err := r.db.DB().QueryRowContext(ctx, query, username).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // User not found
		}
		return nil, fmt.Errorf("failed to get user by username: %w", err)
	}

	return &user, nil
}

// List lists all users in the system (admin operation)
func (r *UserRepository) List(ctx context.Context) ([]models.User, error) {
	query := `
		SELECT id, username, password_hash, role, created_at, updated_at
		FROM users
	`
	rows, err := r.db.DB().QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()
	var users []models.User
	for rows.Next() {
		var user models.User
		if err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.PasswordHash,
			&user.Role,
			&user.CreatedAt,
			&user.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}
	return users, nil
}

// Create creates a new user
func (r *UserRepository) Create(ctx context.Context, user *models.User) error {
	// Check if UUID is zero value and generate a new one if needed
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}

	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now

	query := `
		INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err := r.db.DB().ExecContext(ctx, query,
		user.ID,
		user.Username,
		user.PasswordHash,
		user.Role,
		user.CreatedAt,
		user.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	return nil
}

// Update updates an existing user
func (r *UserRepository) Update(ctx context.Context, user *models.User) error {
	user.UpdatedAt = time.Now()

	query := `
		UPDATE users
		SET username = $1, password_hash = $2, role = $3, updated_at = $4
		WHERE id = $5
	`

	_, err := r.db.DB().ExecContext(ctx, query,
		user.Username,
		user.PasswordHash,
		user.Role,
		user.UpdatedAt,
		user.ID,
	)

	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// Delete deletes a user by ID
func (r *UserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM users WHERE id = $1`

	_, err := r.db.DB().ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

// CreateAdminUserIfNotExists creates an admin user if no users exist
func (r *UserRepository) CreateAdminUserIfNotExists(ctx context.Context, username, passwordHash string) error {
	// Check if any users exist
	var count int
	err := r.db.DB().QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to count users: %w", err)
	}

	// If no users exist, create admin user
	if count == 0 {
		r.log.Info("No users found, creating admin user")

		user := models.NewUser(
			uuid.New(),
			username,
			passwordHash,
			models.RoleAdmin,
		)

		if err := r.Create(ctx, user); err != nil {
			return fmt.Errorf("failed to create admin user: %w", err)
		}

		r.log.Info("Admin user created successfully", "username", username)
	}

	return nil
}
