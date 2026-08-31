---
sidebar_position: 8
---

# Synkronus Server Reference

Complete technical reference for the Synkronus server component.

> **Want to get a server running quickly?** See the [Synkronus Quickstart](../getting-started/synkronus-quickstart.md) guide for a simple Docker/Podman setup with automated TLS provisioning.

> **IT / production hosting?** See [Server Architecture for IT](../guides/server-architecture-for-it) and [Security reference](./security).

## Overview

Synkronus is a robust synchronization API server built with Go. It provides RESTful endpoints for data synchronization, app bundle management, attachment handling, user management, and form specifications. The server uses PostgreSQL for data storage and JWT for authentication.

## Released container images

Production deployments should pin a release tag rather than `:latest`:

```
ghcr.io/opendataensemble/synkronus:v1.3.0
```

Images are published on [GitHub Container Registry](https://github.com/OpenDataEnsemble/ode/pkgs/container/synkronus) for each [ODE release](https://github.com/OpenDataEnsemble/ode/releases).

## Architecture

### Technology Stack

- **Language**: Go 1.22+
- **Database**: PostgreSQL 12+
- **Authentication**: JWT (JSON Web Tokens)
- **API**: RESTful HTTP API
- **Documentation**: OpenAPI 3.0 specification

### HTTP timeouts

Go `ReadTimeout` / `WriteTimeout` are **unset**. Those clocks start when the request begins, so a short cap (historically 15s) aborted legitimate sync, photo, and app-bundle transfers on slow radio.

| Bound | Duration | Scope |
|-------|----------|--------|
| Request headers (`ReadHeaderTimeout`) | 25s | Slowloris protection only |
| Login / refresh | 25s | `http.TimeoutHandler` on `/api/auth/*` only |
| Keep-alive idle | 60s | Between requests |
| Reverse proxy send/read | 600s | Reference `nginx.conf` in the Synkronus tree |

Do not wrap `/sync`, attachments, or bundle download in a short handler timeout. Pull `limit` default is 50, maximum 500 (OpenAPI). Formulus requests smaller pages first — see [Synchronization — How Formulus sizes each request](/docs/using/synchronization#how-formulus-sizes-each-request).

### Project Structure

```
synkronus/
├── cmd/synkronus/         # Application entry point
├── internal/              # Private application code
│   ├── api/               # API definition and OpenAPI integration
│   ├── handlers/          # HTTP request handlers
│   ├── models/            # Domain models
│   ├── repository/        # Data access layer
│   └── services/          # Business logic
└── pkg/                   # Public libraries
    ├── auth/              # Authentication utilities
    ├── database/          # Database connection and migrations
    ├── logger/            # Structured logging
    ├── httptimeout/       # ReadHeaderTimeout, auth TimeoutHandler
    ├── middleware/        # HTTP middleware
    └── openapi/           # OpenAPI generated code
```

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT signing (generate with `openssl rand -base64 32`) | `AbCd1234=` |
| `DB_CONNECTION` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/synkronus` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `MAX_VERSIONS_KEPT` | `5` | Number of app bundle versions to retain |
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | `admin` | Initial admin password (change after first login!) |

### Database Configuration

**PostgreSQL Requirements:**
- PostgreSQL 12+ (13+ recommended)
- Must have `uuid-ossp` extension enabled
- Connection should support SSL (optional but recommended in production)

**Example connection string:**
```
postgres://synkronus_user:SecurePassword123@db.example.com:5432/synkronus?sslmode=require
```

**Parameters:**
- `sslmode=require` - Enforce SSL
- `sslmode=disable` - No SSL (local dev only)
- `connect_timeout=10` - Connection timeout in seconds

### File Storage Configuration

The server stores files at `<data_root>/app-bundle/` and `<data_root>/attachments/`:

```
/app/data/                           # Data root (from binary location)
├── app-bundle/
│   ├── active/                      # Active app bundle
│   │   ├── forms/
│   │   │   ├── household.json
│   │   │   └── hh_person.json
│   │   ├── question_types/
│   │   └── metadata.json
│   └── versions/                    # Historical versions
│       ├── 1.0.0/
│       ├── 0.9.0/
│       └── ...
└── attachments/                     # Observation attachments (photos, files)
    ├── obs-123-photo.jpg
    ├── obs-456-audio.m4a
    └── ...
```

**Docker Volume Mount:**
```yaml
volumes:
  - synkronus_data:/app/data  # Single volume containing all mutable data
```

**Directory Permissions (Docker):**
- Container runs as user `synkronus` (uid=1000, gid=1000)
- Host directory must be owned by `1000:1000`
- Example fix: `sudo chown -R 1000:1000 /host/path/to/data`

## Core Features

### Data Synchronization

- **Bidirectional Sync**: Push and pull operations
- **Incremental Updates**: Only sync changed data using `change_id` cursor
- **Conflict Detection**: Hash-based conflict detection
- **Attachment Handling**: Separate sync for binary files
- **Idempotent Operations**: Safe to retry without duplication
- **Client Tracking**: Track which changes each client has seen

### App Bundle Management

- **Version Control**: Multiple bundle versions
- **Activation**: Switch active bundle version
- **File Serving**: Serve bundle files to clients
- **Manifest Generation**: Automatic manifest creation

### Attachment Handling

- **Binary Storage**: Store attachments separately from observations
- **Immutable Attachments**: Once uploaded, cannot be modified
- **Efficient Transfer**: Optimized for large files
- **Manifest System**: Track attachment changes

### User Management

- **JWT Authentication**: Secure token-based auth
- **Role-Based Access**: read-only, read-write, admin roles
- **User CRUD**: Create, read, update, delete users
- **Password Management**: Secure password handling

### Form Specifications

- **Versioned Forms**: Multiple versions per form type
- **Schema Storage**: Store JSON schemas
- **UI Schema Support**: Store UI layout definitions
- **Version Negotiation**: Client requests specific versions

## API Endpoints

### Authentication

#### POST /auth/login

Authenticate user and receive JWT token.

**Request:**
```json
{
  "username": "user",
  "password": "password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

#### POST /auth/refresh

Refresh expired JWT token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Synchronization

#### POST /sync/pull

Pull changes from server.

**Request:**
```json
{
  "clientId": "client-123",
  "currentVersion": 100,
  "schemaTypes": ["survey", "visit"]
}
```

**Response:**
```json
{
  "changes": {
    "observations": [...]
  },
  "timestamp": 150
}
```

#### POST /sync/push

Push changes to server.

**Request:**
```json
{
  "clientId": "client-123",
  "changes": {
    "observations": [...]
  }
}
```

**Response:**
```json
{
  "timestamp": 150,
  "conflicts": []
}
```

### App Bundles

#### GET /app-bundle/manifest

Get current app bundle manifest.

**Response:**
```json
{
  "version": "20250114-123456",
  "files": [...],
  "hash": "abc123..."
}
```

#### GET `/app-bundle/download/{path}`

Download app bundle file.

**Path Parameters:**
- `path`: File path within bundle

#### POST /app-bundle/push

Upload new app bundle (admin only).

**Request:** Multipart form with `bundle` file

**Response:**
```json
{
  "version": "20250114-123456",
  "manifest": {...}
}
```

#### GET /app-bundle/versions

List all app bundle versions.

#### POST /app-bundle/switch

Switch active bundle version (admin only).

### Attachments

#### GET /attachments/manifest

Get attachment manifest.

**Query Parameters:**
- `since`: Timestamp to get changes since

#### GET `/attachments/{id}`

Download attachment file.

#### POST /attachments

Upload attachment (multipart form).

### Form Specifications

#### GET `/formspecs/{formType}/{version}`

Get form specification.

**Path Parameters:**
- `formType`: Form type identifier
- `version`: Form version

#### POST /formspecs

Create form specification (admin only).

### Users

#### GET /users

List all users (admin only).

#### POST /users/create

Create new user (admin only).

#### GET `/users/{username}`

Get user details.

#### PUT `/users/{username}`

Update user (admin only).

#### DELETE `/users/{username}`

Delete user (admin only).

### Data Export

#### GET /data/export

Export observations as Parquet ZIP.

**Query Parameters:**
- `format`: Export format (parquet, json, csv)

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | HTTP server port | `8080` | No |
| `DB_CONNECTION` | PostgreSQL connection string | - | Yes |
| `JWT_SECRET` | Secret for JWT signing | - | Yes |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` | No |
| `APP_BUNDLE_PATH` | Directory for app bundles | `./data/app-bundles` | No |
| `MAX_VERSIONS_KEPT` | Maximum bundle versions to keep | `5` | No |
| `ADMIN_USERNAME` | Initial admin username | `admin` | No |
| `ADMIN_PASSWORD` | Initial admin password | `admin` | No |

### Example Configuration

```bash
PORT=8080
DB_CONNECTION=postgres://user:password@localhost:5432/synkronus?sslmode=disable
JWT_SECRET=your-secret-key-change-this-in-production
LOG_LEVEL=info
APP_BUNDLE_PATH=./data/app-bundles
MAX_VERSIONS_KEPT=5
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
```

## Database Schema

### Observations Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `form_type` | VARCHAR | Form type identifier |
| `data` | JSONB | Observation data |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `deleted` | BOOLEAN | Soft delete flag |
| `version` | INTEGER | Version number (auto-increment) |

### Users Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `username` | VARCHAR | Unique username |
| `password_hash` | VARCHAR | Hashed password |
| `role` | VARCHAR | User role (read-only, read-write, admin) |
| `created_at` | TIMESTAMP | Creation timestamp |

### App Bundle Versions Table

| Column | Type | Description |
|--------|------|-------------|
| `version` | VARCHAR | Version identifier |
| `is_active` | BOOLEAN | Active version flag |
| `created_at` | TIMESTAMP | Creation timestamp |

## Synchronization Protocol

### Two-Phase Sync

#### Phase 1: Observation Sync

1. Client requests changes via `/sync/pull`
2. Server returns observations changed since client's version
3. Client applies changes locally
4. Client pushes local changes via `/sync/push`
5. Server applies changes and returns new version

#### Phase 2: Attachment Sync

1. Client requests attachment manifest
2. Server returns list of attachments to download
3. Client downloads missing attachments
4. Client uploads pending attachments
5. Server confirms receipt

### Conflict Resolution

Conflicts are detected when:

- Same observation modified on multiple clients
- Observation deleted on one client, modified on another

Resolution strategy:

- **Last Write Wins**: Most recent change wins
- **Version Tracking**: Version numbers prevent conflicts
- **Client Responsibility**: Clients handle conflict resolution

## Security

### Authentication

- **JWT Tokens**: Secure token-based authentication
- **Token Expiration**: Tokens expire after configured time
- **Refresh Tokens**: Long-lived refresh tokens
- **Password Hashing**: bcrypt password hashing

### Authorization

- **Role-Based Access**: Three roles (read-only, read-write, admin)
- **Endpoint Protection**: Middleware protects admin endpoints
- **Token Validation**: All requests validate JWT tokens

### Data Protection

- **HTTPS**: Recommended for production
- **Input Validation**: All inputs validated
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Input sanitization

## Deployment

### Docker Deployment

See [Deployment Guide](/guides/deployment) for complete deployment instructions.

### Quick Start

```bash
docker compose up -d
```

### Production Setup

1. Configure environment variables
2. Set up PostgreSQL database
3. Configure reverse proxy (Nginx)
4. Set up SSL/TLS certificates
5. Configure monitoring and logging

## Monitoring

### Health Check

```bash
curl http://localhost:8080/health
```

Returns `OK` if server is healthy.

### Logging

Structured logging with levels:

- **Debug**: Detailed debugging information
- **Info**: General informational messages
- **Warn**: Warning messages
- **Error**: Error messages

### Metrics

Key metrics to monitor:

- Request rate
- Response times
- Error rates
- Database connection pool
- Active sync operations

## Performance

### Optimization Strategies

- **Connection Pooling**: PostgreSQL connection pool
- **Query Optimization**: Indexed database queries
- **Caching**: Cache app bundle manifests
- **Compression**: Compress responses when possible

### Scaling

- **Horizontal Scaling**: Multiple server instances
- **Load Balancing**: Distribute requests across instances
- **Database Replication**: Read replicas for database
- **CDN**: Serve static files via CDN

## Troubleshooting

### Common Issues

**Database Connection Errors:**
- Verify PostgreSQL is running
- Check connection string format
- Verify database exists
- Check user permissions

**Authentication Failures:**
- Verify JWT_SECRET is set
- Check token expiration
- Verify user credentials

**Sync Failures:**
- Check database connectivity
- Verify client version tracking
- Review server logs

## API Versioning

The API supports versioning via the `x-api-version` header:

```http
x-api-version: 1.0.0
```

Version negotiation allows clients to request specific API versions.

## Related Documentation

- [API Reference](/reference/api) - Complete API documentation
- [Deployment Guide](/guides/deployment) - Production deployment
- [Configuration Guide](/guides/configuration) - Configuration options
- [Synkronus CLI Reference](/reference/synkronus-cli) - CLI tool

