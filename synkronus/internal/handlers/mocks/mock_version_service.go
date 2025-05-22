package mocks

import (
	"context"

	"github.com/collectakit/synkronus/pkg/version"
	"github.com/stretchr/testify/mock"
)

// MockVersionService is a mock implementation of version.Service
type MockVersionService struct {
	mock.Mock
}

// NewMockVersionService creates a new mock version service
func NewMockVersionService() *MockVersionService {
	return &MockVersionService{}
}

// GetVersion mocks the GetVersion method
func (m *MockVersionService) GetVersion(ctx context.Context) (*version.SystemVersionInfo, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*version.SystemVersionInfo), args.Error(1)
}
