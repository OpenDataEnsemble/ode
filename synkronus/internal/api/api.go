package api

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/opendataensemble/synkronus/internal/handlers"
	"github.com/opendataensemble/synkronus/internal/models"
	"github.com/opendataensemble/synkronus/pkg/attachment"
	"github.com/opendataensemble/synkronus/pkg/logger"
	"github.com/opendataensemble/synkronus/pkg/middleware/auth"
)

// NewRouter creates a new router with all API routes configured
// FileServer conveniently sets up a http.FileServer handler to serve
// static files from a http.FileSystem.
func FileServer(r chi.Router, path string, root http.FileSystem) {
	if path != "/" && path[len(path)-1] != '/' {
		r.Get(path, http.RedirectHandler(path+"/", 301).ServeHTTP)
		path += "/"
	}
	r.Get(path+"*", func(w http.ResponseWriter, r *http.Request) {
		rctx := chi.RouteContext(r.Context())
		pathPrefix := rctx.RoutePattern()
		fs := http.StripPrefix(pathPrefix, http.FileServer(root))
		fs.ServeHTTP(w, r)
	})
}

func NewRouter(log *logger.Logger, h *handlers.Handler) http.Handler {
	r := chi.NewRouter()

	// Add middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RedirectSlashes) // redirects /users to /users/ etc.

	// Add CORS middleware
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"accept", "authorization", "content-type", "x-csrf-token", "if-none-match"},
		ExposedHeaders:   []string{"link", "etag"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Handler is passed as a parameter

	// Public endpoints
	r.Get("/health", h.HealthCheck)

	// Serve favicon.ico
	r.Get("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		// Get the executable directory
		execDir, err := os.Executable()
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		// Get the root directory (parent of the executable directory)
		rootDir := filepath.Dir(filepath.Dir(execDir))
		// Serve the favicon from the static directory
		faviconPath := filepath.Join(rootDir, "static", "favicon.ico")
		http.ServeFile(w, r, faviconPath)
	})

	// Serve static files
	// Get the executable directory
	execDir, err := os.Executable()
	if err == nil {
		// Get the root directory (parent of the executable directory)
		rootDir := filepath.Dir(filepath.Dir(execDir))
		// Serve static files from the static directory
		staticDir := filepath.Join(rootDir, "static")
		FileServer(r, "/static", http.Dir(staticDir))
	}

	// Authentication routes
	r.Route("/auth", func(r chi.Router) {
		r.Post("/login", h.Login)
		r.Post("/refresh", h.RefreshToken)
	})

	// Create attachment service
	attachmentService, err := attachment.NewService(h.GetConfig())
	if err != nil {
		log.Error("Failed to initialize attachment service", "error", err)
	}

	// Create attachment handler
	attachmentHandler := handlers.NewAttachmentHandler(attachmentService)

	// Protected routes - require authentication
	r.Group(func(r chi.Router) {
		// Add authentication middleware
		r.Use(auth.AuthMiddleware(h.GetAuthService(), log))

		// Register attachment routes
		attachmentHandler.RegisterRoutes(r)

		// Sync routes
		r.Route("/sync", func(r chi.Router) {
			// Pull endpoint - accessible to all authenticated users
			r.Post("/pull", h.Pull)

			// Push endpoint - requires read-write or admin role
			r.With(auth.RequireRole(models.RoleReadWrite, models.RoleAdmin)).Post("/push", h.Push)
		})

		// App bundle routes
		r.Route("/app-bundle", func(r chi.Router) {
			// Read endpoints - accessible to all authenticated users
			r.Get("/manifest", h.GetAppBundleManifest)
			r.Get("/download/{path}", h.GetAppBundleFile)
			r.Get("/versions", h.GetAppBundleVersions)
			r.Get("/changes", h.CompareAppBundleVersions)

			// Write endpoints - require admin role
			r.With(auth.RequireRole(models.RoleAdmin)).Post("/push", h.PushAppBundle)
			r.With(auth.RequireRole(models.RoleAdmin)).Post("/switch/{version}", h.SwitchAppBundleVersion)
		})

		// Attachments routes
		r.Route("/attachments", func(r chi.Router) {
			r.Get("/manifest", nil) // Not implemented yet
			r.Get("/{id}", nil)     // Not implemented yet
		})

		// Form specifications routes
		r.Route("/formspecs", func(r chi.Router) {
			r.Get("/{schemaType}/{schemaVersion}", nil) // Not implemented yet
		})

		// User management routes
		r.Route("/users", func(r chi.Router) {
			// Admin-only routes
			r.With(auth.RequireRole(models.RoleAdmin)).Post("/", h.CreateUserHandler)
			r.With(auth.RequireRole(models.RoleAdmin)).Delete("/delete/{username}", h.DeleteUserHandler)
			r.With(auth.RequireRole(models.RoleAdmin)).Post("/reset-password", h.ResetPasswordHandler)
			r.With(auth.RequireRole(models.RoleAdmin)).Get("/", h.ListUsersHandler)
			// Authenticated user route
			r.Post("/change-password", h.ChangePasswordHandler)
		})

		// Version routes
		r.Get("/version", h.GetVersion)
		r.Get("/api/versions", h.GetAPIVersions) // Not implemented yet
	})

	return r
}
