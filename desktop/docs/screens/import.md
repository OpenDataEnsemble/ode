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
- Optional skip of Formulus-export rows that already appear synced (`syncedAt` ≥ `updatedAt`) — confirm dialog before write

## What to exclude

- Ongoing observation editing (Observations)
- Synkronus sync (Sync)
- Profile switching and repository path setup (Profiles), except implicit “active profile” context

## Key actions

- Stage files, review summary, import, clear
- When import JSON carries Formulus `syncedAt` metadata, confirm whether to skip already-synced observations and write only unsynced ones

## Data dependencies

- Store: `import` flow via `tauriClient.importObservations`, refresh `loadObservations` / `loadHealth` after import
- Active profile determines target SQLite repository
- Sync appearance: Formulus hail-mary export includes `syncedAt`; Desktop treats a row as already synced when `syncedAt` is meaningful and `updatedAt <= syncedAt` (same rule as Formulus pending detection)

## Observation indexes

When the active app bundle declares `observationIndexes` in `app.config.json`:

1. Import writes observations in batches (default 2000 rows per IPC call); intermediate batches skip index work.
2. After the final batch commits, Rust schedules **one** coalesced background full index rebuild (`bundle/index-rebuild` progress events). Overlapping rebuild requests while one is running are merged into a single follow-up pass.
3. Sync pull uses incremental indexing per page instead (no full rebuild after each pull).

## Large Formulus exports

After staging JSON (folder / drop / Add JSON), Desktop runs a lightweight host scan of `syncedAt` / `updatedAt` and may offer to drop already-synced files **before** full parse + schema validation. Staging lists truncate after ~50 rows so tens of thousands of files do not freeze the UI.
