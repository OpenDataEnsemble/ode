package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/internal/repository"
	"github.com/opendataensemble/synkronus/pkg/logger"
	"golang.org/x/crypto/bcrypt"
)

// Config contains authentication configuration
type Config struct {
	// JWTSecret is the secret key used to sign JWT tokens
	JWTSecret string
	// TokenExpiration is the duration for which a token is valid
	TokenExpiration time.Duration
	// RefreshTokenExpiration is the duration for which a refresh token is valid
	RefreshTokenExpiration time.Duration
	// AdminUsername is the default admin username
	AdminUsername string
	// AdminPassword is the default admin password
	AdminPassword string
	// ForceCreateAdminUser creates or updates an admin user on startup when explicitly configured.
	ForceCreateAdminUser string
	// ForceCreateAdminPassword is the plaintext password used for ForceCreateAdminUser.
	ForceCreateAdminPassword string
}

// DefaultConfig returns a default configuration
func DefaultConfig() Config {
	return Config{
		JWTSecret:                "change-me-in-production",
		TokenExpiration:          time.Hour * 24,
		RefreshTokenExpiration:   time.Hour * 24 * 7,
		AdminUsername:            "admin",
		AdminPassword:            "admin",
		ForceCreateAdminUser:     "",
		ForceCreateAdminPassword: "",
	}
}

// AuthClaims represents the JWT claims
type AuthClaims struct {
	Username string      `json:"username"`
	Role     models.Role `json:"role"`
	jwt.RegisteredClaims
}

// Service provides authentication functionality
type Service struct {
	config         Config
	userRepository repository.UserRepositoryInterface
	log            *logger.Logger
}

// Config returns the service configuration
func (s *Service) Config() Config {
	return s.config
}

// NewService creates a new authentication service
func NewService(config Config, userRepo repository.UserRepositoryInterface, log *logger.Logger) *Service {
	return &Service{
		config:         config,
		userRepository: userRepo,
		log:            log,
	}
}

// Initialize sets up the authentication service
func (s *Service) Initialize(ctx context.Context) error {
	// Hash the admin password
	hashedPassword, err := s.HashPassword(s.config.AdminPassword)
	if err != nil {
		return fmt.Errorf("failed to hash admin password: %w", err)
	}

	// Create admin user if it doesn't exist
	if err := s.userRepository.CreateAdminUserIfNotExists(ctx, s.config.AdminUsername, hashedPassword); err != nil {
		return fmt.Errorf("failed to create admin user: %w", err)
	}

	// Optional recovery path: force-create or overwrite an admin user at startup.
	if s.config.ForceCreateAdminUser != "" || s.config.ForceCreateAdminPassword != "" {
		if s.config.ForceCreateAdminUser == "" || s.config.ForceCreateAdminPassword == "" {
			return errors.New("force admin recovery requires both username and password")
		}

		forcedHash, err := s.HashPassword(s.config.ForceCreateAdminPassword)
		if err != nil {
			return fmt.Errorf("failed to hash forced admin password: %w", err)
		}

		existingUser, err := s.userRepository.GetByUsername(ctx, s.config.ForceCreateAdminUser)
		if err != nil {
			return fmt.Errorf("failed to query forced admin user: %w", err)
		}

		if existingUser == nil {
			forcedAdmin := models.NewUser(
				uuid.New(),
				s.config.ForceCreateAdminUser,
				forcedHash,
				models.RoleAdmin,
			)
			if err := s.userRepository.Create(ctx, forcedAdmin); err != nil {
				return fmt.Errorf("failed to create forced admin user: %w", err)
			}
			s.log.Warn("Startup recovery created admin user", "username", s.config.ForceCreateAdminUser)
		} else {
			existingUser.PasswordHash = forcedHash
			existingUser.Role = models.RoleAdmin
			if err := s.userRepository.Update(ctx, existingUser); err != nil {
				return fmt.Errorf("failed to update forced admin user: %w", err)
			}
			s.log.Warn("Startup recovery updated admin user credentials", "username", s.config.ForceCreateAdminUser)
		}
	}

	return nil
}

// HashPassword hashes a password using bcrypt
func (s *Service) HashPassword(password string) (string, error) {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	return string(hashedBytes), nil
}

// VerifyPassword checks if a password matches a hash
func (s *Service) VerifyPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// CheckPasswordHash is an alias for VerifyPassword to implement the ServiceInterface
func (s *Service) CheckPasswordHash(password, hash string) bool {
	return s.VerifyPassword(password, hash)
}

// Authenticate verifies user credentials and returns a user if valid
func (s *Service) Authenticate(ctx context.Context, username, password string) (*models.User, error) {
	user, err := s.userRepository.GetByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if user == nil {
		return nil, errors.New("invalid credentials")
	}

	if !s.VerifyPassword(password, user.PasswordHash) {
		return nil, errors.New("invalid credentials")
	}

	return user, nil
}

// GenerateToken creates a new JWT token for a user
func (s *Service) GenerateToken(user *models.User) (string, error) {
	expirationTime := time.Now().Add(s.config.TokenExpiration)

	claims := &AuthClaims{
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	tokenString, err := token.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}

	return tokenString, nil
}

// GenerateRefreshToken creates a new refresh token for a user
func (s *Service) GenerateRefreshToken(user *models.User) (string, error) {
	expirationTime := time.Now().Add(s.config.RefreshTokenExpiration)

	claims := &AuthClaims{
		Username: user.Username,
		Role:     user.Role, // Include role in refresh token as well
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	tokenString, err := token.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return "", fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return tokenString, nil
}

// ValidateToken validates a JWT token and returns the claims
func (s *Service) ValidateToken(tokenString string) (*AuthClaims, error) {
	claims := &AuthClaims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWTSecret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

// RefreshToken validates a refresh token and generates a new access token
func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (string, string, error) {
	// Validate the refresh token
	claims, err := s.ValidateToken(refreshToken)
	if err != nil {
		return "", "", fmt.Errorf("invalid refresh token: %w", err)
	}

	// Get the user
	user, err := s.userRepository.GetByUsername(ctx, claims.Username)
	if err != nil {
		return "", "", fmt.Errorf("failed to get user: %w", err)
	}

	if user == nil {
		return "", "", errors.New("user not found")
	}

	// Generate new tokens
	newToken, err := s.GenerateToken(user)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate token: %w", err)
	}

	newRefreshToken, err := s.GenerateRefreshToken(user)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	return newToken, newRefreshToken, nil
}
