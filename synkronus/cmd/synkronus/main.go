package main

import (
	"context"
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
	"github.com/opendataensemble/synkronus/pkg/auth"
	"github.com/opendataensemble/synkronus/pkg/config"
	"github.com/opendataensemble/synkronus/pkg/database"
	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/opendataensemble/synkronus/pkg/migrations"
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
func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Error loading configuration: %v\n", err)
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

	log.Info("Starting Synkronus API server", "version", "1.0.22")
	log.Info("Configuration loaded from", "source", cfg.Source)
	log.Debug("Configuration details", "port", cfg.Port, "logLevel", cfg.LogLevel, "appBundlePath", cfg.AppBundlePath)

	// Initialize database
	dbConfig := database.DefaultConfig()
	// Override database config from configuration
	dbConfig.ConnectionString = cfg.DatabaseURL
	dbConfig.MigrationsFS = migrations.GetFS()

	log.Info("Initializing database connection", "connection_string", redactPassword(cfg.DatabaseURL))
	db, err := database.New(dbConfig, log)
	if err != nil {
		log.Error("Failed to initialize database", "error", err, "error_type", fmt.Sprintf("%T", err), "error_string", err.Error(), "connection_string", redactPassword(cfg.DatabaseURL))
		os.Exit(1)
	}
	defer db.Close()

	// Run database migrations
	log.Info("Starting database migrations...")
	if err := db.Migrate(); err != nil {
		log.Error("Failed to run database migrations", "error", err, "error_type", fmt.Sprintf("%T", err), "error_string", err.Error())
		os.Exit(1)
	}
	log.Info("Database migrations completed successfully")

	// Initialize repositories
	userRepo := repository.NewUserRepository(db, log)

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

	authService := auth.NewService(authConfig, userRepo, log)

	// Initialize the auth service and create admin user if needed
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := authService.Initialize(ctx); err != nil {
		log.Error("Failed to initialize auth service", "error", err)
		os.Exit(1)
	}

	// Initialize app bundle service
	appBundleConfig := appbundle.DefaultConfig()
	// Override app bundle config from configuration
	appBundleConfig.BundlePath = cfg.AppBundlePath
	appBundleConfig.MaxVersions = cfg.MaxVersionsKept

	appBundleService := appbundle.NewService(appBundleConfig, log)

	// Initialize the app bundle service
	if err := appBundleService.Initialize(ctx); err != nil {
		log.Error("Failed to initialize app bundle service", "error", err)
		os.Exit(1)
	}

	// Initialize sync service
	syncConfig := sync.DefaultConfig()

	syncService := sync.NewService(db.DB(), syncConfig, log)

	// Initialize the sync service
	if err := syncService.Initialize(ctx); err != nil {
		log.Error("Failed to initialize sync service", "error", err)
		os.Exit(1)
	}

	// Initialize user service
	userService := user.NewService(userRepo, authService, log)

	// Initialize version service
	versionService := version.NewService(db.DB())

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
		authSvc,
		appBundleSvc,
		syncSvc,
		userSvc,
		versionService,
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

	// Configure server with timeouts for security and reliability
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine so it doesn't block
	go func() {
		log.Info("Server listening", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("Server failed to start", "error", err.Error())
			os.Exit(1)
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

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Error("Server forced to shutdown", "error", err.Error())
	}

	log.Info("Server gracefully stopped")
}
