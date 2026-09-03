# Synkronus API

Synkronus is a robust synchronization API for offline-first applications, built with Go.

## Features

- JWT-based authentication with role-based permissions
- Sync operations for pushing and pulling data
- HTTP timeouts suited to slow field radio (no short global read/write deadline; see [`pkg/httptimeout`](pkg/httptimeout/httptimeout.go) and [AGENTS.md](AGENTS.md#http-timeouts-slow-field-radio))
- Attachment management
- Form specifications for dynamic UI generation
- API versioning support
- ETag support for caching and efficiency
- Optional per-user last-seen presence for operators (see [documentation/user-presence.md](documentation/user-presence.md))

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
| `SYNKRONUS_ACCEPT_LEGACY_UNTYPED_TOKENS` | Temporarily accept JWTs issued before token-purpose claims were added | `true` |
| `SYNKRONUS_AUTH_MAX_BODY_BYTES` | Maximum login/refresh request body bytes | `16384` |
| `SYNKRONUS_AUTH_IP_ATTEMPTS` | Login/refresh attempts allowed per source in the IP window | `60` |
| `SYNKRONUS_AUTH_IP_WINDOW_SECONDS` | Per-source limiter window | `60` |
| `SYNKRONUS_AUTH_LOGIN_ATTEMPTS` | Failed logins allowed per source and username | `10` |
| `SYNKRONUS_AUTH_LOGIN_WINDOW_SECONDS` | Source-and-username failure window | `300` |
| `SYNKRONUS_AUTH_ACCOUNT_ATTEMPTS` | Failed logins allowed per username across sources | `100` |
| `SYNKRONUS_AUTH_ACCOUNT_WINDOW_SECONDS` | Account-wide failure window | `900` |
| `SYNKRONUS_AUTH_LIMITER_MAX_KEYS` | Maximum tracked keys in each in-memory limiter | `10000` |
| `SYNKRONUS_AUTH_TRUSTED_PROXY_CIDRS` | Comma-separated direct proxy CIDRs allowed to supply `X-Real-IP` | (empty) |
| `SYNKRONUS_MAX_ATTACHMENT_UPLOAD_BYTES` | Maximum attachment content bytes | `134217728` (128 MiB) |
| `SYNKRONUS_MAX_CONCURRENT_ATTACHMENT_UPLOADS` | Maximum concurrent attachment uploads | `4` |
| `SYNKRONUS_MAX_CONCURRENT_IMAGE_PROCESSING` | Maximum concurrent image decode/transform jobs | `2` |
| `SYNKRONUS_MAX_DECODED_IMAGE_DIMENSION_PX` | Maximum decoded image width or height | `16384` |
| `SYNKRONUS_MAX_DECODED_IMAGE_PIXELS` | Maximum decoded image pixel count | `40000000` |
| `ADMIN_USERNAME` | Initial admin username (bootstrap only) | `admin` |
| `ADMIN_PASSWORD` | Initial admin password (bootstrap only) | `admin` |
| `SYNKRONUS_RECOVERY_CREATE_USER` | Recovery admin username (must be paired with pass) | (empty) |
| `SYNKRONUS_RECOVERY_CREATE_PASS` | Recovery admin plaintext password (must be paired with user) | (empty) |
| `SYNKRONUS_IMAGE_COMPRESSION_LEVEL` | Upload-time image compression level (`0`-`10`) | `0` |
| `SYNKRONUS_IMAGE_MAX_WIDTH_PX` | Max width bound for upload-time downscaling (`0` disables) | `0` |
| `SYNKRONUS_IMAGE_MAX_HEIGHT_PX` | Max height bound for upload-time downscaling (`0` disables) | `0` |
| `SYNKRONUS_IMAGE_APPLY_EXIF_ORIENTATION` | Apply EXIF orientation normalization before resize/compression | `true` |

`ADMIN_USERNAME`/`ADMIN_PASSWORD` are only used when no users exist in the database.
`SYNKRONUS_RECOVERY_CREATE_USER` + `SYNKRONUS_RECOVERY_CREATE_PASS` provide an emergency recovery flow: on startup, Synkronus creates or overwrites that user as an admin. Remove those recovery variables after regaining access to avoid resetting credentials on each restart.

Authentication limits are in memory, apply independently to each Synkronus process, and reset when the process restarts. Multi-replica deployments should also enforce shared limits at the edge or use a shared limiter. Synkronus trusts `X-Real-IP` only when the direct socket peer is within `SYNKRONUS_AUTH_TRUSTED_PROXY_CIDRS`; configure only the exact CIDRs used by proxies you control. If it is empty, forwarded addresses are ignored. Excessive requests receive `429 Too Many Requests` with `Retry-After`.

New JWTs are purpose-bound as access or refresh tokens. `SYNKRONUS_ACCEPT_LEGACY_UNTYPED_TOKENS` exists only for a backwards-compatible rollout. Set it to `false` only after all token-issuing Synkronus instances are upgraded and at least the previous seven-day refresh-token lifetime, plus operational and clock-skew margin, has elapsed since the last legacy issuer was removed.

Attachment image processing is optional and only applies to supported image formats. If processing creates a smaller client-facing file, Synkronus stores it in `data/attachments/` and preserves the uploaded original in `data/attachments_uncompressed/` for export and explicit retrieval.

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
- `SYNKRONUS_IMAGE_COMPRESSION_LEVEL`: upload-time image compression (`0` disables, `10` strongest)
- `SYNKRONUS_IMAGE_MAX_WIDTH_PX` / `SYNKRONUS_IMAGE_MAX_HEIGHT_PX`: optional upload-time max bounding box (`0` disables axis)
- `SYNKRONUS_IMAGE_APPLY_EXIF_ORIENTATION`: normalize EXIF orientation before resize/compression

Mutable files use a fixed root of `<directory>/data` next to the `synkronus` executable (e.g. `/app/data` in the official image). App bundles always live under `<data>/app-bundle/active` and `<data>/app-bundle/versions`. `go run` / `go test` fall back to `./data` relative to cwd when the binary is in a Go temp build path.

## Deployment Architecture

For Docker-based deployment details (pre-built images, docker-compose configuration, and production setup), see `DOCKER.md` and `DEPLOYMENT.md`.

## API Documentation

API documentation is generated from the OpenAPI specification in `openapi/synkronus.yaml`.
Attachment download endpoints support `?original=true` to prefer full-resolution originals when available (with fallback to processed content). See [`openapi/synkronus.yaml`](./openapi/synkronus.yaml) for exact semantics.

## Sync protocol

For the sync protocol design details (record model, attachment handling, pagination, and conflict strategy), see [`documentation/sync-protocol.md`](./documentation/sync-protocol.md). Formulus adaptive page sizes (pull start 32 / floor 1, push start 4 / floor 1) are in `formulus/src/sync/networkProfile.ts`.

## License

MIT

## Dev. notes
Build with: `go build -ldflags "-X github.com/opendataensemble/synkronus/pkg/version.version=<version> -X github.com/opendataensemble/synkronus/pkg/version.commit=<commit> -X github.com/opendataensemble/synkronus/pkg/version.buildTime=<utc-rfc3339>" -o bin/synkronus.exe cmd/synkronus/main.go`
Run with: `./bin/synkronus.exe` or `go run cmd/synkronus/main.go`

On Windows PowerShell, you can use `./build.ps1` to build with version metadata from git.
Without `-ldflags` version injection, `/health` reports the default fallback version (`1.0.0`).

Icon: configured in versioninfo.json and built with goversioninfo `goversioninfo -o cmd/synkronus/resource.syso` to create a syso file next to main go file.