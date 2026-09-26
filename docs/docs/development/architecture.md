---
sidebar_position: 2
---

# Architecture

Complete architecture documentation for ODE, including sync protocol, database design, and extension points.

:::tip Audience
**Hosting / IT?** See [Server Architecture for IT](/docs/guides/server-architecture-for-it).  
**Product overview?** See [Architecture Overview](/docs/getting-started/architecture-overview).
:::

## System Overview

ODE follows a client-server architecture designed for offline-first data collection. High-level component relationships are documented in [Architecture Overview](/docs/getting-started/architecture-overview). Server installation layout is in [Server Architecture for IT](/docs/guides/server-architecture-for-it).

## Components

### Formulus

React Native mobile application providing:

- **Local Storage**: WatermelonDB for offline data storage
- **Sync Module**: Handles synchronization with server
- **WebView Hosts**: Runs Formplayer and custom applications
- **Native Features**: Camera, GPS, file system access

**Technology Stack:**
- React Native
- WatermelonDB
- TypeScript

### Synkronus

Go backend server providing:

- **REST API**: Comprehensive API for all operations
- **Synchronization**: Bidirectional sync protocol
- **Storage**: PostgreSQL database
- **Authentication**: JWT-based authentication
- **App Bundle Management**: Versioning and distribution

**Technology Stack:**
- Go 1.24+
- PostgreSQL
- Chi router
- JWT authentication

### Formplayer

React web application providing:

- **Form Rendering**: JSON Forms-based form rendering
- **Question Types**: Various input types and renderers
- **Validation**: Client-side and schema validation
- **Integration**: JavaScript interface for custom apps

**Technology Stack:**
- React
- JSON Forms
- Material-UI
- TypeScript

### Synkronus CLI

Go command-line utility providing:

- **Server Management**: Administrative operations
- **Data Operations**: Sync, export, import
- **App Bundle Management**: Upload, download, version management

**Technology Stack:**
- Go 1.24+
- Cobra CLI framework

### ODE Desktop

Tauri desktop application providing:

- **Local observation store**: SQLite per profile workspace
- **Sync console**: Pull, push, conflict visibility, index rebuild
- **Workbench**: Bundle download, form preview, custom app embed
- **Developer mode**: Local custom app mirror for iteration

**Technology Stack:**
- Tauri 2 (Rust)
- React, TypeScript, Vite
- Embedded formplayer

See [ODE Desktop Development](/development/ode-desktop-development).

## Data Flow

### Observation Creation

1. User fills out form in Formplayer (WebView)
2. Formplayer validates and submits to Formulus
3. Formulus creates observation in local database (WatermelonDB)
4. Observation is marked for synchronization

### Synchronization

1. **Pull Phase**: Formulus requests changes from server
   - Server returns records with `change_id > client_last_seen`
   - Client applies changes to local database

2. **Push Phase**: Formulus sends local changes to server
   - Client sends records with transmission ID for idempotency
   - Server validates and stores records
   - Server returns success/failure for each record

3. **Attachment Sync**: Separate phase for binary files
   - Upload: Client uploads attachments referenced in observations
   - Download: Client downloads attachments referenced in new observations

### Conflict Resolution

Conflicts are detected using hash comparison:

- Each record has a hash computed from data, schemaType, and schemaVersion
- If server hash ≠ client's last seen hash, conflict detected
- Server accepts overwrite with warning
- Previous version stored in conflicts table

## Sync Protocol

### Change Detection

Uses cursor-based approach with `change_id`:

- Each record has a strictly increasing `change_id` (server-assigned)
- Client stores last seen `change_id` per schemaType
- Pull returns all records where `change_id > last_seen`

**Advantages:**
- No dependence on system clocks
- No ambiguity about ordering
- Enables clean pagination and deduplication

### Record Model

Each form submission is an entity:

- `id`: Unique identifier
- `schemaType`: Form type identifier
- `schemaVersion`: Form version
- `data`: JSON data (form responses)
- `hash`: Computed hash for conflict detection
- `change_id`: Strictly increasing change identifier
- `last_modified`: Server-assigned timestamp
- `last_modified_by`: Username from JWT
- `deleted`: Soft delete flag
- `origin_client_id`: Client that created the record

### Attachment Handling

Attachments are managed separately:

- **Immutable**: Once uploaded, cannot be modified
- **Referenced**: Observations reference attachments by ID
- **Separate Sync**: Uploaded/downloaded in separate phase
- **Manifest-based**: Server provides manifest of changes

See the [Synchronization guide](/docs/using/synchronization) for more details.

## Database Design

### Observations Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `schema_type` | String | Form type identifier |
| `schema_version` | String | Form version |
| `data` | JSONB | Form data |
| `hash` | String | Computed hash |
| `change_id` | Integer | Strictly increasing change ID |
| `last_modified` | Timestamp | Last modification time |
| `last_modified_by` | String | Username |
| `deleted` | Boolean | Soft delete flag |
| `origin_client_id` | String | Creating client ID |
| `created_at` | Timestamp | Creation time |

### Attachments Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | Attachment ID (UUID) |
| `hash` | String | SHA-256 hash |
| `size` | Integer | File size in bytes |
| `mime_type` | String | MIME type |
| `change_id` | Integer | Change ID for sync |
| `last_modified` | Timestamp | Last modification time |
| `sync_state` | String | Sync state |

## Security Architecture

### Authentication

- **JWT Tokens**: JSON Web Tokens for authentication
- **Token Refresh**: Refresh tokens for long-lived sessions
- **Role-Based Access**: `read-only`, `read-write`, `admin` roles

### Authorization

- **Endpoint Protection**: Middleware validates JWT on protected routes
- **Role Checks**: Endpoints check required roles
- **Resource Access**: Users can only access their own data (unless admin)

### Data Security

- **Transport**: HTTPS enforced in production (TLS terminated at your reverse proxy)
- **Storage at rest**: Encryption is a **host platform** responsibility (volume/disk encryption, managed DB TDE)—not a separate Synkronus feature
- **Secrets**: Environment variables for sensitive data
- **Validation**: Input validation on all endpoints

See [Security reference](/docs/reference/security) for deployment checklist and mobile storage details.

## Performance Considerations

### Client-Side

- **Local Database**: Fast queries using WatermelonDB
- **Incremental Sync**: Only sync changes since last sync
- **Adaptive pages**: Formulus starts at 32 pull / 4 push, grows toward 500 / 100, floor 1
- **Lazy Loading**: Load attachments on demand
- **Caching**: Cache app bundles and form specifications

### Server-Side

- **Database Indexing**: Indexes on `change_id`, `schema_type`, `hash`
- **Connection Pooling**: Efficient database connection management
- **Pagination**: Cursor-based pagination for large datasets
- **Caching**: ETag support for efficient caching

## Extension Points

### Custom Renderers

Create custom question type renderers:

1. Define result interface in `FormulusInterfaceDefinition.ts`
2. Add interface method
3. Implement React component
4. Register renderer
5. Add mock implementation

### Custom Applications

Build custom web applications:

1. Create HTML/CSS/JavaScript files
2. Include Formulus load script
3. Use Formulus JavaScript interface
4. Package as app bundle
5. Upload to server

### Plugins

ODE's plugin system allows for extending functionality without modifying core code. The plugin architecture is under active development and will be documented as it evolves.

Current extension points:
- Custom renderers for question types
- Custom applications
- Server-side handlers (for advanced use cases)

## Related Documentation

- [Synchronization Details](/docs/using/synchronization)
- [Server Architecture for IT](/docs/guides/server-architecture-for-it)
- [Security reference](/docs/reference/security)
- [API Reference](/docs/reference/api)
