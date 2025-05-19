# Synkronus Unit Tests

This document provides an overview of the unit tests in the Synkronus project, organized by test category.

## Authentication Tests (auth.test.ts)

- **POST /auth/login with missing username returns 400**
  - Validates that authentication requests without a username return a 400 Bad Request

- **POST /auth/login with missing password returns 400**
  - Validates that authentication requests without a password return a 400 Bad Request

- **POST /auth/login with invalid credentials returns 401**
  - Validates that authentication requests with incorrect credentials return a 401 Unauthorized

- **POST /auth/login returns token for valid credentials**
  - Validates that successful authentication returns a JWT token
  - Also tests token refresh functionality

- **POST /auth/refresh returns 401 without token**
  - Validates that token refresh requests without an authorization token return 401 Unauthorized

## Sync Service Tests (sync-service.test.ts)

- **SyncPull: should return records with pagination when authenticated**
  - Validates that authorized users can retrieve records with pagination

- **SyncPull: should filter by schema_types when specified**
  - Validates that records can be filtered by schema type

- **SyncPush: should process records and handle idempotent requests**
  - Validates that records can be pushed to the server
  - Tests that the same transmission can be sent multiple times (idempotency)

- **SyncPush: should detect and handle conflicts**
  - Validates conflict detection and resolution during record push

- **SyncPush: should validate records against schema**
  - Validates that records are validated against the schema before being accepted

## Health Check Tests (health.test.ts)

- **GET /health returns 200**
  - Validates that the health endpoint returns a 200 OK status

## App Bundle Tests (bundle.test.ts)

- **GET /app-bundle/manifest returns 401 without auth**
  - Validates that bundle manifest requests without authentication return 401 Unauthorized

- **GET /app-bundle/manifest returns 401 without auth (fetch)**
  - Duplicate test for bundle manifest authentication using fetch

- **GET /app-bundle/:path returns 401 without auth**
  - Validates that bundle file requests without authentication return 401 Unauthorized

## Attachments Tests (attachments.test.ts)

- **GET /attachments/manifest returns 401 without auth**
  - Validates that attachment manifest requests without authentication return 401 Unauthorized

- **GET /attachments/:id returns 401 without auth**
  - Validates that attachment file requests without authentication return 401 Unauthorized

## Form Specifications Tests (formspecs.test.ts)

- **GET /formspecs/:schemaType/:schemaVersion returns 401 without auth**
  - Validates that form specifications requests without authentication return 401 Unauthorized

- **GET /formspecs/:schemaType/:schemaVersion with invalid token returns 401**
  - Validates that form specifications requests with invalid tokens return 401 Unauthorized

## Test Structure

All tests use the `withTestServer` utility function that:
1. Creates a unique test configuration
2. Sets up a test server on a random port
3. Configures routes with the test configuration
4. Runs the test with the server baseUrl
5. Ensures proper cleanup of resources after tests complete
