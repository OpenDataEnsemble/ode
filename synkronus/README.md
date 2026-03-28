# Synkronus API

Synkronus is a robust synchronization API for offline-first applications, built with Go.

## Features

- JWT-based authentication with role-based permissions
- Sync operations for pushing and pulling data
- Attachment management
- Form specifications for dynamic UI generation
- API versioning support
- ETag support for caching and efficiency

## Project Structure

This project follows the standard Go project layout with a clean architecture approach:

```
synkronus/
├── cmd/synkronus/         # Application entry point
├── internal/              # Private application code
│   ├── api/               # API definition and OpenAPI integration
│   ├── handlers/          # HTTP handlers
│   ├── models/            # Domain models
│   ├── repository/        # Data access layer
│   └── services/          # Business logic
└── pkg/                   # Public libraries that can be used by external applications
    ├── auth/              # Authentication utilities
    ├── database/          # Database connection and migrations
    ├── logger/            # Structured logging
    ├── middleware/        # HTTP middleware components
    └── openapi/           # OpenAPI generated code
```

## Getting Started

### Quick Start with Docker

**For production deployment**, we recommend using Docker Compose with nginx and cloudflared tunnel.

See [DOCKER.md](./DOCKER.md) for running pre-built images and local Docker usage, and [DEPLOYMENT.md](./DEPLOYMENT.md) for full production setup (including database initialization).

### Development Setup

#### Prerequisites

- Go 1.22 or higher
- PostgreSQL

#### Installation

```bash
go get github.com/opendataensemble/synkronus
```

### Configuration

Synkronus uses a flexible configuration system that supports both environment variables and a `.env` file for local development:

1. **Environment Variables**: The primary method for configuration, especially in production environments.

2. **`.env` File**: For local development, you can create a `.env` file in any of these locations (searched in this order):
   - Current working directory (where you run the command from)
   - Same directory as the executable
   - Parent directory of the executable

   You can copy `.env.example` as a starting point.

#### Configuration Options

| Variable | Description | Default |
|----------|-------------|--------|
| `PORT` | HTTP server port | `8080` |
| `DB_CONNECTION` | PostgreSQL connection string | `postgres://user:password@localhost:5432/synkronus` |
| `JWT_SECRET` | Secret key for JWT token signing | (required, no default) |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |
| `MAX_VERSIONS_KEPT` | Maximum number of app bundle versions to keep | `5` |
| `ADMIN_USERNAME` | Initial admin username (bootstrap only) | `admin` |
| `ADMIN_PASSWORD` | Initial admin password (bootstrap only) | `admin` |
| `SYNKRONUS_RECOVERY_CREATE_USER` | Recovery admin username (must be paired with pass) | (empty) |
| `SYNKRONUS_RECOVERY_CREATE_PASS` | Recovery admin plaintext password (must be paired with user) | (empty) |

`ADMIN_USERNAME`/`ADMIN_PASSWORD` are only used when no users exist in the database.
`SYNKRONUS_RECOVERY_CREATE_USER` + `SYNKRONUS_RECOVERY_CREATE_PASS` provide an emergency recovery flow: on startup, Synkronus creates or overwrites that user as an admin. Remove those recovery variables after regaining access to avoid resetting credentials on each restart.

### Running the API

```bash
# Build the executable with injected version metadata
VERSION=$(git describe --tags --always --dirty)
COMMIT=$(git rev-parse HEAD)
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
go build -ldflags "-X github.com/opendataensemble/synkronus/pkg/version.version=${VERSION} -X github.com/opendataensemble/synkronus/pkg/version.commit=${COMMIT} -X github.com/opendataensemble/synkronus/pkg/version.buildTime=${BUILD_TIME}" -o bin/synkronus cmd/synkronus/main.go

# Run the executable
./bin/synkronus

# Or for quick development
go run cmd/synkronus/main.go
```

### Environment Variables

- `PORT`: HTTP port (default: 8080)
- `DB_CONNECTION`: Database connection string
- `JWT_SECRET`: Secret for JWT signing
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: bootstrap admin credentials (first user only)
- `SYNKRONUS_RECOVERY_CREATE_USER` / `SYNKRONUS_RECOVERY_CREATE_PASS`: startup recovery override (create/update admin user)

Mutable files use a fixed root of `<directory>/data` next to the `synkronus` executable (e.g. `/app/data` in the official image). App bundles always live under `<data>/app-bundle/active` and `<data>/app-bundle/versions`. `go run` / `go test` fall back to `./data` relative to cwd when the binary is in a Go temp build path.

## Deployment Architecture

For Docker-based deployment details (pre-built images, docker-compose configuration, and production setup), see `DOCKER.md` and `DEPLOYMENT.md`.

## API Documentation

API documentation is generated from the OpenAPI specification in `openapi/synkronus.yaml`.

## Sync protocol

For the sync protocol design details (record model, attachment handling, pagination, and conflict strategy), see [`documentation/sync-protocol.md`](./documentation/sync-protocol.md).

## License

MIT

## Dev. notes
Build with: `go build -ldflags "-X github.com/opendataensemble/synkronus/pkg/version.version=<version> -X github.com/opendataensemble/synkronus/pkg/version.commit=<commit> -X github.com/opendataensemble/synkronus/pkg/version.buildTime=<utc-rfc3339>" -o bin/synkronus.exe cmd/synkronus/main.go`
Run with: `./bin/synkronus.exe` or `go run cmd/synkronus/main.go`

On Windows PowerShell, you can use `./build.ps1` to build with version metadata from git.
Without `-ldflags` version injection, `/health` reports the default fallback version (`1.0.0`).

Icon: configured in versioninfo.json and built with goversioninfo `goversioninfo -o cmd/synkronus/resource.syso` to create a syso file next to main go file.