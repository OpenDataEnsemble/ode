# User presence (last seen)

Synkronus records **best-effort** per-user, per-client activity for operators. Writes are **asynchronous**: the API does not wait on the database for presence.

## Behavior

- **Protected routes** (after JWT): optional heartbeat via middleware using `x-ode-client-id` (may be empty; stored as an empty string key) and `x-ode-version` / `x-formulus-version` for client version hints. Heartbeats are **throttled** per `(username, client_id)` to limit load.
- **Sync**: successful `POST /api/sync/pull` and `POST /api/sync/push` enqueue richer updates (sync cursor / `current_version`) with **throttle bypass** so version metadata is not dropped.
- **App bundle**: successful `GET /api/app-bundle/manifest` records the resolved manifest `version` for that user and client header.
- **Queue**: if the internal queue is full, events are **dropped** and logged; API responses still succeed.
- **Shutdown**: in-flight presence writes may be lost during process exit.

## Admin API

`GET /api/users` (admin) returns `UserListItem` rows with optional `presence`:

- `lastSeenAt` — latest `lastSeenAt` across clients
- `clientCount` — number of distinct client rows
- `clients[]` — per-client details (`clientId`, `lastSeenAt`, optional version hints)

OpenAPI: [`../openapi/synkronus.yaml`](../openapi/synkronus.yaml) (`UserListItem`, `UserPresenceSummary`).
