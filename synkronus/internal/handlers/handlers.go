package handlers

import (
	"github.com/collectakit/synkronus/pkg/appbundle"
	"github.com/collectakit/synkronus/pkg/auth"
	"github.com/collectakit/synkronus/pkg/logger"
	"github.com/collectakit/synkronus/pkg/sync"
	"github.com/collectakit/synkronus/pkg/user"
	"github.com/collectakit/synkronus/pkg/version"
)

// Handler manages all API endpoints
type Handler struct {
	log              *logger.Logger
	authService      auth.AuthServiceInterface
	appBundleService appbundle.AppBundleServiceInterface
	syncService      sync.ServiceInterface
	userService      user.UserServiceInterface
	versionService   version.Service
}

// NewHandler creates a new Handler instance
func NewHandler(
	log *logger.Logger,
	authService auth.AuthServiceInterface,
	appBundleService appbundle.AppBundleServiceInterface,
	syncService sync.ServiceInterface,
	userService user.UserServiceInterface,
	versionService version.Service,
) *Handler {
	return &Handler{
		log:              log,
		authService:      authService,
		appBundleService: appBundleService,
		syncService:      syncService,
		userService:      userService,
		versionService:   versionService,
	}
}

// GetAuthService returns the auth service
func (h *Handler) GetAuthService() auth.AuthServiceInterface {
	return h.authService
}
