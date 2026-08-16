# Profiles

## Purpose

Define units of custody: each profile has its own Synkronus server, credentials, workspace, attachments path, and local repository file.

## User question it answers

“Which repository context am I using, and how do I add or edit it?”

## What to include

- Active profile selector, add/delete profile
- Edit: display name, server URL, username, password (OS keyring when available)
- Local repository file picker, workspace folder, optional attachments folder
- Reload, save profile, clear saved password
- Authenticate button: auto-recovers session (refresh token / saved password) on load and profile switch; shows **Authenticated** only after a successful check, otherwise **Authenticate**
- Warnings when secure storage is unavailable (password not persisted)

## What to exclude

- Observation list and editor (Observations)
- Pull/push execution (Sync)
- Import file workflow (Import)

## Key actions

- Switch profile, add/delete profile, save fields, pick paths, clear password

## Data dependencies

- Store: `profiles`, `activeProfileId`, `refreshSettings`, `selectActiveProfile`, `upsertProfileRemote`, `deleteProfileRemote`, `dataDirectory`
- Tauri: `get_settings`, `set_active_profile`, `upsert_profile`, `delete_profile`, `credential_get` / `credential_set` / `credential_delete`

### Secure storage fallback

On platforms without a working secret service, profile fields still save; passwords are not stored on disk. Users can enter password at Sync → Login each session.
