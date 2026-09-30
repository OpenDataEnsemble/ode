---
sidebar_position: 5
---

# Synchronization

Synchronization is the process of exchanging data between mobile devices running Formulus and the Synkronus server, keeping all devices in sync with the latest data.

## Overview

ODE uses a robust bidirectional synchronization protocol designed for offline-first operation:

- **Offline Support**: Works completely offline; syncs when connectivity returns
- **Incremental Updates**: Only sends/receives changed data
- **Conflict Detection**: Automatically detects when the same record is modified in multiple places
- **Attachment Handling**: Separate, efficient synchronization for binary files
- **Idempotent Operations**: Safe to retry failed syncs without duplication
- **Client-Controlled**: Clients track what they've seen; server provides only new changes

## Synchronization Process

### When Sync Happens

**Automatic:**
- App starts (if network available)
- After creating or editing an observation
- When network connectivity changes to available
- Based on background sync schedule

**Manual:**
- User triggers sync from app menu
- User taps "Sync Now" button

### Two-Phase Sync

ODE separates synchronization into two independent phases:

#### Phase 1: Observation Data Sync

Syncs observation records (forms) and their metadata:

1. **Pull Phase** - Get new/updated observations from server
   - Client asks: "Give me everything changed since I last checked"
   - Server returns observations with `change_id` > client's last seen value
   - Client applies changes to local database
   - Client updates its last seen `change_id`

2. **Push Phase** - Send local observations to server
   - Client sends unsynced observations in small batches
   - Each observation includes a transmission ID for idempotency
   - Server validates and stores observations
   - Server returns success/failure for each record
   - Client marks successfully synced observations

**Why this approach:**
- Observations and attachments are independent
- Failure in attachment sync doesn't block observation sync
- Handles slow networks and partial transfers
- Allows incremental attachment sync

#### Phase 2: Attachment File Sync

Syncs binary files attached to observations (photos, audio, documents):

1. **Download Phase** - Get new attachments from server
   - After pull phase, client checks which attachments are referenced
   - For each missing attachment, download from server
   - Store file locally
   - Mark as synced

2. **Upload Phase** - Send local attachments to server
   - Client maintains list of un-uploaded attachments
   - Periodically upload each file to server
   - Once successful, remove from local pending queue
   - Mark as synced

## How Formulus sizes each request

Formulus does not expose a network-quality setting. Every device starts with **small** pages so a first attempt can finish on slow radio, then grows on a good link:

| Direction | First attempt | Smallest (poor radio) | Largest (good link) |
|-----------|---------------|------------------------|---------------------|
| Pull (download observations) | 32 | 1 | 500 |
| Push (upload observations) | 4 | 1 | 100 |

- Fast pages grow; slow or failed pages shrink (halve), down to one observation at a time.
- Photos and other attachments download **one at a time**. Observation JSON can finish while photos are still pending.
- There is nothing to configure in Settings for this.

A reverse proxy in front of Synkronus must allow long transfers (about **10 minutes**). See [Server Architecture for IT](/docs/guides/server-architecture-for-it).

## Understanding the Sync Algorithm

### Change Detection with `change_id`

ODE uses a cursor-based change detection approach—not timestamps or version numbers.

**How it works:**

1. **change_id**: Each record has a strictly increasing value assigned by the server
   ```
   Record A: change_id = 100
   Record B: change_id = 101
   Record C: change_id = 102
   ```

2. **Client Tracking**: Client remembers the last `change_id` it saw
   ```
   Last sync: saw change_id = 100
   → Only fetch records with change_id > 100
   ```

3. **Server Pull**: Returns only records newer than client's last seen value
   ```
   GET /sync/pull?since=100
   ← Returns records 101, 102, 103, ...
   ```

**Advantages:**
- No dependency on system clocks (which can be wrong on mobile devices)
- No ambiguity about ordering
- Enables clean pagination and deduplication
- Works reliably across time zones
- Handles clock skew and DST changes
- Enables efficient incremental sync

### Conflict Detection with Hashing

Each observation has a cryptographic hash to detect conflicts:

```
Observation data (form responses):
{
  "name": "John Doe",
  "age": 25,
  "location": {"lat": 0.123, "lng": 109.456}
}

Hash: SHA256 of (data + schemaType + schemaVersion)
→ f7d8e9c2a1b3...
```

**Conflict Detection:**

1. **Server stores**: hash of original observation
2. **User edits** on Device A
3. **User edits** on Device B  
4. **Both sync** to server
5. **Server compares**:
   - Device A's hash vs. stored hash → matches (Device A got original)
   - Device B's hash vs. stored hash → different (Device B got different version)
   - **Conflict detected!**

**Resolution:**
- Server accepts the push with a warning
- Previous version moved to conflicts table
- Client can review history and re-sync if needed

## Sync Status

Observations have a synchronization status indicating their state:

| Status | Meaning | Description |
|--------|---------|-------------|
| **Draft** | Unsaved | Currently being edited in form |
| **Pending** | Saved, waiting | Observation saved locally but not yet synced |
| **Syncing** | In progress | Actively syncing to server |
| **Synced** | Complete | Successfully synchronized with server |
| **Error** | Failed | Sync failed (will be retried) |
| **Conflict** | Conflicted | Sync conflict detected (awaiting resolution) |

**User-visible actions:**
- Observations in **Pending** state show sync icon
- Observations in **Error** state show warning icon
- User can tap to retry or view details

## Attachment Synchronization

### Upload Flow

When you create/edit an observation with attached files:

1. **Local save**: Observation + file stored locally
2. **Pending tracking**: File marked as "pending upload"
3. **Observation sync**: Observation synced first
4. **File upload**: File uploaded to server separately
5. **Cleanup**: File removed from pending queue once successful

### Download Flow

When you receive observations with attachments from server:

1. **Pull phase**: Observation metadata receives
2. **Attachment detection**: Check if observation references files
3. **Download check**: Skip if file already present locally
4. **Tracking**: Mark file as "pending download"
5. **File download**: Download file from server
6. **Storage**: Save to local file system
7. **Cleanup**: Remove from pending queue

### Attachment Design

- **Immutable Files**: Files cannot be changed once uploaded
- **New Version**: If content changes, create new file with new ID
- **Prevents Conflicts**: Immutability eliminates sync conflicts
- **Simple Design**: No need to sync file updates

**Example:**
```
Original observation:
{
  "photo_id": "abc-123.jpg"  ← File uploaded
}

Later, user wants different photo:
{
  "photo_id": "def-456.jpg"  ← New file, new ID
}
```

## Offline-First Behavior

### Working Offline

When offline, Formulus is fully functional:

- ✅ View all previously synced observations
- ✅ Create new observations
- ✅ Edit existing observations
- ✅ Take photos and record media
- ✅ Fill out forms normally
- ✅ Everything stored locally

All changes are saved locally in WatermelonDB (SQLite database).

### Automatic Sync When Online

When network becomes available:

1. App detects connectivity
2. Automatically triggers sync
3. Pushes all pending changes
4. Pulls latest from server
5. Syncs attachments
6. Updates UI with latest data

User doesn't need to do anything—it just happens.

### Manual Sync Options

Users can also manually trigger sync:

1. **Menu → Sync Again** - Force immediate sync
2. **Settings → Sync Options** - Configure auto-sync interval
3. **Sync Button** - Tap button to sync (if available)

## Conflict Resolution

### What Triggers a Conflict?

A conflict occurs when:

1. Observation created on Device A
2. Device A syncs to server
3. User modifies on Device B and Device B syncs first
4. Device A's sync detects the difference
5. Server flags as conflict

### How Conflicts Are Resolved

**Automatic:**
- Server accepts the newer push
- Older version stored in conflicts table
- Sync completes (with warning)

**User Resolution:**
- User notified of conflict
- Can review both versions
- Choose which version to keep
- Re-sync decision

**Generally:**
- Last-write-wins in most cases
- Hash mismatch alerts user to potential conflicts
- System designed to minimize conflicts through offline work then sync

## Sync Settings

Users can configure when sync runs (interval, Wi-Fi vs cellular). **Page and batch sizes are automatic** — there is no network-quality picker. See [How Formulus sizes each request](#how-formulus-sizes-each-request).

### Auto-Sync Interval

```
Settings → Sync Area → Auto-Sync Interval

Options:
  • Every 5 minutes
  • Every 15 minutes  
  • Every hour
  • Daily
  • Disabled (manual only)
```

### Data Usage

```
Settings → Sync Area → Mobile Data

Options:
  • Always (Wi-Fi and cellular)
  • Wi-Fi only
  • Never (manual only)
```

### Notifications

```
Settings → Sync Area → Notifications

  □ Notify on sync complete
  □ Notify on sync errors
  □ Notify on conflicts
```

## Troubleshooting Sync Issues

### "Sync Failed" Error

**Check these:**

1. **Network connectivity**
   - Are you connected to Wi-Fi or cellular?
   - Can you browse the web?
   - Is firewall blocking the app?

2. **Server accessibility**
   - Is the server running?
   - Can you reach the server URL?
   - Test: Open browser, go to `https://synkronus.your-domain.com/health`

3. **Authentication**
   - Are your credentials correct?
   - Has your password been changed?
   - Try logging out and back in

4. **Storage space**
   - Do you have space on your device?
   - Check: Settings → Storage → Available space

5. **Server logs**
   - Contact administrator
   - Check server logs for error messages

### "Conflict Detected" Error

**Options:**

1. **Accept current version** - Keep your local changes
2. **Discard changes** - Revert to server version
3. **Review history** - Compare both versions and choose

Once resolved, sync will complete normally.

### Observations Not Syncing

**Check:**

1. Are observations marked as "Pending sync"?
2. Is the observation a draft? (Drafts don't sync)
3. Try manual sync - tap "Sync Now"
4. Check app logs - Settings → Debug → View logs

### Attachments Not Uploading

**Check:**

1. Is observation synced? (Attachment sync happens after)
2. Is the file valid? (Corrupted files may fail)
3. Do you have enough storage on server?
4. Try syncing again - sometimes network timeout requires retry

## How to Monitor Sync

### In the App

1. **Sync Status** - Check observations list for sync icons
2. **Sync Activity** - Tap sync button to see progress
3. **Last Sync** - Settings shows last successful sync time

### On the Server

Administrators can:

1. View sync logs - `docker compose logs synkronus`
2. Check database - Query observations and change_id values
3. Monitor conflicts - View conflicts table for issues
4. Export data - Use CLI to export synced observations

## Next Steps

- [Working Offline](/docs/using/working-offline) - How to work without internet
- [Data Management](/docs/using/data-management) - View and organize synced data
- [Troubleshooting](/docs/using/troubleshooting) - Fix sync issues
- [Architecture: Sync Protocol](/docs/development/architecture#sync-protocol) - Technical details

## Related Content

- [Architecture](/docs/development/architecture) - System overview
- [Formulus Features](/docs/using/formulus-features) - Mobile app capabilities
- [API: Sync Endpoints](/docs/reference/rest-api/sync) - Technical API reference
- Explore [API endpoints](/reference/api/endpoints) for sync operations

