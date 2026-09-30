---
sidebar_position: 1
---

# API Reference

Complete REST API reference for the Synkronus server.

## Overview

The Synkronus API provides endpoints for data synchronization, authentication, app bundle management, attachment handling, and user management. All endpoints use JSON for request and response bodies, except for binary file operations.

## Base URL

The API base URL depends on your deployment:

- **Development**: `http://localhost:8080`
- **Production**: `https://synkronus.your-domain.com`

All API endpoints are prefixed with `/api` for portal compatibility, though many endpoints are also available without the prefix.

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Most endpoints require authentication, except for health checks and version information.

### Obtaining a Token

Authenticate using the login endpoint:

<Tabs>
  <TabItem value="curl" label="curl">

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your-username",
    "password": "your-password"
  }'
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

  </TabItem>
  <TabItem value="cli" label="CLI">

```bash
synk login --username your-username
```

The CLI will prompt for password interactively and store the token automatically.

  </TabItem>
  <TabItem value="portal" label="Portal">

1. Navigate to the Portal login page
2. Enter your username and password
3. Click "Login"
4. Token is stored automatically in your browser session

  </TabItem>
</Tabs>

### Using the Token

Include the token in the Authorization header:

<Tabs>
  <TabItem value="curl" label="curl">

```bash
curl -X GET http://localhost:8080/api/endpoint \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

  </TabItem>
  <TabItem value="cli" label="CLI">

The CLI automatically includes the token after login. No manual token handling needed:

```bash
synk status  # Uses stored token automatically
```

  </TabItem>
  <TabItem value="portal" label="Portal">

The Portal automatically includes the token in all API requests. No manual configuration needed.

  </TabItem>
</Tabs>

### Refreshing Tokens

Refresh an expired token:

<Tabs>
  <TabItem value="curl" label="curl">

```bash
curl -X POST http://localhost:8080/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "your-refresh-token"
  }'
```

  </TabItem>
  <TabItem value="cli" label="CLI">

The CLI automatically refreshes tokens when needed. If refresh fails, you'll be prompted to login again:

```bash
synk status  # Automatically refreshes if needed
```

  </TabItem>
  <TabItem value="portal" label="Portal">

The Portal automatically refreshes tokens in the background. If refresh fails, you'll be redirected to the login page.

  </TabItem>
</Tabs>

### Roles

The API supports role-based access control:

| Role | Description | Permissions |
|------|-------------|-------------|
| `read-only` | Read-only access | Can pull data, view app bundles, download attachments |
| `read-write` | Read and write access | All read-only permissions plus push data, create observations |
| `admin` | Administrative access | All read-write permissions plus user management, app bundle management |

## API Endpoints

### Health and Version

#### Health Check

```http
GET /health
```

Returns the health status of the service.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-01-14T10:30:00Z",
  "version": "1.0.0"
}
```

#### Get Version

```http
GET /version
GET /api/version
```

Returns detailed version information about the server.

**Response:**

```json
{
  "version": "1.0.0",
  "build_time": "2025-01-14T08:00:00Z",
  "git_commit": "abc123...",
  "go_version": "go1.22.0"
}
```

### Synchronization

#### Pull Data

Pulls records that have changed since the specified `change_id`.

<Tabs>
  <TabItem value="curl" label="curl">

```bash
curl -X POST http://localhost:8080/sync/pull \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "unique-client-identifier",
    "since_change_id": 0,
    "schema_types": ["observation"]
  }'
```

  </TabItem>
  <TabItem value="cli" label="CLI">

```bash
synk sync pull output.json --client-id unique-client-identifier
```

  </TabItem>
  <TabItem value="portal" label="Portal">

The Portal provides a UI for viewing synchronized data. Use the Observations tab to view pulled data.

  </TabItem>
</Tabs>

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `client_id` | string | Yes | Unique identifier for the client |
| `since_change_id` | integer | No | Last change ID seen by client (default: 0) |
| `schema_types` | array | No | Filter by schema types |

**Response:**

```json
{
  "records": [
    {
      "id": "obs-123",
      "schema_type": "observation",
      "schema_version": "1.0.0",
      "data": {...},
      "change_id": 1234,
      "last_modified": "2025-01-14T10:00:00Z",
      "deleted": false
    }
  ],
  "change_cutoff": 1234,
  "next_page_token": "eyJ...",
  "has_more": false
}
```

#### Push Data

Pushes local records to the server. Requires `read-write` or `admin` role.

<Tabs>
  <TabItem value="curl" label="curl">

```bash
curl -X POST http://localhost:8080/sync/push \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transmission_id": "550e8400-e29b-41d4-a716-446655440000",
    "client_id": "unique-client-identifier",
    "records": [
      {
        "id": "obs-123",
        "schema_type": "observation",
        "schema_version": "1.0.0",
        "data": {...}
      }
    ]
  }'
```

  </TabItem>
  <TabItem value="cli" label="CLI">

```bash
synk sync push data.json
```

The JSON file should contain observations in the sync format.

  </TabItem>
  <TabItem value="portal" label="Portal">

The Portal provides a UI for viewing and managing observations. Data is automatically pushed from Formulus app during sync.

  </TabItem>
</Tabs>

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `transmission_id` | string (UUID) | Yes | Client-generated unique ID for idempotency |
| `client_id` | string | Yes | Unique identifier for the client |
| `records` | array | Yes | Array of records to push |

**Response:**

```json
{
  "successes": [
    {
      "id": "obs-123",
      "change_id": 1234
    }
  ],
  "failures": [],
  "warnings": [],
  "change_cutoff": 1234
}
```

### App Bundle Management

#### Get Manifest

```http
GET /app-bundle/manifest
GET /api/app-bundle/manifest
Authorization: Bearer <token>
```

Returns the current app bundle manifest.

**Response:**

```json
{
  "version": "20250114-123456",
  "files": [
    {
      "path": "index.html",
      "hash": "abc123...",
      "size": 1024
    }
  ]
}
```

#### Download File

```http
GET /app-bundle/download/{path}
GET /api/app-bundle/download/{path}
Authorization: Bearer <token>
```

Downloads a specific file from the app bundle.

#### List Versions

```http
GET /app-bundle/versions
GET /api/app-bundle/versions
Authorization: Bearer <token>
```

Lists all available app bundle versions.

**Response:**

```json
{
  "versions": [
    {
      "version": "20250114-123456",
      "created_at": "2025-01-14T10:00:00Z",
      "active": true
    }
  ]
}
```

#### Upload Bundle

Uploads a new app bundle. Requires `admin` role.

<Tabs>
  <TabItem value="curl" label="curl">

```bash
curl -X POST http://localhost:8080/api/app-bundle/push \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "bundle=@app-bundle.zip" \
  -F "activate=true"
```

  </TabItem>
  <TabItem value="cli" label="CLI">

```bash
synk bundle push app-bundle.zip --activate
```

  </TabItem>
  <TabItem value="portal" label="Portal">

1. Navigate to the Portal
2. Go to "App Bundles"
3. Click "Upload Bundle"
4. Select your ZIP file
5. Check "Activate immediately" if desired
6. Click "Upload"

  </TabItem>
</Tabs>

#### Switch Version

```http
POST /app-bundle/switch/{version}
POST /api/app-bundle/switch/{version}
Authorization: Bearer <token>
```

Switches the active app bundle version. Requires `admin` role.

### Attachments

#### Get Manifest

```http
GET /attachments/manifest
Authorization: Bearer <token>

?after_change_id=0
```

Returns a manifest of attachments that have changed since the specified `change_id`.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `after_change_id` | integer | Only return attachments changed after this ID |

**Response:**

```json
{
  "operations": [
    {
      "attachment_id": "att-123",
      "operation": "upload",
      "change_id": 1234
    }
  ],
  "change_cutoff": 1234
}
```

#### Upload Attachment

```http
PUT /attachments/{attachment_id}
Authorization: Bearer <token>
Content-Type: application/octet-stream

<binary-data>
```

Uploads an attachment file. Requires `read-write` or `admin` role.

#### Download Attachment

```http
GET /attachments/{attachment_id}
Authorization: Bearer <token>

?quality=medium
```

Downloads an attachment file.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `quality` | string | For images: `original`, `large`, `medium`, `small` (default: `medium`) |

### User Management

#### Create User

```http
POST /users
POST /users/create
POST /api/users
POST /api/users/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newuser",
  "password": "secure-password",
  "role": "read-write"
}
```

Creates a new user. Requires `admin` role.

#### List Users

```http
GET /users
GET /api/users
Authorization: Bearer <token>
```

Lists all users. Requires `admin` role.

#### Delete User

```http
DELETE /users/delete/{username}
DELETE /api/users/delete/{username}
Authorization: Bearer <token>
```

Deletes a user. Requires `admin` role.

#### Change Password

```http
POST /users/change-password
POST /api/users/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "old-password",
  "new_password": "new-password"
}
```

Changes the password for the authenticated user.

#### Reset Password

```http
POST /users/reset-password
POST /api/users/reset-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "target-user",
  "new_password": "new-password"
}
```

Resets a user's password. Requires `admin` role.

### Data Export

#### Export to Parquet

```http
GET /dataexport/parquet
GET /api/dataexport/parquet
Authorization: Bearer <token>
```

Exports all observations as a Parquet ZIP archive. Requires `read-only` role or higher.

**Response:**

Returns a ZIP file containing Parquet files with observation data.

## API Versioning

The API supports versioning through the `x-api-version` header:

```http
x-api-version: 1.0.0
```

If omitted, the server defaults to the latest stable version.

### Version Discovery

```http
GET /api/versions
```

Returns all available API versions and their status.

## Error Handling

### Error Response Format

Errors follow RFC 7807 (Problem Details for HTTP APIs):

```json
{
  "type": "https://synkronus.org/docs/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more records failed validation",
  "errors": [
    {
      "recordId": "abc-123",
      "path": "data.age",
      "message": "Age must be a positive integer",
      "code": "TYPE_ERROR"
    }
  ]
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not Found |
| `409` | Conflict |
| `422` | Unprocessable Entity |
| `429` | Too Many Requests |
| `500` | Internal Server Error |
| `503` | Service Unavailable |

## Rate Limiting

The API implements rate limiting to prevent abuse. When rate limits are exceeded, the server returns `429 Too Many Requests` with a `Retry-After` header indicating when to retry.

## Pagination

List endpoints support cursor-based pagination:

- Include `next_page_token` from previous response
- Server returns `has_more` flag indicating if more data is available
- Default page size: 50 records
- Maximum page size: 500 records

## ETag Support

Many endpoints support ETags for caching:

```http
GET /app-bundle/manifest
If-None-Match: "abc123..."
```

If the resource hasn't changed, the server returns `304 Not Modified`.

## OpenAPI Specification

The complete OpenAPI specification is available at:

```
GET /openapi/synkronus.yaml
```

## Related Documentation

- [Synchronization Guide](/using/synchronization)
- [Configuration Guide](/guides/configuration)
- [Components Reference](/reference/components)
