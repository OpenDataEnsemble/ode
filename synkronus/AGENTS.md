# Synkronus — AI & developer guide

**When to use this doc:** You are working on the **Go** HTTP API: sync, auth, app bundles, export, attachments, or database layer.

**See also:** [../AGENTS.md](../AGENTS.md).

**User-facing docs:** [Synkronus server](https://opendataensemble.org/docs/reference/synkronus-server), [REST API](https://opendataensemble.org/docs/reference/rest-api/overview), deployment guides linked from the docs site.

---

## What this package is

- **Synkronus** is the **central synchronization and coordination service** for ODE: JWT auth, pull/push sync, app bundle storage, exports, attachments.
- **Clients** (Formulus, Portal, CLI) all use the **same** public API — no hidden admin-only backdoors.

---

## Layout

```
cmd/synkronus/     # Entry point
internal/          # api, handlers, models, repository, services
pkg/               # Shared libraries (auth, database, middleware, openapi, ...)
```

- **OpenAPI / Swagger:** typically served under `/openapi` (see running server and [README.md](README.md)).

---

## Local development

- **Prerequisites:** Go 1.22+, PostgreSQL, configured env (see [README.md](README.md) and [DOCKER.md](DOCKER.md)).
- **Run:** `go run cmd/synkronus/main.go` (or build from `cmd/synkronus`) with a valid `DB_CONNECTION` and secrets.
- **Docker:** [DOCKER.md](DOCKER.md); production patterns in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Related repos

- **Synkronus Portal** and **CLI** live in this monorepo as **clients** of this API — see their `AGENTS.md` files.
