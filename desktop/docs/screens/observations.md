# Observations

## Purpose

Primary work surface to inspect, edit, and resolve observations in the local repository.

## User question it answers

“Which observations need attention, and how do I view or fix them?”

## What to include

- Search by id or form type (`list_observations` with query)
- Filters: All, Dirty, Conflicts, Recently modified (client-side on the loaded result set; see limitation below)
- List with sync status and explicit dirty badge
- Detail: metadata (id, form type, timestamps, conflict/dirty flags) and JSON editor
- Save local, restore backup, new observation

## What to exclude

- Bulk JSON import (Import)
- Synkronus authentication and pull/push (Sync)
- Profile and repository file configuration (Profiles)

## Key actions

- Search, filter, select observation
- Edit payload, save locally
- Restore backup, create new observation

## Data dependencies

- Store: `observations`, `selectedObservationId`, `loadObservations`, `saveObservation`, `restoreLastBackup`, `setSelectedObservationId`, `error`
- Tauri: `list_observations` (limit 250), `save_observation`, `restore_last_backup`

**Limitation:** Filters apply only to the current loaded list (up to 250 rows for a given search). Full-repository counts appear on Overview and Sync via `health`.
