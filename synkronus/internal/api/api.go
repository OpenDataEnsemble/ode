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
	"github.com/opendataensemble/synkronus/pkg/middleware/formulusversion"
	"github.com/opendataensemble/synkronus/portal"
)

// NewRouter creates a new router with all API routes configured
// FileServer conveniently sets up a http.FileServer handler to serve
// static files from a http.FileSystem.
func FileServer(r chi.Router, path string, root http.FileSystem) {
	if path != "/" && path[len(path)-1] != '/' {
		r.Get(path, http.RedirectHandler(path+"/", http.StatusMovedPermanently).ServeHTTP)
		path += "/"
	}
	r.Get(path+"*", func(w http.ResponseWriter, r *http.Request) {
		fs := http.StripPrefix(path, http.FileServer(root))
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
		AllowedHeaders:   []string{"accept", "authorization", "content-type", "x-csrf-token", "x-formulus-version", "if-none-match"},
		ExposedHeaders:   []string{"link", "etag"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Handler is passed as a parameter

	// Public endpoints
	r.Get("/health", h.HealthCheck)

	r.Get("/openapi/swagger", http.RedirectHandler("/openapi/swagger-ui.html", http.StatusMovedPermanently).ServeHTTP)

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

		// Serve OpenAPI documentation (Swagger UI)
		appDir := filepath.Dir(execDir)
		openapiDir := filepath.Join(appDir, "openapi")
		FileServer(r, "/openapi", http.Dir(openapiDir))
	}

	// All REST API routes (except /health) under /api
	authRoutes := func(r chi.Router) {
		r.Use(formulusversion.Middleware(log))
		r.Post("/login", h.Login)
		r.Post("/refresh", h.RefreshToken)
	}

	// Create attachment service
	attachmentService, err := attachment.NewService(h.GetConfig())
	if err != nil {
		log.Error("Failed to initialize attachment service", "error", err)
	}

	// Create attachment handler
	attachmentHandler := handlers.NewAttachmentHandler(
		log,
		attachmentService,
		h.AttachmentManifestService(),
	)

	r.Route("/api", func(r chi.Router) {
		r.Route("/auth", authRoutes)

		// Protected routes - require authentication
		r.Group(func(r chi.Router) {
			r.Use(formulusversion.Middleware(log))
			r.Use(auth.AuthMiddleware(h.GetAuthService(), log))

			attachmentHandler.RegisterRoutes(r, h.AttachmentManifestHandler)

			r.Route("/sync", func(r chi.Router) {
				r.Post("/pull", h.Pull)
				r.With(auth.RequireRole(models.RoleReadWrite, models.RoleAdmin)).Post("/push", h.Push)
			})

			appBundleRoutes := func(r chi.Router) {
				r.Get("/manifest", h.GetAppBundleManifest)
				r.Get("/download/{path}", h.GetAppBundleFile)
				r.Get("/download-zip", h.DownloadBundleZip)
				r.Get("/versions", h.GetAppBundleVersions)
				r.Get("/changes", h.CompareAppBundleVersions)
				r.With(auth.RequireRole(models.RoleAdmin)).Post("/push", h.PushAppBundle)
				r.With(auth.RequireRole(models.RoleAdmin)).Post("/switch/{version}", h.SwitchAppBundleVersion)
			}
			r.Route("/app-bundle", appBundleRoutes)

			userRoutes := func(r chi.Router) {
				// Support both POST /api/users and POST /api/users/create for compatibility
				r.With(auth.RequireRole(models.RoleAdmin)).Post("/", h.CreateUserHandler)
				r.With(auth.RequireRole(models.RoleAdmin)).Post("/create", h.CreateUserHandler)
				r.With(auth.RequireRole(models.RoleAdmin)).Delete("/delete/{username}", h.DeleteUserHandler)
				r.With(auth.RequireRole(models.RoleAdmin)).Post("/reset-password", h.ResetPasswordHandler)
				r.With(auth.RequireRole(models.RoleAdmin)).Get("/", h.ListUsersHandler)
				r.Post("/change-password", h.ChangePasswordHandler)
			}
			r.Route("/users", userRoutes)

			dataExportRoutes := func(r chi.Router) {
				r.With(auth.RequireRole(models.RoleReadOnly, models.RoleReadWrite, models.RoleAdmin)).Get("/parquet", h.ParquetExportHandler)
				r.With(auth.RequireRole(models.RoleReadOnly, models.RoleReadWrite, models.RoleAdmin)).Get("/raw-json", h.RawJSONExportHandler)
			}
			r.Route("/dataexport", dataExportRoutes)

			r.Get("/version", h.GetVersion)
			r.Get("/versions", h.GetAPIVersions)
		})
	})

	// Serve embedded React portal (SPA) for all other GET requests.
	// API routes above take precedence; unmatched paths get index.html for client-side routing.
	portalHandler := portal.Handler()
	r.Get("/*", portalHandler.ServeHTTP)

	return r
}
