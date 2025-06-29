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

### Prerequisites

- Go 1.22 or higher
- Postgresql

### Installation

```
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
| `APP_BUNDLE_PATH` | Directory path for app bundles | `./data/app-bundles` |
| `MAX_VERSIONS_KEPT` | Maximum number of app bundle versions to keep | `5` |

### Running the API

```
# Build the executable
go build -o bin/synkronus cmd/synkronus/main.go

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

## Deployment Architecture

Synkronus is designed to be deployed as a single Docker container with multiple processes managed by a supervisor:

```
┌─────────────────────────────────────────┐
│             Docker Container            │
│                                         │
│  ┌─────────┐        ┌───────────────┐   │
│  │  Nginx  │───────▶│   Synkronus   │   │
│  │         │        │   Go Server   │   │
│  └─────────┘        └───────────────┘   │
│       │                     │           │
│       │                     │           │
│       ▼                     ▼           │
│  ┌─────────┐        ┌───────────────┐   │
│  │ Static  │        │  PostgreSQL   │   │
│  │   UI    │        │   Database    │   │
│  └─────────┘        └───────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Benefits

- **Simple deployment**: Single container to manage
- **Proper separation of concerns**: Nginx handles TLS, static files, and proxying
- **Easy scaling**: Can be deployed to any container orchestration system

### Implementation Details

- **TLS/Let's Encrypt**: Automatic certificate management via Certbot with Nginx
- **UI Integration**: Static SPA (Single Page Application) served by Nginx
- **API Proxying**: Nginx proxies API requests to the Go server
- **Data Persistence**: PostgreSQL database for robust data storage
- **Configuration**: Environment variables for flexible deployment options

## API Documentation

API documentation is generated from the OpenAPI specification in `openapi/synkronus.yaml`.

## Sync protocol

Attachments (e.g. photos, audio recordings) are **binary blobs** referenced by observations. They are stored and transferred separately from the observation metadata to simplify synchronization, improve offline support, and reduce conflicts.

### Core design principles

- **Immutable attachments**  
  - Once an attachment is uploaded, it cannot be modified in place.  
  - Any "update" requires creating a new attachment with a new unique ID (typically a GUID).

- **Separation of concerns**  
  - Observation records sync via `/sync/pull` and `/sync/push`.  
  - Attachments are uploaded and downloaded via dedicated endpoints.  
  - This design ensures simpler, smaller payloads and clearer transaction boundaries.

- **Stateless server**  
  - The server does not maintain per-client state about which attachments have been uploaded or downloaded.  
  - Clients manage their own attachment sync state.

### Conflict avoidance

- Because attachment IDs are generated as GUIDs client-side, filename clashes are extremely unlikely.
- The server can include a simple existence check to reject accidental overwrites.

### Clean-up and maintenance

- Server can run periodic jobs to:
- Identify orphaned attachments (no observation references).
- Prune old or unused files.
- Enforce retention policies.

### Security considerations

- Require authentication (e.g. bearer tokens) for all attachment endpoints.
- Validate file types and sizes on upload to prevent abuse.
- Optionally scan files for malware.

### Example implementation notes

- Filesystem storage for MVP:
- Simple to implement and inspect.
- Suitable for single-server deployments.

- Cloud object storage (e.g. S3, GCS) for future:
- Supports presigned URLs for direct client upload/download.
- Handles scalability and redundancy.
- Reduces server load.

### Advantages of this server design

- Keeps observation data sync API simple and JSON-only.  
- Supports large binary payloads without bloating /sync/push or /sync/pull requests.  
- Encourages incremental, resumable, offline-friendly sync strategies.  
- Leaves attachment sync policy (e.g. lazy, bulk, partial) up to the client.  
- Scales from MVP file-system storage to cloud-native solutions.

## License

MIT

## Dev. notes
Build with: `go build -o bin/synkronus.exe cmd/synkronus/main.go`
Run with: `./bin/synkronus.exe` or `go run cmd/synkronus/main.go`

Icon: configured in versioninfo.json and built with goversioninfo `goversioninfo -o cmd/synkronus/resource.syso` to create a syso file next to main go file.