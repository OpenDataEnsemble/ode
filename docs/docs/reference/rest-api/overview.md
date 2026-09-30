---
sidebar_position: 1
---

# REST API Overview

Complete REST API reference for Synkronus, the ODE backend server built in Go.

## Overview

Synkronus provides a comprehensive REST API for all mobile data collection operations. The API supports:

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Data Synchronization**: Bidirectional sync protocol for observations and attachments
- **App Bundle Management**: Deploy form definitions and question type extensions
- **User Administration**: Manage users, roles, and permissions
- **Attachment Storage**: Upload and download files associated with observations
- **Health & Status**: System health checks and version information

The API is designed to support offline-first applications and includes built-in support for conflict resolution, incremental updates, and efficient data transfer.

## Base URL

The API is served from the Synkronus server root with version-prefixed endpoints:

```
https://synkronus.your-domain.com/api/v1
```

**Local Development:**
```
http://localhost:8080/api/v1
```

**Health Check (No Auth Required):**
```
GET /health
```

## Authentication

All API requests (except `/health` and `/login`) require a JWT token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

**Getting a Token:**

1. **Login with Username & Password:**
   ```bash
   POST /auth/login
   Content-Type: application/json

   {
     "username": "admin",
     "password": "your-password"
   }
   ```

   **Response:**
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIs...",
     "expires_in": 3600
   }
   ```

2. **Use Token in Requests:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     https://synkronus.your-domain.com/api/v1/observations
   ```

**Token Details:**
- Tokens are valid for 1 hour by default
- Token expiration is indicated in the `expires_in` response field
- Tokens are signed using the `JWT_SECRET` environment variable (server-side)
- Each token contains the authenticated user's identity and roles

See [Authentication API](/docs/reference/rest-api/authentication) for detailed endpoint documentation.

## API Endpoints

### Core Endpoints

- **[Authentication](/docs/reference/rest-api/authentication)** - Login, logout, token management
- **[Sync](/docs/reference/rest-api/sync)** - Push and pull observations, conflict resolution
- **[Attachments](/docs/reference/rest-api/attachments)** - Upload and download binary files
- **[App Bundle](/docs/reference/rest-api/app-bundle)** - Deploy forms and question type extensions
- **[Users](/docs/reference/rest-api/users)** - User administration (admin only)

### Status & Health

- **GET /health** - Health check endpoint (HTTP 200 = healthy)
- **GET /api/v1/status** - Server status and version information

## HTTP Methods

The API uses standard REST conventions:

| Method | Purpose |
|--------|---------|
| `GET` | Retrieve data |
| `POST` | Create new resource or perform action |
| `PUT` | Update entire resource |
| `PATCH` | Partial resource update |
| `DELETE` | Delete resource |

## Response Format

All responses are JSON format. Successful responses return HTTP 200-201 with JSON body:

```json
{
  "data": { /* actual data */ },
  "meta": {
    "timestamp": "2026-03-22T10:30:00Z",
    "request_id": "req-12345"
  }
}
```

Error responses include appropriate HTTP status code and error details:

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "JWT token has expired",
    "details": { /* optional additional info */ }
  }
}
```

## Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success - Request succeeded |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Authenticated but not authorized |
| 404 | Not Found - Resource does not exist |
| 409 | Conflict - Sync conflict detected |
| 500 | Server Error - Internal server error |

## Rate Limiting

The API does not currently enforce rate limiting but reserves the right to do so in future versions.

## Versioning

- Current API version: `v1` (base URL: `/api/v1`)
- API is backward compatible within major versions
- Breaking changes will be indicated with a new major version number

## OpenAPI Specification

The complete API specification is available in OpenAPI 3.0 format:

- **Source**: [synkronus/openapi/synkronus.yaml](https://github.com/OpenDataEnsemble/ode/blob/dev/synkronus/openapi/synkronus.yaml) in the GitHub repository
- **Format**: OpenAPI 3.0.0
- **Contains**: All endpoints, request/response schemas, authentication details
- **Usage**: Use with tools like Swagger UI, ReDoc, or Postman for interactive documentation

## API Integration Examples

### Authentication Example

```bash
# 1. Login to get token
TOKEN=$(curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  | jq -r '.token')

# 2. Use token in subsequent requests
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/observations
```

### Sync Example

```bash
# Pull observations (with change tracking)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/sync/pull?since=0"

# Push observations
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @observations.json \
  http://localhost:8080/api/v1/sync/push
```

## Next Steps

- **Get Started with Sync**: See [Sync API](/docs/reference/rest-api/sync) for data synchronization
- **Handle Attachments**: See [Attachments API](/docs/reference/rest-api/attachments) for file uploads/downloads
- **Deploy Forms**: See [App Bundle API](/docs/reference/rest-api/app-bundle) for form deployment
- **Authenticate**: See [Authentication API](/docs/reference/rest-api/authentication) for detailed auth endpoints

## Support

- **OpenAPI Spec**: [synkronus/openapi/synkronus.yaml](https://github.com/OpenDataEnsemble/ode/blob/dev/synkronus/openapi/synkronus.yaml)
- **Source Code**: [github.com/OpenDataEnsemble/ode](https://github.com/OpenDataEnsemble/ode)
- **GitHub Issues**: [Report bugs](https://github.com/OpenDataEnsemble/ode/issues)
- **Discussions**: [Ask questions](https://github.com/OpenDataEnsemble/ode/discussions)

