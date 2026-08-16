# Sync

## Purpose

Operational console to authenticate with Synkronus and exchange data: pull into the local repository, push pending changes.

## User question it answers

“Am I connected, what’s pending, and how do I pull or push?”

## What to include

- Server URL (read-only from active profile)
- Reachability indicator
- Authentication state and login form
- Pending push count and conflict count (from health), with pointer to Observations for conflicts
- Last pull / push timestamps
- Pull and push actions
- Recent operation log (per-session, on this screen)
- Store-level `syncMessage` / `error` after operations
- Danger zone: reset local data (full, or **pending-only** so synced rows + sync offsets stay for a continued pull), re-create index, reset server repository

## What to exclude

- OpenAPI / codegen implementation details in UI
- Per-observation JSON editing (Observations)
- Profile file path editing (Profiles)

## Key actions

- Login, pull, push
- Reset local data (optional: pending observations only)

## Data dependencies

- Store: `synkLogin`, `synkPull`, `synkPush`, `health`, `loadHealth`, `authSessionsByProfileId`, `error`, `syncMessage`
- `syncGateway` + `tauriClient.importObservations` / `markObservationsPushed`
- `useSynkServerStatus` for reachability
- `tauriClient.credentialGet` for optional saved password
