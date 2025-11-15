## Synkronus Synchronization Protocol Design

### 🎯 Objectives
- Efficient offline-capable synchronization
- Minimal client-server round trips
- Robust conflict detection and resolution
- Stateless, scalable server-side design
- Simple to reason about but extensible

---

### ✅ Core Sync Design
- Pull → Push model: client pulls recent changes, then pushes local changes
- Each record contains:
  - `id`
  - `schemaType`
  - `schemaVersion`
  - `data`
  - `hash` (computed from `data`, `schemaType`, and `schemaVersion`)
  - `last_modified` (server-assigned timestamp; order can be inferred from `change_id`, so strict monotonicity is not required)
  - `last_modified_by` (username from JWT)
  - `change_id` (strictly increasing integer, server-assigned)
  - `deleted` (soft delete flag)
  - `origin_client_id` (for provenance)

---

### 🔄 Change Detection Strategy
#### ✅ Cursor-based with `change_id`
- Each record has a strictly increasing `change_id`, assigned server-side
- Client stores last seen `change_id` per `schemaType`
- Pull returns all records where `change_id > last_seen`

**Pros:**
- No dependence on system clocks
- No ambiguity about ordering
- Enables clean pagination, partial pull, and deduplication

**Server considerations:**
- Maintain a per-record global `change_id`
- Mirror `change_id` to audit log

---

### 🔍 Record Model Philosophy
> Each **form submission is an entity**.

- Each form type (JSONForms schema) defines an implicit "entity" type
- This matches how ODK-X and DHIS2 Tracker often operate
- SchemaType + Version provides namespacing for evolution

**Evaluation:**
- ✅ Good for flexibility and multi-purpose platforms
- 🚫 Makes cross-form relationships more complex (if needed)

---

- The server validates that uploaded attachments match the `_hash` declared in the record reference
- If an attachment is missing when a record references it, `_sync_state` remains `awaiting_upload`
- If an attachment is deleted but still referenced, `_sync_state` becomes `missing`
- Clients are responsible for checking `_sync_state` before using attachments

### 🔐 Conflict Handling
- If server’s hash ≠ client’s last seen hash, treat as conflict
- Allow server to:
  - Accept overwrite with warning
  - Store previous version in `conflicts` table
- Conflict info returned in `warnings` array during push

---

### 🗂 Attachments
- Managed as a separate collection, but referenced from within record `data`
- Each file has:
  - `id` (UUID or content-addressed hash, assigned by client)
  - `hash` (SHA-256)
  - `size`
  - `last_modified` (server-assigned, monotonic)
  - `change_id` (for consistent delta sync)
  - `sync_state` (e.g. `awaiting_upload`, `synced`, `orphaned`, `missing`)

- In `data`, attachments are represented as objects with structured metadata. Example:
  ```jsonjson
  {
    "profile_photo": {
      "_id": "att-uuid-1",
      "_sync_state": "awaiting_upload",
      "_hash": "abc123..."
    },
    "greeting": {
      "_id": "att-uuid-2",
      "_sync_state": "synced",
      "_hash": "def456..."
    }
  }
  ```

- Server indexes attachment references at push time, and tracks missing or orphaned attachments
- If a record references an attachment not yet uploaded, server logs it with `_sync_state = awaiting_upload`
- Once uploaded, attachment `sync_state` transitions to `synced` and `change_id` is incremented
- `/attachments/manifest?after_change_id=XYZ` provides attachment delta sync
- Clients are responsible for tracking which attachments they have downloaded
- Orphaned attachments (not referenced by any record for a defined window) are eligible for cleanup
- Optional: `/attachments/cleanup` endpoint for explicit removal
- ETag support for efficient downloading

---

### 📜 Schema Evolution
- Each record points to `schemaType` + `schemaVersion`
- Never mutate existing record structure
- Schema validation performed at push using version-specific schema
- Future: tooling to migrate data across schema versions

---

### 🔐 Authentication
- All routes require JWT with role claim
- Roles: `read-only`, `read-write`
- Token refresh support

---

### 🔢 API Versioning

#### Semantic Versioning
- API versions follow [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH)
- Major version increments indicate breaking changes requiring client updates
- Minor version increments add new functionality in a backward-compatible manner
- Patch version increments represent backward-compatible bug fixes

#### Version Negotiation
- Clients specify desired API version through the `x-api-version` header
- Example: `x-api-version: 1.2.0`
- If omitted, the server defaults to the latest stable version
- Server respects highest compatible version less than or equal to requested version

#### Version Lifecycle
- **Supported**: Currently maintained and recommended for use
- **Deprecated**: Still functional but marked for future removal
- **Sunset**: No longer available, returns 410 Gone

#### Version Discovery
- GET `/api/versions` endpoint lists all available API versions and their status
- Responses include `x-api-version-used` header indicating the version used to process the request
- 406 Not Acceptable returned if requested version cannot be satisfied

#### Backward Compatibility Guarantees
- Within the same major version:
  - Existing endpoints will never be removed
  - Required request parameters will never be added
  - Response field semantics will never change
  - New optional fields may be added to responses
  - New endpoints may be added
- Major version upgrades will be maintained for at least 12 months after a new major version is released

---

### 🧪 Change Logging
- `sync_log` table: records who synced, when, and with what result
- `audit_log`: append-only log of all updates with `old_hash`, `new_hash`, `change_id`, and `user`

---

### 📦 Optional Enhancements
- Partial pull (filter by form type or custom query)
- Soft delete cleanup mechanism
- Record provenance (which user/client created/updated it)

---

### 📄 Pagination and Batch Processing

#### Cursor-based Pagination
- All sync endpoints support pagination using cursor-based tokens
- Each response includes a `next_page_token` when more data is available
- Tokens are opaque, base64-encoded strings containing cursors and limits

```json
{
  "records": [...],
  "next_page_token": "eyJsYXN0X2NoYW5nZV9pZCI6MTIzNCwibGltaXQiOjUwfQ==",
  "has_more": true
}
```

#### Batch Sizes
- **Default batch size**: 50 records
- **Maximum batch size**: 500 records
- Clients can request smaller batches with `limit` parameter
- Clients MUST NOT assume all responses will contain the requested number of records

#### Timeout Handling
- Server sets a reasonable timeout for each batch operation (typically 30 seconds)
- If timeout is reached during processing, the server returns a partial result
- Partial results include a valid `next_page_token` to resume from
- Clients MUST check `has_more` flag to determine if additional requests are needed

#### Implementation Guidance
- Clients SHOULD retry with exponential backoff on 429 or 5xx responses
- Servers SHOULD implement rate limiting based on response time metrics
- For massive datasets, servers MAY return a 202 Accepted with a job ID

---

### 🗜️ Attachment Processing

#### Image Quality Variants
The server automatically generates multiple quality variants for supported image types:

| Quality Level | Description | Max Dimensions | Usage |
|---------------|-------------|----------------|-------|
| `original`    | Unmodified source file | No limit | Archive, printing |
| `large`       | High quality | 2048px | Detailed viewing |
| `medium`      | Standard quality | 1024px | Normal display |
| `small`       | Thumbnail | 320px | Previews, lists |

- Variants maintain aspect ratio and are never enlarged
- Metadata (e.g., EXIF) is preserved in `original` but stripped from other variants
- For non-image files, only `original` is available

#### Requesting Variants
- Client specifies desired quality via `quality` query parameter
- Example: `/attachments/123?quality=medium`
- If omitted, `medium` is the default for images
- Server responds with appropriate `Content-Type` header
- The response includes a `vary: accept-encoding, quality` header

---

### 🔁 Idempotent Operations and Retry Handling

#### Idempotent Push Operations
- Each sync push operation MUST include a client-generated `transmission_id` (UUID v4)
- Server stores this ID with successful operations for a retention period (default: 24 hours)
- Duplicate pushes with the same `transmission_id` within the retention period are ignored
- Server returns the original success response for duplicate operations

```json
{
  "transmission_id": "550e8400-e29b-41d4-a716-446655440000",
  "records": [...],
  "change_cutoff": 1234
}
```

#### Failure Recovery
- For network failures during transmission, clients MUST retry with the same `transmission_id`
- For 4xx errors (except 429), clients SHOULD NOT retry with the same payload
- For 5xx errors or 429, clients SHOULD implement exponential backoff
- Maximum retry count: 5 attempts with delays of 1s, 2s, 4s, 8s, 16s

#### Partial Success Handling
- Server may accept some records but reject others
- Response includes arrays of `successes` and `failures`
- On retry, client SHOULD only resend failed records
- Each record in `failures` includes error details and validation messages

---

### ✅ Data Validation Error Handling

#### HTTP Status Codes
- **400 Bad Request**: Malformed request structure
- **422 Unprocessable Entity**: Schema validation failures
- **409 Conflict**: Conflicts with server state
- **413 Payload Too Large**: Request exceeds size limits

#### Validation Error Format
Validation errors follow RFC 7807 (Problem Details for HTTP APIs) format:

```json
{
  "type": "https://synkronus.org/docs/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more records failed validation",
  "errors": [
    {
      "recordId": "abc-123",
      "schemaType": "patient",
      "schemaVersion": "1.2",
      "path": "data.age",
      "message": "Age must be a positive integer",
      "code": "TYPE_ERROR"
    }
  ]
}
```

#### Handling Schema Evolution Errors
- If server doesn't support the client's schema version:
  - Returns 422 with `"code": "UNSUPPORTED_SCHEMA_VERSION"`
  - Includes `supported_versions` array in response
- If schema deprecated but still supported:
  - Accepts the data
  - Includes a warning in response
  - Suggests migration timeline

---

### 🔒 Transport and Encryption
- **Transport layer**:
  - Use standard HTTPS REST API
  - Enable gzip compression at reverse proxy (e.g. Caddy, Nginx) 
  - Server MUST support compressed request/response bodies (gzip, deflate, brotli)
  - All endpoints support HTTP/2 for efficient connection reuse
  - Avoids complexity of gRPC/protobuf while remaining debuggable
- **In transit**: HTTPS enforced with Let's Encrypt
- **At rest**:
  - Database encryption via Postgres (at-rest encryption provided by the underlying database / storage layer)
  - Attachments optionally encrypted at rest
- All secrets stored via `.env` or environment variables

---

### 🧭 Inspiration Sources
- **ODK Classic**: simple full pull/push
- **ODK-X**: delta + sync log + client-side IDs
- **DHIS2 Tracker**: metadata-driven forms with conflict tracking

