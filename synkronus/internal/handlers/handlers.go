package handlers

import (
	"github.com/opendataensemble/synkronus/pkg/appbundle"
	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/auth"
	"github.com/opendataensemble/synkronus/pkg/config"
	"github.com/opendataensemble/synkronus/pkg/dataexport"
	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/opendataensemble/synkronus/pkg/sync"
	"github.com/opendataensemble/synkronus/pkg/user"
	"github.com/opendataensemble/synkronus/pkg/version"
)

// Handler manages all API endpoints
type Handler struct {
	log                       *logger.Logger
	config                    *config.Config
	authService               auth.AuthServiceInterface
	appBundleService          appbundle.AppBundleServiceInterface
	syncService               sync.ServiceInterface
	userService               user.UserServiceInterface
	versionService            version.Service
	attachmentManifestService attachment.ManifestService
	dataExportService         dataexport.Service
}

// NewHandler creates a new Handler instance
func NewHandler(
	log *logger.Logger,
	config *config.Config,
	authService auth.AuthServiceInterface,
	appBundleService appbundle.AppBundleServiceInterface,
	syncService sync.ServiceInterface,
	userService user.UserServiceInterface,
	versionService version.Service,
	attachmentManifestService attachment.ManifestService,
	dataExportService dataexport.Service,
) *Handler {
	return &Handler{
		log:                       log,
		config:                    config,
		authService:               authService,
		appBundleService:          appBundleService,
		syncService:               syncService,
		userService:               userService,
		versionService:            versionService,
		attachmentManifestService: attachmentManifestService,
		dataExportService:         dataExportService,
	}
}

// GetAuthService returns the auth service
func (h *Handler) GetAuthService() auth.AuthServiceInterface {
	return h.authService
}

// GetConfig returns the application configuration
func (h *Handler) GetConfig() *config.Config {
	return h.config
}
