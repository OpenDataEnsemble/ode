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

## HTTP timeouts (slow field radio)

`http.Server` **ReadTimeout / WriteTimeout are unset (0)**. Those are absolute deadlines from request start, so a 15s cap killed legitimate sync, attachment, and bundle-zip transfers on slow links.

| Bound | Value | Where |
| ----- | ----- | ----- |
| Request headers | 25s (`ReadHeaderTimeout`) | [`pkg/httptimeout`](pkg/httptimeout/httptimeout.go) — Slowloris only |
| Login / refresh | 25s (`http.TimeoutHandler`) | `/api/auth/*` only — not sync |
| Keep-alive idle | 60s | `IdleTimeout` |
| Reverse proxy send/read | 600s | [`nginx.conf`](nginx.conf) `proxy_send_timeout` / `proxy_read_timeout` |

Do **not** wrap sync, attachments, or bundle download in `TimeoutHandler`. Formulus adaptive page sizes are documented in [formulus/AGENTS.md](../formulus/AGENTS.md#adaptive-sync-low-connectivity).

---

## Local development

- **Prerequisites:** Go 1.22+, PostgreSQL, configured env (see [README.md](README.md) and [DOCKER.md](DOCKER.md)).
- **Run:** `go run cmd/synkronus/main.go` (or build from `cmd/synkronus`) with a valid `DB_CONNECTION` and secrets.
- **Docker:** [DOCKER.md](DOCKER.md); production patterns in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Related repos

- **Synkronus Portal** and **CLI** live in this monorepo as **clients** of this API — see their `AGENTS.md` files.
