# Attachment Manifest API Implementation Guide

## Overview

This document specifies the implementation requirements for the new **Attachment Manifest API** endpoint that enables efficient, version-based synchronization of attachments between clients and the Synkronus server.

## Background

The current attachment synchronization approach requires clients to scan all observation data to determine which attachments to download, which doesn't scale well. The new approach uses the existing version-based synchronization system to provide incremental attachment manifests.

## API Endpoint Specification

### Endpoint: `POST /attachments/manifest`

**Purpose**: Returns a manifest of attachment operations (download/delete) that need to be performed since a specified data version.

**Authentication**: Bearer token required (read-only or read-write access)

**Request Body**:

```json
{
  "client_id": "mobile-app-123",
  "since_version": 42
}
```

**Response Body**:

```json
{
  "current_version": 45,
  "operations": [
    {
      "operation": "download",
      "attachment_id": "abc123-def4-5678-9012-345678901234.jpg",
      "download_url": "https://api.example.com/attachments/abc123-def4-5678-9012-345678901234.jpg",
      "size": 524288,
      "content_type": "image/jpeg",
      "version": 43
    },
    {
      "operation": "delete",
      "attachment_id": "old456-file7-8901-2345-678901234567.png",
      "version": 44
    }
  ],
  "total_download_size": 524288,
  "operation_count": {
    "download": 1,
    "delete": 1
  }
}
```

## Implementation Requirements

### 1. Database Schema Requirements

The implementation should leverage the existing version-based synchronization system. You'll need to track attachment operations alongside observation changes.

**Recommended approach**:

- Use the existing `sync_version` table for global version tracking
- Create an `attachment_operations` table to track attachment changes:

```sql
CREATE TABLE attachment_operations (
  id SERIAL PRIMARY KEY,
  attachment_id VARCHAR(255) NOT NULL,
  operation VARCHAR(10) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  client_id VARCHAR(255), -- NULL for operations affecting all clients
  version BIGINT NOT NULL,
  size INTEGER, -- NULL for delete operations
  content_type VARCHAR(255), -- NULL for delete operations
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attachment_operations_version ON attachment_operations(version);
CREATE INDEX idx_attachment_operations_client ON attachment_operations(client_id);
```

### 2. Business Logic

**Query Logic**:

1. Get all attachment operations where `version > since_version`
2. Filter by `client_id` (include both client-specific and global operations)
3. For each attachment, return only the latest operation
4. Generate download URLs for `create`/`update` operations
5. Return `delete` operations for attachments that were deleted

**Version Management**:

- Use the same version incrementing system as observations
- Increment global version when attachment operations are recorded
- Ensure atomicity between observation and attachment version updates

### 3. Endpoint Implementation

**Request Validation**:

- `client_id`: Required, non-empty string
- `since_version`: Required, non-negative integer

**Response Generation**:

- `current_version`: Current global version from `sync_version` table
- `operations`: Array of operations to perform
- `total_download_size`: Sum of sizes for all download operations
- `operation_count`: Count of operations by type

**Error Handling**:

- 400: Invalid request parameters
- 401: Authentication required
- 500: Internal server error

### 4. Performance Considerations

**Indexing**:

- Index on `version` for efficient range queries
- Index on `client_id` for client filtering
- Consider composite index on `(version, client_id)`

**Pagination**:

- For large result sets, consider implementing pagination
- Use `limit` and `offset` parameters if needed

**Caching**:

- Consider caching manifest responses for frequently requested version ranges
- Cache invalidation when new attachment operations are recorded

## Integration Points

### 1. Observation Sync Integration

When observations are created/updated/deleted:

1. Extract attachment references from observation data
2. Compare with existing attachments to determine operations
3. Record attachment operations in `attachment_operations` table
4. Ensure version consistency between observations and attachments

### 2. File Upload Integration

When attachments are uploaded via `PUT /attachments/{attachment_id}`:

1. Record `create` operation in `attachment_operations` table
2. Increment global version
3. Associate with appropriate `client_id` if applicable

### 3. File Deletion Integration

When attachments are deleted:

1. Record `delete` operation in `attachment_operations` table
2. Increment global version
3. Clean up physical files as appropriate

## Client-Side Integration

The client will:

1. Store `@last_attachment_version` in local storage
2. Call `/attachments/manifest` with `since_version` parameter
3. Process returned operations (download/delete)
4. Update `@last_attachment_version` after successful processing

## Testing Requirements

### Unit Tests

- Request validation
- Response generation
- Version filtering logic
- Operation deduplication

### Integration Tests

- End-to-end attachment sync flow
- Version consistency between observations and attachments
- Client-specific vs global operations
- Error handling scenarios

### Performance Tests

- Large manifest generation
- Concurrent client requests
- Database query performance

## Security Considerations

**Access Control**:

- Ensure clients can only access their own attachment manifests
- Validate client_id against authenticated user
- Implement rate limiting for manifest requests

**Data Privacy**:

- Don't expose attachment content in manifest
- Ensure download URLs are properly authenticated
- Consider signed URLs for enhanced security

## Deployment Checklist

- [ ] Database migration for `attachment_operations` table
- [ ] Implement endpoint handler
- [ ] Add business logic for manifest generation
- [ ] Update existing attachment upload/delete flows
- [ ] Add monitoring and logging
- [ ] Update API documentation
- [ ] Deploy and test in staging environment
- [ ] Regenerate client SDKs

## Example Implementation Flow

1. **Client requests manifest**: `POST /attachments/manifest` with `since_version: 42`
2. **Server queries operations**: Find all operations where `version > 42`
3. **Server filters by client**: Include client-specific and global operations
4. **Server deduplicates**: For each attachment, return only latest operation
5. **Server generates URLs**: Create download URLs for `download` operations
6. **Server returns manifest**: Complete manifest with operations and metadata
7. **Client processes operations**: Download new files, delete removed files
8. **Client updates version**: Store new `current_version` for next sync

This implementation provides a scalable, efficient solution for attachment synchronization that leverages the existing version-based sync infrastructure.
