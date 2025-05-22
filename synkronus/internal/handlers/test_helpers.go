package handlers

import (
	"github.com/collectakit/synkronus/internal/handlers/mocks"
	"github.com/collectakit/synkronus/pkg/logger"
)

// createTestHandler creates a handler with mock dependencies for testing
func createTestHandler() (*Handler, *mocks.MockAppBundleService) {
	// Create a logger for testing
	log := logger.NewLogger()

	// Create a mock auth service
	mockAuthService := mocks.NewMockAuthService()

	// Create a mock app bundle service
	mockAppBundleService := mocks.NewMockAppBundleService()

	// Create a mock sync service
	mockSyncService := mocks.NewMockSyncService()

	// Create a mock version service
	mockVersionService := mocks.NewMockVersionService()

	// Create a new handler
	h := NewHandler(
		log,
		mockAuthService,
		mockAppBundleService,
		mockSyncService,
		mocks.NewMockUserService(),
		mockVersionService,
	)

	return h, mockAppBundleService
}
