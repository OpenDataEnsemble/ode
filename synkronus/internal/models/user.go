package models

import (
	"time"

	"github.com/google/uuid"
)

// Role represents a user role in the system
type Role string

const (
	// RoleReadOnly provides read-only access to the API
	RoleReadOnly Role = "read-only"
	// RoleReadWrite provides read and write access to the API
	RoleReadWrite Role = "read-write"
	// RoleAdmin provides administrative access to the API
	RoleAdmin Role = "admin"
)

// User represents a user in the system
type User struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Username     string    `json:"username" db:"username"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Role         Role      `json:"role" db:"role"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

// NewUser creates a new user with the given parameters
func NewUser(id uuid.UUID, username, passwordHash string, role Role) *User {
	now := time.Now()
	return &User{
		ID:           id,
		Username:     username,
		PasswordHash: passwordHash,
		Role:         role,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}
