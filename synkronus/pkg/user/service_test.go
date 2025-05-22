package user

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/pkg/auth"
	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockUserRepository mocks the user repository interface
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) List(ctx context.Context) ([]models.User, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.User), args.Error(1)
}

func (m *MockUserRepository) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	args := m.Called(ctx, username)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) Create(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) Update(ctx context.Context, user *models.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) CreateAdminUserIfNotExists(ctx context.Context, username, passwordHash string) error {
	args := m.Called(ctx, username, passwordHash)
	return args.Error(0)
}

// MockAuthService mocks the auth service
type MockAuthService struct {
	mock.Mock
	auth.Service
}

func (m *MockAuthService) HashPassword(password string) (string, error) {
	args := m.Called(password)
	return args.String(0), args.Error(1)
}

func (m *MockAuthService) VerifyPassword(password, hash string) bool {
	args := m.Called(password, hash)
	return args.Bool(0)
}

// TestCreateUser tests the CreateUser method
func TestCreateUser(t *testing.T) {
	// Define test cases
	testCases := []struct {
		name           string
		username       string
		password       string
		role           models.Role
		existingUser   *models.User
		hashError      error
		createError    error
		expectedError  error
		shouldCallHash bool
		shouldCreate   bool
	}{
		{
			name:           "Success",
			username:       "testuser",
			password:       "password123",
			role:           models.RoleReadOnly,
			existingUser:   nil,
			hashError:      nil,
			createError:    nil,
			expectedError:  nil,
			shouldCallHash: true,
			shouldCreate:   true,
		},
		{
			name:           "Invalid Role",
			username:       "testuser",
			password:       "password123",
			role:           "invalid-role",
			existingUser:   nil,
			hashError:      nil,
			createError:    nil,
			expectedError:  ErrInvalidRole,
			shouldCallHash: false,
			shouldCreate:   false,
		},
		{
			name:           "User Already Exists",
			username:       "existinguser",
			password:       "password123",
			role:           models.RoleReadOnly,
			existingUser:   &models.User{Username: "existinguser"},
			hashError:      nil,
			createError:    nil,
			expectedError:  ErrUserExists,
			shouldCallHash: false,
			shouldCreate:   false,
		},
		{
			name:           "Hash Password Error",
			username:       "testuser",
			password:       "password123",
			role:           models.RoleReadOnly,
			existingUser:   nil,
			hashError:      errors.New("hash error"),
			createError:    nil,
			expectedError:  errors.New("failed to hash password: hash error"),
			shouldCallHash: true,
			shouldCreate:   false,
		},
		{
			name:           "Create User Error",
			username:       "testuser",
			password:       "password123",
			role:           models.RoleReadOnly,
			existingUser:   nil,
			hashError:      nil,
			createError:    errors.New("create error"),
			expectedError:  errors.New("failed to create user: create error"),
			shouldCallHash: true,
			shouldCreate:   true,
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockUserRepository)
			mockAuthService := new(MockAuthService)
			logger := logger.NewLogger(logger.WithLevel(logger.LevelDebug))

			// Create the service with mocks
			service := &Service{
				userRepo:    mockRepo,
				authService: mockAuthService,
				log:         logger,
			}

			// Setup expectations
			ctx := context.Background()

			// Only setup GetByUsername expectation if we're not testing an invalid role
			// since role validation happens before checking for existing user
			if tc.role == models.RoleReadOnly || tc.role == models.RoleReadWrite || tc.role == models.RoleAdmin {
				mockRepo.On("GetByUsername", ctx, tc.username).Return(tc.existingUser, nil)
			}

			if tc.shouldCallHash {
				hashedPassword := "hashed_" + tc.password
				mockAuthService.On("HashPassword", tc.password).Return(hashedPassword, tc.hashError)

				if tc.hashError == nil && tc.shouldCreate {
					// Check that the user is created with the correct values
					mockRepo.On("Create", ctx, mock.MatchedBy(func(u *models.User) bool {
						return u.Username == tc.username &&
							u.PasswordHash == hashedPassword &&
							u.Role == tc.role
					})).Return(tc.createError)
				}
			}

			// Call the method we're testing
			user, err := service.CreateUser(ctx, tc.username, tc.password, tc.role)

			// Verify results
			if tc.expectedError != nil {
				assert.Error(t, err)
				assert.Nil(t, user)
				if tc.expectedError.Error() != "" {
					assert.Equal(t, tc.expectedError.Error(), err.Error())
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, user)
				assert.Equal(t, tc.username, user.Username)
				assert.Equal(t, tc.role, user.Role)
				assert.NotEqual(t, uuid.Nil, user.ID)
			}

			// Verify all expectations were met
			mockRepo.AssertExpectations(t)
			mockAuthService.AssertExpectations(t)
		})
	}
}

// TestDeleteUser tests the DeleteUser method
func TestDeleteUser(t *testing.T) {
	// Define test cases
	testCases := []struct {
		name          string
		username      string
		existingUser  *models.User
		getUserError  error
		deleteError   error
		expectedError error
	}{
		{
			name:          "Success",
			username:      "testuser",
			existingUser:  &models.User{ID: uuid.New(), Username: "testuser"},
			getUserError:  nil,
			deleteError:   nil,
			expectedError: nil,
		},
		{
			name:          "User Not Found",
			username:      "nonexistentuser",
			existingUser:  nil,
			getUserError:  nil,
			deleteError:   nil,
			expectedError: ErrUserNotFound,
		},
		{
			name:          "Get User Error",
			username:      "testuser",
			existingUser:  nil,
			getUserError:  errors.New("database error"),
			deleteError:   nil,
			expectedError: errors.New("failed to get user: database error"),
		},
		{
			name:          "Delete Error",
			username:      "testuser",
			existingUser:  &models.User{ID: uuid.New(), Username: "testuser"},
			getUserError:  nil,
			deleteError:   errors.New("delete error"),
			expectedError: errors.New("failed to delete user: delete error"),
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mocks
			mockRepo := new(MockUserRepository)
			mockAuthService := new(MockAuthService)
			logger := logger.NewLogger(logger.WithLevel(logger.LevelDebug))

			// Create the service with mocks
			service := &Service{
				userRepo:    mockRepo,
				authService: mockAuthService,
				log:         logger,
			}

			// Setup expectations
			ctx := context.Background()

			// Setup GetByUsername mock
			mockRepo.On("GetByUsername", ctx, tc.username).Return(tc.existingUser, tc.getUserError)

			// Setup Delete mock if we expect to get to that point
			if tc.existingUser != nil && tc.getUserError == nil {
				mockRepo.On("Delete", ctx, tc.existingUser.ID).Return(tc.deleteError)
			}

			// Call the method we're testing
			err := service.DeleteUser(ctx, tc.username)

			// Verify results
			if tc.expectedError != nil {
				assert.Error(t, err)
				if tc.expectedError.Error() != "" {
					assert.Equal(t, tc.expectedError.Error(), err.Error())
				}
			} else {
				assert.NoError(t, err)
			}

			// Verify all expectations were met
			mockRepo.AssertExpectations(t)
			mockAuthService.AssertExpectations(t)
		})
	}
}

// TestListUsers tests the ListUsers method
func TestListUsers(t *testing.T) {
	// Create mocks
	mockRepo := new(MockUserRepository)
	mockAuthService := new(MockAuthService)
	logger := logger.NewLogger(logger.WithLevel(logger.LevelDebug))

	// Create the service with mocks
	service := &Service{
		userRepo:    mockRepo,
		authService: mockAuthService,
		log:         logger,
	}

	// Setup expectations
	ctx := context.Background()

	// Setup List mock
	mockRepo.On("List", ctx).Return([]models.User{}, nil)

	// Call the method we're testing
	userList, err := service.ListUsers(ctx)

	// Verify results
	assert.NoError(t, err)
	assert.NotNil(t, userList)
	assert.Equal(t, 0, len(userList))

	// Verify all expectations were met
	mockRepo.AssertExpectations(t)
	mockAuthService.AssertExpectations(t)
}

// TestResetPassword tests the ResetPassword method
func TestResetPassword(t *testing.T) {
	type testCase struct {
		name         string
		getUser      func() (*models.User, error)
		hashPassword func(string) (string, error)
		updateError  error
		expectedErr  error
	}

	testCases := []testCase{
		{
			name: "Success",
			getUser: func() (*models.User, error) {
				return &models.User{Username: "testuser", PasswordHash: "oldhash"}, nil
			},
			hashPassword: func(pw string) (string, error) {
				return "newhash", nil
			},
			updateError: nil,
			expectedErr: nil,
		},
		{
			name: "User Not Found",
			getUser: func() (*models.User, error) {
				return nil, nil
			},
			hashPassword: func(pw string) (string, error) {
				return "", nil
			},
			updateError: nil,
			expectedErr: ErrUserNotFound,
		},
		{
			name: "Get User Error",
			getUser: func() (*models.User, error) {
				return nil, errors.New("db error")
			},
			hashPassword: func(pw string) (string, error) {
				return "", nil
			},
			updateError: nil,
			expectedErr: errors.New("failed to get user: db error"),
		},
		{
			name: "Hash Password Error",
			getUser: func() (*models.User, error) {
				return &models.User{Username: "testuser", PasswordHash: "oldhash"}, nil
			},
			hashPassword: func(pw string) (string, error) {
				return "", errors.New("hash error")
			},
			updateError: nil,
			expectedErr: errors.New("failed to hash password: hash error"),
		},
		{
			name: "Update User Error",
			getUser: func() (*models.User, error) {
				return &models.User{Username: "testuser", PasswordHash: "oldhash"}, nil
			},
			hashPassword: func(pw string) (string, error) {
				return "newhash", nil
			},
			updateError: errors.New("update error"),
			expectedErr: errors.New("failed to update user: update error"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			mockRepo := new(MockUserRepository)
			mockAuth := new(MockAuthService)
			log := logger.NewLogger()

			mockRepo.On("GetByUsername", mock.Anything, "testuser").Return(tc.getUser())
			mockAuth.On("HashPassword", "newpass").Return(tc.hashPassword("newpass"))
			mockRepo.On("Update", mock.Anything, mock.AnythingOfType("*models.User")).Return(tc.updateError)

			svc := &Service{
				userRepo:    mockRepo,
				authService: mockAuth,
				log:         log,
			}

			err := svc.ResetPassword(context.Background(), "testuser", "newpass")
			if tc.expectedErr == nil {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tc.expectedErr.Error())
			}
		})
	}
}

func TestChangePassword(t *testing.T) {
	// Create mocks
	mockRepo := new(MockUserRepository)
	mockAuthService := new(MockAuthService)
	logger := logger.NewLogger(logger.WithLevel(logger.LevelDebug))

	// Create the service with mocks
	service := &Service{
		userRepo:    mockRepo,
		authService: mockAuthService,
		log:         logger,
	}

	// Setup expectations
	ctx := context.Background()

	// Setup GetByUsername mock
	mockRepo.On("GetByUsername", ctx, "testuser").Return(&models.User{Username: "testuser"}, nil)

	// Setup HashPassword mock
	mockAuthService.On("HashPassword", "newpassword").Return("hashed_newpassword", nil)

	// Setup VerifyPassword mock
	mockAuthService.On("VerifyPassword", "oldpassword", "").Return(true, nil)

	// Setup Update mock
	mockRepo.On("Update", ctx, mock.MatchedBy(func(u *models.User) bool {
		return u.Username == "testuser" && u.PasswordHash == "hashed_newpassword"
	})).Return(nil)

	// Call the method we're testing
	err := service.ChangePassword(ctx, "testuser", "oldpassword", "newpassword")

	// Verify results
	assert.NoError(t, err)

	// Verify all expectations were met
	mockRepo.AssertExpectations(t)
	mockAuthService.AssertExpectations(t)
}

func TestChangePassword_InvalidPassword(t *testing.T) {
	// Create mocks
	mockRepo := new(MockUserRepository)
	mockAuthService := new(MockAuthService)
	logger := logger.NewLogger(logger.WithLevel(logger.LevelDebug))

	// Create the service with mocks
	service := &Service{
		userRepo:    mockRepo,
		authService: mockAuthService,
		log:         logger,
	}

	// Setup expectations
	ctx := context.Background()

	// Setup GetByUsername mock
	mockRepo.On("GetByUsername", ctx, "testuser").Return(&models.User{Username: "testuser"}, nil)

	// Setup VerifyPassword mock
	mockAuthService.On("VerifyPassword", "wrongpassword", "").Return(false, nil)

	// Call the method we're testing
	err := service.ChangePassword(ctx, "testuser", "wrongpassword", "newpassword")

	// Verify results
	assert.Error(t, err)
	assert.Equal(t, ErrInvalidPassword, err)

	// Verify all expectations were met
	mockRepo.AssertExpectations(t)
	mockAuthService.AssertExpectations(t)
}

func TestChangePassword_UserNotFound(t *testing.T) {
	// Create mocks
	mockRepo := new(MockUserRepository)
	mockAuthService := new(MockAuthService)
	logger := logger.NewLogger(logger.WithLevel(logger.LevelDebug))

	// Create the service with mocks
	service := &Service{
		userRepo:    mockRepo,
		authService: mockAuthService,
		log:         logger,
	}

	// Setup expectations
	ctx := context.Background()

	// Setup GetByUsername mock
	mockRepo.On("GetByUsername", ctx, "testuser").Return(nil, ErrUserNotFound)

	// Call the method we're testing
	err := service.ChangePassword(ctx, "testuser", "oldpassword", "newpassword")

	// Verify results
	assert.Error(t, err)

	// Verify all expectations were met
	mockRepo.AssertExpectations(t)
	mockAuthService.AssertExpectations(t)
}
