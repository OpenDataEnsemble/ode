package handlers

import (
	"github.com/opendataensemble/synkronus/pkg/appbundle"
	"github.com/opendataensemble/synkronus/pkg/auth"
	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/opendataensemble/synkronus/pkg/sync"
	"github.com/opendataensemble/synkronus/pkg/user"
	"github.com/opendataensemble/synkronus/pkg/version"
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
