# ODE Desktop — feature requests

## Safe bulk data cleaning

Guided workflows for cleaning observation data without direct SQLite editing:

- Filter and preview rows that fail validation or business rules
- Staged apply with re-validation before commit
- Export / re-import patterns for offline tooling
- Read-only inspection mode

Direct database URI exposure in the UI is intentionally limited; prefer in-app or server-side tooling that respects sync semantics and soft-delete.
