# Import

## Purpose

Bring external JSON observation files into the active profile’s local repository.

## User question it answers

“How do I load JSON files from disk into Custodian’s local store?”

## What to include

- Drag-and-drop and multi-file picker for `.json`
- **Validate** then review results in-page (no “import anyway?” popup)
- Import action on the validation results panel (available with or without errors)
- Clear label when validation finds no errors
- Optional skip of Formulus-export rows that already appear synced (`syncedAt` ≥ `updatedAt`) — confirm dialog at staging time

## What to exclude

- Ongoing observation editing (Observations)
- Synkronus sync (Sync)
- Profile switching and repository path setup (Profiles), except implicit “active profile” context

## Key actions

- Stage files → **Validate** → review results → **Import into local store** (or clear)
- When import JSON carries Formulus `syncedAt` metadata, confirm whether to skip already-synced observations and write only unsynced ones

## Data dependencies

- Store: `import` flow via `tauriClient.importObservations`, refresh `loadObservations` / `loadHealth` after import
- Active profile determines target SQLite repository
- Sync appearance: Formulus hail-mary export includes `syncedAt`; Desktop treats a row as already synced when `syncedAt` is meaningful and `updatedAt <= syncedAt` (same rule as Formulus pending detection)

## Observation indexes

When the active app bundle declares `observationIndexes` in `app.config.json`, local file import updates indexes **incrementally** for the written rows (same as sync pull). A full background rebuild is reserved for bundle apply / empty index / explicit rebuild — not for import.

## Large Formulus exports

After staging JSON (folder / drop / Add JSON), Desktop runs a lightweight host scan of `syncedAt` / `updatedAt` and may offer to drop already-synced files **before** full parse + schema validation. Staging lists truncate after ~50 rows so tens of thousands of files do not freeze the UI.

Import parse + JSON Schema validation + attachment reference checks run in **Rust (Rayon)** in one pass (`parse_and_validate_import_json_paths`), with form schemas loaded once from the active bundle.
