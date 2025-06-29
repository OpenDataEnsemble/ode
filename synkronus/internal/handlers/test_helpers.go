package handlers

import (
	"context"

	"github.com/opendataensemble/synkronus/internal/handlers/mocks"
	"github.com/opendataensemble/synkronus/pkg/logger"
)

// createTestHandler creates a handler with mock dependencies for testing
func createTestHandler() (*Handler, *mocks.MockAppBundleService) {
	// Create a logger for testing
	log := logger.NewLogger()

	// Create test config
	testConfig := mocks.NewTestConfig()

	// Create mock services
	mockAuthService := mocks.NewMockAuthService()
	mockAppBundleService := mocks.NewMockAppBundleService()
	mockSyncService := mocks.NewMockSyncService()

	// Initialize the mock sync service
	if err := mockSyncService.Initialize(context.Background()); err != nil {
		panic("Failed to initialize mock sync service: " + err.Error())
	}

	// Create a mock version service
	mockVersionService := mocks.NewMockVersionService()

	// Create a new handler
	h := NewHandler(
		log,
		testConfig,
		mockAuthService,
		mockAppBundleService,
		mockSyncService,
		mocks.NewMockUserService(),
		mockVersionService,
	)

	return h, mockAppBundleService
}
