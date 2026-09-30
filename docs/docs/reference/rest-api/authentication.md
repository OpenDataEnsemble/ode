---
sidebar_position: 2
---

# Authentication API

API endpoints and examples for user authentication and authorization.

## Overview

The Synkronus API uses JWT (JSON Web Tokens) for authentication. All requests except `/health` and `/auth/login` require a valid JWT token in the `Authorization` header.

**Key Features:**
- **JWT-based**: Secure token-based authentication
- **Role-based Access Control (RBAC)**: Different permissions for admin vs. regular users
- **Token Expiration**: Tokens expire after 1 hour by default
- **Password Management**: Change password, password reset capabilities

## Getting Started

### 1. Obtain a Token (Login)

**Endpoint:**
```
POST /api/v1/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "your-password"
}
```

**Response (Success):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "user": {
    "id": "user-123",
    "username": "admin",
    "email": "admin@example.com",
    "roles": ["admin"]
  }
}
```

**Response (Failure):**
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Username or password is incorrect"
  }
}
```

**HTTP Status:**
- `200 OK` - Login successful
- `401 Unauthorized` - Invalid credentials
- `400 Bad Request` - Missing username or password

### 2. Use Token in Requests

Include the token in the `Authorization` header:

```bash
Authorization: Bearer <your-token>
```

**Complete Example:**
```bash
curl -X GET http://localhost:8080/api/v1/observations \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Authentication Endpoints

### Login

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "user",
  "password": "password"
}
```

Returns JWT token valid for 1 hour.

### Logout

```
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

Invalidates the current token (optional - tokens expire automatically).

**Response:**
```json
{
  "message": "Successfully logged out"
}
```

### Change Password

```
POST /api/v1/users/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "old-password",
  "new_password": "new-password"
}
```

**Response (Success):**
```json
{
  "message": "Password changed successfully"
}
```

**Response (Failure - 401):**
```json
{
  "error": {
    "code": "INVALID_PASSWORD",
    "message": "Current password is incorrect"
  }
}
```

### Get Current User Info

```
GET /api/v1/auth/me
Authorization: Bearer <token>
```

Returns the authenticated user's information and roles.

**Response:**
```json
{
  "data": {
    "id": "user-123",
    "username": "admin",
    "email": "admin@example.com",
    "roles": ["admin"],
    "created_at": "2026-01-15T10:30:00Z",
    "last_login": "2026-03-22T14:20:00Z"
  }
}
```

### Verify Token

```
GET /api/v1/auth/verify
Authorization: Bearer <token>
```

Verifies if a token is valid and not expired.

**Response (Valid):**
```json
{
  "valid": true,
  "expires_at": "2026-03-22T15:30:00Z"
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "error": "Token has expired"
}
```

## Authorization & Roles

### Role System

The API supports role-based access control:

| Role | Permissions |
|------|-------------|
| **admin** | Full access to all endpoints and user management |
| **user** | Read own observations, sync, upload attachments |

### Permission Checks

Most endpoints verify the authenticated user has appropriate permissions:

- **Public Endpoints** (no auth required):
  - `GET /health` - Health check

- **User Endpoints** (any authenticated user):
  - `GET /api/v1/observations` - View own observations
  - `POST /api/v1/sync/pull` - Sync data
  - `POST /api/v1/sync/push` - Sync data

- **Admin Endpoints** (admin role required):
  - `GET /api/v1/users` - List all users
  - `POST /api/v1/users` - Create new user
  - `DELETE /api/v1/users/{id}` - Delete user
  - `PUT /api/v1/app-bundle` - Deploy app bundle

## JWT Token Details

### Token Structure

JWT tokens contain three parts separated by dots: `header.payload.signature`

**Decoded Token Example:**

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "sub": "user-123",
  "username": "admin",
  "email": "admin@example.com",
  "roles": ["admin"],
  "iat": 1711103400,
  "exp": 1711107000
}
```

**Fields:**
- `sub` - Subject (user ID)
- `username` - Username
- `email` - User email
- `roles` - Array of user roles
- `iat` - Issued at (Unix timestamp)
- `exp` - Expiration time (Unix timestamp)

### Token Expiration

- **Default Expiration**: 1 hour (3600 seconds)
- **Refresh**: Requires re-login; no refresh token mechanism
- **Verification**: Tokens are verified using the server's `JWT_SECRET` environment variable

## Common Error Responses

### 401 Unauthorized

**Missing Token:**
```json
{
  "error": {
    "code": "MISSING_TOKEN",
    "message": "Authorization header is missing"
  }
}
```

**Invalid Token:**
```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "JWT token is malformed or invalid"
  }
}
```

**Expired Token:**
```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "JWT token has expired"
  }
}
```

### 403 Forbidden

**Insufficient Permissions:**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource"
  }
}
```

## Setup & Configuration

### Initial Admin User

On first deployment, create an admin user with environment variables:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-32-char-random-secret
```

**Generate a secure JWT secret:**
```bash
openssl rand -base64 32
```

### Changing Default Credentials

**Via API (after login):**

1. Login with default credentials
2. Call change password endpoint
3. Get new token

```bash
# 1. Login with default admin credentials
TOKEN=$(curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | jq -r '.token')

# 2. Change password
curl -X POST http://localhost:8080/api/v1/users/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "admin",
    "new_password": "strong-new-password"
  }'
```

## Security Best Practices

1. **Use HTTPS**: Always use HTTPS in production
2. **Strong Passwords**: Require strong, unique passwords
3. **Token Storage**: Store tokens securely (never in plain text)
4. **Token Rotation**: Implement re-authentication periodically
5. **Audit Logs**: Log authentication events for security monitoring
6. **JWT Secret**: Use a strong, randomly generated JWT secret
7. **Password Expiry**: Consider implementing password expiration policies

## Examples

### Login with bash & curl

```bash
#!/bin/bash

API_URL="http://localhost:8080/api/v1"
USERNAME="admin"
PASSWORD="password"

# Get token
RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $RESPONSE | jq -r '.token')
echo "Token: $TOKEN"

# Use token to get user info
curl -s -X GET "$API_URL/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Login with Python

```python
import requests
import json

API_URL = "http://localhost:8080/api/v1"

# Login
response = requests.post(
    f"{API_URL}/auth/login",
    json={"username": "admin", "password": "password"}
)
token = response.json()["token"]

# Use token
headers = {"Authorization": f"Bearer {token}"}
user_info = requests.get(f"{API_URL}/auth/me", headers=headers)
print(user_info.json())
```

### Login with JavaScript

```javascript
const API_URL = "http://localhost:8080/api/v1";

// Login
const response = await fetch(`${API_URL}/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    username: "admin", 
    password: "password" 
  }),
});

const { token } = await response.json();

// Use token
const userResponse = await fetch(`${API_URL}/auth/me`, {
  headers: { "Authorization": `Bearer ${token}` },
});

const userInfo = await userResponse.json();
console.log(userInfo);
```

## Next Steps

- [Sync Observations](/docs/reference/rest-api/sync) - Start syncing data
- [Upload Attachments](/docs/reference/rest-api/attachments) - Handle file uploads
- [Deploy App Bundle](/docs/reference/rest-api/app-bundle) - Deploy forms and question types

## Related Content

- [REST API Overview](/docs/reference/rest-api/overview)
- [Deployment Guide](/docs/guides/deployment) - Set up server credentials
- [Security](/docs/reference/security) - Security considerations

