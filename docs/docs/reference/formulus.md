---
sidebar_position: 5
---

# Formulus Component Reference

Complete technical reference for the Formulus mobile application component.

## Overview

Formulus is a React Native mobile application that serves as the client-side component of ODE. It provides offline-first data collection capabilities, custom application hosting, and bidirectional synchronization with the Synkronus server.

## Architecture

### Technology Stack

- **Framework**: React Native
- **Language**: TypeScript
- **Database**: WatermelonDB (SQLite-based)
- **State Management**: React Context API
- **Navigation**: React Navigation
- **WebView**: React Native WebView (for custom apps)

### Component Structure

```
formulus/
├── src/
│   ├── api/              # Synkronus API client (auto-generated)
│   ├── components/       # React Native UI components
│   ├── contexts/         # React Context providers
│   ├── database/         # WatermelonDB schema and models
│   ├── hooks/            # Custom React hooks
│   ├── navigation/       # Navigation configuration
│   ├── screens/          # Screen components
│   ├── services/         # Business logic services
│   ├── sync/             # Adaptive pull/push sizes, retries
│   ├── webview/          # WebView integration and bridge
│   └── utils/            # Utility functions
├── android/              # Android native code
├── ios/                  # iOS native code
└── assets/               # Static assets
```

## Core Features

### Offline-First Data Storage

Formulus uses WatermelonDB for local data storage:

- **Observations**: All form submissions stored locally
- **Attachments**: Binary files stored in local filesystem
- **App Bundles**: Custom application files cached locally
- **Sync State**: Tracks synchronization status

### Profiles

Formulus keeps local observations, attachments, app bundles, sync state, server connection, and credentials per profile. Open **Profiles** from the in-app menu (or tap the active profile in the drawer) to add, select, rename, or delete profiles. Switching profiles happens in the app and restarts/remounts the active app context; it does not change the profile of an already-open WebView. Configure the active profile's server URL and sign-in on **Profiles**, not in Settings. Deleting a profile removes its host-managed local observations, attachments, bundles, and namespaced browser keys when cleanup runs; it cannot guarantee removal of third-party raw browser keys. Sync anything you need to keep first. The last profile cannot be deleted.

**Profiles provide organizational and storage namespacing, not a sandbox or confidentiality boundary.** Code in a custom app or form extension may be able to read data or attachments from other profiles through WebView file access (depending on platform and WebView configuration), and raw browser storage may expose keys across profiles. A connected Synkronus server can supply app bundles containing such code; this does not mean every server executes arbitrary code. Connect only to trusted servers and install only trusted app bundles. Do not store secrets in browser storage.

### Custom Application Hosting

Formulus hosts custom web applications in WebViews:

- **WebView Integration**: React Native WebView component
- **JavaScript Bridge**: Communication between native and web
- **Formulus API**: Injected JavaScript interface for custom apps
- **Asset Loading**: Serves app bundle files from local storage
- **Profile storage**: Host-owned databases, files, bundles, and Formplayer browser keys are scoped to the active profile. Custom apps should use the profile-scoped storage bridge below for their own browser keys.

### Synchronization Engine

Two-phase synchronization protocol:

1. **Observation Sync**: JSON metadata synchronization
2. **Attachment Sync**: Binary file synchronization

Pull and push unit sizes are **adaptive** (no enumerator preset). Fresh devices start at **32** observations per pull page and **4** per push batch, grow toward 500 / 100 on a fast link, and can shrink to **1** on very poor radio. Attachment downloads are serial. See [How Formulus sizes each request](/docs/using/synchronization#how-formulus-sizes-each-request).

### Form Rendering

Integration with Formplayer for form rendering:

- **Formplayer WebView**: Renders forms using JSON Forms
- **Question Types**: Supports various input types
- **Validation**: Client-side and schema-based validation
- **Data Binding**: Connects form data to observations

## JavaScript Interface

Formulus exposes a JavaScript API to custom applications running in WebViews.

### API Access

The API is automatically injected into WebViews. Use the helper function to ensure it's ready:

```javascript
// Wait for API to be ready
const api = await getFormulus();

// Now use the API
const version = await api.getVersion();
```

### Core Methods

#### getProfileId() and getLocalStorageRef()

These methods are **synchronous** (do not `await` them). `getProfileId()` returns the immutable host profile ID captured when this WebView was created, not a profile label. `getLocalStorageRef()` returns a profile-scoped subset of browser storage: `getItem(key)`, `setItem(key, value)`, `removeItem(key)`, and `clear()`. It uses physical keys `ode:{profileId}:app:{key}`; `clear()` removes only the current profile's app keys, not Formplayer's keys or other storage. Storage errors (such as quota failures) propagate to the caller.

```javascript
const api = await getFormulus();
const profileId = api.getProfileId();
const storage = api.getLocalStorageRef();
storage.setItem('lastView', 'visits');
const lastView = storage.getItem('lastView'); // 'visits'
```

Use this reference instead of raw `window.localStorage` for custom-app preferences. This is **namespacing, not a security sandbox**: custom apps and third-party code loaded from a shared `file://` origin may access raw browser storage across profiles. The host does not monkeypatch `localStorage` and cannot guarantee removal of unrelated third-party raw keys when a profile is deleted. Do not put secrets in WebView storage; audit dependencies that write to raw storage. See [Custom applications](../guides/custom-applications.md#profile-aware-browser-storage).

#### getVersion()

Get the Formulus host version.

```javascript
const version = await api.getVersion();
// Returns: "1.0.0"
```

#### addObservation(formType, initializationData)

Create a new observation by opening a form.

```javascript
await api.addObservation('survey', {
  participantId: '123',
  location: 'Field Site A'
});
```

**Parameters:**
- `formType` (string): The form type identifier
- `initializationData` (object): Optional data to pre-populate the form

**Returns:** Promise that resolves when form is opened

#### editObservation(formType, observationId)

Edit an existing observation.

```javascript
await api.editObservation('survey', 'obs-123');
```

**Parameters:**
- `formType` (string): The form type identifier
- `observationId` (string): The observation ID to edit

**Returns:** Promise that resolves when form is opened

#### deleteObservation(formType, observationId)

Delete an observation.

```javascript
await api.deleteObservation('survey', 'obs-123');
```

**Parameters:**
- `formType` (string): The form type identifier
- `observationId` (string): The observation ID to delete

**Returns:** Promise that resolves when deletion is complete

#### getObservations(formType, isDraft?, includeDeleted?)

List observations for a form type (no structured filter).

```javascript
const observations = await api.getObservations('survey', false, false);
```

#### getObservationsByQuery(options)

Query observations with a **structured filter AST** (preferred for custom apps). Declared `data.*` paths use a local **observation index**; other paths use `json_extract`. See [Observation queries](../guides/observation-queries.md).

```javascript
const observations = await api.getObservationsByQuery({
  formType: 'hh_person',
  includeDeleted: false,
  filter: {
    op: 'and',
    conditions: [
      { field: 'data.village', op: 'eq', value: 'kopria' },
    ],
  },
});
```

**Parameters:**
- `formType` (string): Form type identifier
- `includeDeleted` (boolean, optional): Include soft-deleted rows
- `filter` (ObservationFilter, optional): Structured filter AST

**Returns:** Promise resolving to an array of observations

#### sync(options?)

Trigger manual synchronization.

```javascript
const { version } = await api.sync();
// Optional: include attachments (slower)
await api.sync({ includeAttachments: true });
```

**Returns:** `Promise<{ version: number }>` — the server's data revision after sync completes.

#### getConnectivityStatus()

Probe whether the configured Synkronus server answers `GET /health`. Never rejects for offline devices — returns `{ online: false }`.

```javascript
const status = await api.getConnectivityStatus();
// { online: boolean, serverUrl: string | null, checkedAt: number }
```

Use for "verify when online, fall back when offline" workflows in custom apps.

#### getCurrentDataRevisionCount()

Read the device's last-known Synkronus data revision (`current_version` from the most recent successful sync).

```javascript
const revision = await api.getCurrentDataRevisionCount(); // number, 0 if never synced
```

Reflects **server-stream alignment only** — not unsynced local edits. Poll after `sync()` or on an interval to detect remote changes from other devices.

#### persistObservation(input)

Persist an observation **without opening Formplayer** (headless write). Uses the same path as a Formplayer submit.

```javascript
const result = await api.persistObservation({
  formType: 'survey',
  finalData: { name: 'Ada', age: 30 },
  observationId: null, // omit or null to create; provide id to update
});
// { observationId, formData }
```

#### openFormplayer options

When opening forms programmatically, `openFormplayer` accepts:

| Option | Description |
|--------|-------------|
| `subObservationMode` | Nested child form for embedded sub-observations |
| `skipFinalize` | Omit Finalize page; **Done** on last content page submits after child-schema validation; returns `formData` to parent |
| `skipDraftSelection` | Skip draft picker on new root sessions (custom-app orchestration) |

**Form init `params` reserved keys** (not persisted as observation data): `defaultData`, `theme`, `darkMode`, `themeColors`, `context` (read-only session context exposed in Formplayer as `window.formulusSessionContext`), `validationMode`.

## Database Schema

### Observations Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | string | Unique observation identifier |
| `form_type` | string | Form type identifier |
| `data` | JSON | Observation data (form responses) |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |
| `deleted` | boolean | Soft delete flag |
| `_status` | string | Sync status (created, updated, deleted) |
| `_changed` | string | Changed fields tracking |

### Attachments Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | string | Unique attachment identifier |
| `observation_id` | string | Reference to observation |
| `file_path` | string | Local file path |
| `mime_type` | string | File MIME type |
| `size` | number | File size in bytes |
| `synced` | boolean | Sync status |

## Synchronization Protocol

### Two-Phase Sync

#### Phase 1: Observation Sync

1. **Pull**: Request changes from server since last sync
2. **Apply**: Apply server changes to local database
3. **Push**: Send local changes to server
4. **Resolve Conflicts**: Handle conflicts if any

Page and batch sizes AIMD from conservative starts (pull **32**, push **4**) between floor **1** and ceiling **500** / **100**. Constants: `formulus/src/sync/networkProfile.ts`. Axios JSON timeout is 10 minutes.

#### Phase 2: Attachment Sync

1. **Download Manifest**: Get list of attachments to download
2. **Download Files**: Download missing attachments (concurrency 1)
3. **Upload Files**: Upload pending attachments
4. **Update Status**: Mark attachments as synced

Observation JSON can complete while attachment files remain pending.

### Sync State Management

The app maintains sync state:

- **Last Sync Timestamp**: When last sync completed
- **Pending Observations**: Count of unsynced observations
- **Sync Status**: Current sync state (idle, syncing, error)

## Configuration

### Server Configuration

Configure the active profile on **Profiles**:

- **Server URL**: Synkronus server address for this profile
- **Username and password**: Credentials for this profile; sign in from Profiles

Use the in-app **Profiles** screen to switch servers/workspaces. **Settings** is for preferences such as language and theme, not server credentials.

### Sync Configuration

- **Auto-sync**: Enable automatic synchronization
- **Sync Interval**: How often to check for sync
- **WiFi Only**: Sync only on WiFi connection

## Development

### Building from Source

See [Formulus Development Guide](/development/formulus-development) for complete development setup.

### Key Development Commands

```bash
# Install dependencies (build @ode/tokens first; see Development Setup)
cd ../packages/tokens && pnpm install && pnpm run build && cd ../formulus
pnpm install

# Start Metro bundler
pnpm start

# Run on Android (vendors Notifee via preandroid)
pnpm run android

# Run on iOS
pnpm run ios

# Generate API client from OpenAPI spec
pnpm run generate:api

# Generate WebView injection script
pnpm run generate
```

### Project Structure

- **Android**: Native Android code in `android/` directory
- **iOS**: Native iOS code in `ios/` directory
- **Source**: TypeScript source in `src/` directory
- **Assets**: Static assets in `assets/` directory

## Platform-Specific Features

### Android

- **File System Access**: Direct access to Android storage
- **Camera Integration**: Native camera API
- **GPS**: Android location services
- **Permissions**: Android permission system

### iOS

- **File System Access**: iOS file system access
- **Camera Integration**: Native camera API
- **GPS**: iOS Core Location
- **Permissions**: iOS permission system

## Security

### Authentication

- **JWT Tokens**: Stored securely in device keychain/keystore
- **Token Refresh**: Automatic token refresh before expiration
- **Secure Storage**: Credentials stored using platform secure storage

### Data Protection

- **Local Encryption**: Sensitive data encrypted at rest
- **Secure Communication**: HTTPS for all server communication
- **Permission Management**: Granular permission requests

## Performance

### Optimization Strategies

- **Lazy Loading**: Load forms and data on demand
- **Caching**: Aggressive caching of app bundles and assets
- **Background Sync**: Sync in background to avoid blocking UI
- **Database Indexing**: Optimized database queries

### Memory Management

- **Image Compression**: Compress images before storage
- **Attachment Cleanup**: Remove old attachments after sync
- **Cache Limits**: Limit cache size to prevent memory issues

## Troubleshooting

### Common Issues

#### Sync Failures

- Check network connectivity
- Verify server URL and credentials
- Review sync logs for errors
- Check server status

#### App Crashes

- Review crash logs
- Check memory usage
- Verify database integrity
- Update to latest version

#### Performance Issues

- Clear app cache
- Check database size
- Review attachment storage
- Optimize app bundle size

## API Reference

For complete API documentation, see:

- [Synkronus API Reference](/reference/api) - Server API endpoints
- [Custom Applications Guide](/guides/custom-applications) - Building custom apps
- [Form Design Guide](/guides/form-design) - Creating forms

## Related Documentation

- [Formulus Features](/using/formulus-features) - User-facing features
- [Installing Formulus](/docs/getting-started/installation/installing-formulus) - Installation guide
- [Formulus Development](/development/formulus-development) - Development setup
- [Synchronization](/using/synchronization) - Sync protocol details

