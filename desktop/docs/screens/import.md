# Import

## Purpose

Bring external JSON observation files into the active profile’s local repository.

## User question it answers

“How do I load JSON files from disk into Custodian’s local store?”

## What to include

- Drag-and-drop and multi-file picker for `.json`
- Pre-flight summary (counts, form types, attachment hints)
- Per-file parse/normalization issues
- Import action and clear/reset

## What to exclude

- Ongoing observation editing (Observations)
- Synkronus sync (Sync)
- Profile switching and repository path setup (Profiles), except implicit “active profile” context

## Key actions

- Stage files, review summary, import, clear

## Data dependencies

- Store: `import` flow via `tauriClient.importObservations`, refresh `loadObservations` / `loadHealth` after import
- Active profile determines target SQLite repository
