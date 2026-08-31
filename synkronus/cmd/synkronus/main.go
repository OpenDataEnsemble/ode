package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/opendataensemble/synkronus/internal/api"
	"github.com/opendataensemble/synkronus/internal/handlers"
	"github.com/opendataensemble/synkronus/internal/repository"
	"github.com/opendataensemble/synkronus/pkg/appbundle"
	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/auth"
	"github.com/opendataensemble/synkronus/pkg/config"
	"github.com/opendataensemble/synkronus/pkg/database"
	"github.com/opendataensemble/synkronus/pkg/dataexport"
	"github.com/opendataensemble/synkronus/pkg/httptimeout"
	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/opendataensemble/synkronus/pkg/migrations"
	"github.com/opendataensemble/synkronus/pkg/presence"
	"github.com/opendataensemble/synkronus/pkg/stats"
	"github.com/opendataensemble/synkronus/pkg/sync"
	"github.com/opendataensemble/synkronus/pkg/user"
	"github.com/opendataensemble/synkronus/pkg/version"
)

func redactPassword(dsn string) string {
	u, err := url.Parse(dsn)
	if err != nil {
		return dsn // fallback: log original string if it can't parse
	}

	if u.User != nil {
		if _, hasPwd := u.User.Password(); hasPwd {
			u.User = url.UserPassword(u.User.Username(), "**REDACTED**")
		}
	}

	return u.String()
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := os.Getenv(key); value != "" {
			return value
		}
	}
	return ""
}

func readForceAdminRecoveryEnv() (string, string, error) {
	username := firstNonEmptyEnv("SYNKRONUS_RECOVERY_CREATE_USER", "synkronus_recovery_create_user")
	password := firstNonEmptyEnv("SYNKRONUS_RECOVERY_CREATE_PASS", "synkronus_recovery_create_pass")

	if (username == "" && password != "") || (username != "" && password == "") {
		return "", "", errors.New("both SYNKRONUS_RECOVERY_CREATE_USER and SYNKRONUS_RECOVERY_CREATE_PASS must be set together")
	}

	return username, password, nil
}

func main() {
	// Temporary logger for configuration loading
	preLog := logger.NewLogger(
		logger.WithOutputWriter(os.Stdout),
		logger.WithLevel(logger.LevelInfo),
		logger.WithPrettyPrint(true),
	)

	// Load configuration
	cfg, err := config.Load(preLog)
	if err != nil {
		preLog.Error("Error loading configuration", "error", err)
		os.Exit(1)
	}

	// Initialize the logger
	logLevel := logger.LevelInfo
	switch cfg.LogLevel {
	case "debug":
		logLevel = logger.LevelDebug
	case "info":
		logLevel = logger.LevelInfo
	case "warn":
		logLevel = logger.LevelWarn
	case "error":
		logLevel = logger.LevelError
	}

	log := logger.NewLogger(
		logger.WithOutputWriter(os.Stdout),
		logger.WithLevel(logLevel),
		logger.WithPrettyPrint(true),
	)

	log.Info("Starting Synkronus API server", "version", version.BuildVersion())
	log.Info("Configuration loaded from", "source", cfg.Source)
	log.Debug("Configuration details", "port", cfg.Port, "logLevel", cfg.LogLevel,
		"dataDir", cfg.DataDir,
		"appBundlePath", cfg.AppBundlePath,
		"appBundleVersionsPath", cfg.AppBundleVersionsPath,
		"imageCompressionLevel", cfg.ImageCompressionLevel,
		"imageMaxWidthPx", cfg.ImageMaxWidthPx,
		"imageMaxHeightPx", cfg.ImageMaxHeightPx,
		"imageApplyExifOrientation", cfg.ImageApplyExifOrientation)

	// Initialize database
	dbConfig := database.DefaultConfig()
	// Override database config from configuration
	dbConfig.ConnectionString = cfg.DatabaseURL
	dbConfig.MigrationsFS = migrations.GetFS()

	log.Info("Initializing database connection", "connection_string", redactPassword(cfg.DatabaseURL))
	db, err := database.New(dbConfig, log)
	if err != nil {
		log.Error("Failed to initialize database", "error", err, "error_type", fmt.Sprintf("%T", err), "error_string", err.Error(), "connection_string", redactPassword(cfg.DatabaseURL))
		log.Info("Exiting due to database initialization error")
		return
	}
	defer db.Close()

	// Run database migrations
	log.Info("Starting database migrations...")
	if err := db.Migrate(); err != nil {
		log.Error("Failed to run database migrations", "error", err, "error_type", fmt.Sprintf("%T", err), "error_string", err.Error())
		log.Info("Exiting due to database migration error")
		return
	}
	log.Info("Database migrations completed successfully")

	// Initialize repositories
	userRepo := repository.NewUserRepository(db, log)
	presenceRepo := repository.NewPresenceRepository(db, log)
	presenceRecorder := presence.NewRecorder(presenceRepo, log, presence.DefaultConfig())

	// Initialize auth service
	authConfig := auth.DefaultConfig()
	// Override auth config from configuration
	authConfig.JWTSecret = cfg.JWTSecret

	// These can still be overridden by environment variables for security
	if adminUsername := os.Getenv("ADMIN_USERNAME"); adminUsername != "" {
		authConfig.AdminUsername = adminUsername
	}
	if adminPassword := os.Getenv("ADMIN_PASSWORD"); adminPassword != "" {
		authConfig.AdminPassword = adminPassword
	}
	forceAdminUsername, forceAdminPassword, err := readForceAdminRecoveryEnv()
	if err != nil {
		log.Error("Invalid startup admin recovery configuration", "error", err)
		log.Info("Exiting due to invalid auth configuration")
		return
	}
	authConfig.ForceCreateAdminUser = forceAdminUsername
	authConfig.ForceCreateAdminPassword = forceAdminPassword

	authService := auth.NewService(authConfig, userRepo, log)

	// Initialize the auth service and create admin user if needed
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := authService.Initialize(ctx); err != nil {
		log.Error("Failed to initialize auth service", "error", err)
		log.Info("Exiting due to auth service initialization error")
		return
	}

	// Initialize app bundle service (paths fixed under <exe-dir>/data/app-bundle/...)
	appBundleConfig := appbundle.DefaultConfig()
	appBundleConfig.BundlePath = cfg.AppBundlePath
	appBundleConfig.VersionsPath = cfg.AppBundleVersionsPath
	appBundleConfig.MaxVersions = cfg.MaxVersionsKept
	log.Info("Local data layout", "dataDir", cfg.DataDir, "appBundleActive", cfg.AppBundlePath, "appBundleVersions", cfg.AppBundleVersionsPath)

	appBundleService := appbundle.NewService(appBundleConfig, log)

	// Initialize the app bundle service
	if err := appBundleService.Initialize(ctx); err != nil {
		log.Error("Failed to initialize app bundle service", "error", err)
		log.Info("Exiting due to app bundle service initialization error")
		return
	}

	// Initialize sync service
	syncConfig := sync.DefaultConfig()

	syncService := sync.NewService(db.DB(), syncConfig, log)

	// Initialize the sync service
	if err := syncService.Initialize(ctx); err != nil {
		log.Error("Failed to initialize sync service", "error", err)
		log.Info("Exiting due to sync service initialization error")
		return
	}

	// Initialize user service
	userService := user.NewService(userRepo, presenceRepo, authService, log)

	// Initialize version service
	versionService := version.NewService(db.DB())

	// Initialize attachment manifest service
	attachmentManifestService := attachment.NewManifestService(db.DB(), cfg, log)
	if err := attachmentManifestService.Initialize(ctx); err != nil {
		log.Error("Failed to initialize attachment manifest service", "error", err)
		log.Info("Exiting due to attachment manifest service initialization error")
		return
	}

	// Initialize data export service
	dataExportDB := dataexport.NewPostgresDB(db.DB())
	dataExportService := dataexport.NewService(dataExportDB, cfg)

	// Initialize observation stats service
	statsDB := stats.NewPostgresDB(db.DB())
	statsService := stats.NewService(statsDB)

	// Convert concrete types to interfaces if needed
	var (
		authSvc      auth.AuthServiceInterface           = authService
		appBundleSvc appbundle.AppBundleServiceInterface = appBundleService
		syncSvc      sync.ServiceInterface               = syncService
		userSvc      user.UserServiceInterface           = userService
	)

	// Initialize handlers
	h := handlers.NewHandler(
		log,
		cfg,
		authSvc,
		appBundleSvc,
		syncSvc,
		userSvc,
		versionService,
		attachmentManifestService,
		dataExportService,
		statsService,
		presenceRecorder,
	)

	// Create the API router with handlers
	router := api.NewRouter(log, h)

	// Get server port from configuration
	port := 8080
	if p, err := strconv.Atoi(cfg.Port); err == nil {
		port = p
	} else {
		log.Warn("Invalid port in configuration, using default", "port", port)
	}

	// ReadHeaderTimeout is the Slowloris bound. ReadTimeout/WriteTimeout are
	// left unset (0): they are absolute deadlines from request start, so a 15s
	// cap killed legitimate sync, attachment, and bundle-zip transfers on slow
	// links. Auth login/refresh are still bounded via httptimeout.Auth.
	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", port),
		Handler:           router,
		ReadHeaderTimeout: httptimeout.ReadHeaderTimeout,
		IdleTimeout:       httptimeout.IdleTimeout,
	}

	// Start server in a goroutine so it doesn't block
	go func() {
		log.Info("Server listening", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("Server failed to start", "error", err.Error())
			log.Info("Exiting due to server start error")
			return
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Create a deadline to wait for current operations to complete
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	presenceRecorder.Shutdown(shutdownCtx)

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Error("Server forced to shutdown", "error", err.Error())
	}

	log.Info("Server gracefully stopped")
}
