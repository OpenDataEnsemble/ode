---
name: Synkronus last-seen presence (v2)
scope: synkronus
overview: >-
  End-to-end last-seen presence: implement the Synkronus backend first (DB, recorder, middleware, hooks, admin API),
  then CLI and Portal clients. PostgreSQL-backed per-user, per-client presence with throttled async writes;
  middleware only on authenticated routes after JWT. Optional admin-visible fields on user listing.
---

# Plan: Last-seen / user presence (v2)

## Implementation order

Do work in this order. **The backend is not optional up front** — CLI and Portal consume `openapi/synkronus.yaml` and the admin user-list response; implement Synkronus first so generated clients and UI have real fields to bind to.

| Phase | Package | What |
|-------|---------|------|
| **1** | **synkronus** | Migration, presence persistence, `pkg/presence` recorder, middleware, sync/app-bundle hooks, admin list enrichment, `openapi/synkronus.yaml`, `synkronus/documentation/`, server tests |
| **2** | **synkronus-cli** | `go generate ./pkg/client`, extend `ListUsers` / `synk user list`, README + `LLM_context.md`, flag completions if any |
| **3** | **synkronus-portal** | `npm run generate:api`, `api.listUsers` + `User` types, Users tab “Last activity” panel + CSS |
| **4** | **All touched** | `go fmt` / `npm run format`; tests per package; paste-ready PR summary |

Sections **Architecture** through **Admin API** describe **Phase 1 (Synkronus)**. **Phase 2 (CLI)** and **Phase 3 (Portal)** follow next (same content as the v2+ client plan). **Testing**, **Formatting**, **PR description**, and the **Deliverables checklist** apply to all phases.

## Mandatory reading for implementers

Before writing or changing code, **read and follow** the repository’s guides:

- Root **[`AGENTS.md`](../AGENTS.md)** — monorepo map, cross-cutting contracts, where to find package-specific guides.
- Root **[`README.md`](../README.md)** and any **README** in packages you touch.
- **[`synkronus/AGENTS.md`](../synkronus/AGENTS.md)** — Synkronus Go layout, HTTP header conventions (lowercase), OpenAPI + `documentation/` sync.
- **[`synkronus/README.md`](../synkronus/README.md)** — local dev, env, API entry points.
- Follow **links from those files** (e.g. `synkronus/documentation/`, OpenAPI, deployment docs) for anything you implement.
- Match **coding standards and patterns** already used in the touched packages (imports, error handling, logging, tests). Prefer extending existing types and routes over parallel mechanisms.

If work spills into Portal, CLI, or Formulus, read that package’s **`AGENTS.md`** and **`README.md`** as well.

## Out of scope for this plan

Do **not** implement here:

- **Repository generation**, **hard server reset**, mass `DELETE` of observations or attachments, or **invalidating all clients** via a generation epoch. That is **[`plan_hard_reset_v2.md`](./plan_hard_reset_v2.md)**.
- Changing core sync semantics (409 for generation mismatch, admin wipe endpoints) unless strictly required for presence storage.

## Goal

Operators and admins can see **when users/devices were last active** and light metadata (sync cursor hint, app bundle version), without slowing API responses. Presence is **best-effort** and **non-blocking**.

## Architecture (Synkronus)

- **Public** routes (e.g. `/health`, `/api/auth/login`) — **no** presence middleware.
- **Protected** routes (JWT): `formulusversion` → `AuthMiddleware` → **presence middleware** (enqueue only) → handlers.
- User identity: context from auth middleware (e.g. `GetUserFromContext`).

```mermaid
flowchart LR
  subgraph public [Unauthenticated]
    health["/health"]
    authLogin["/api/auth/login"]
  end
  subgraph protected [JWT required]
    fv["formulusversion"]
    jwt["AuthMiddleware"]
    presence["presence: throttle + enqueue"]
    handlers["handlers"]
    async["async DB UPSERT"]
  end
  authLogin --> fv
  fv --> jwt
  jwt --> presence
  presence --> handlers
  presence -.->|"non-blocking"| async
```

## Non-blocking writes

- Middleware and hooks use a **presence recorder**: throttle `(username, client_id)` in-process, then **enqueue** to a **bounded** queue; workers `UPSERT` with a detached/timeout context, **not** `r.Context()`.
- If the queue is full, **drop** and log — API responses must still succeed.
- **Shutdown**: document best-effort loss of in-flight presence writes.

## Data model

- New goose migration under `synkronus/pkg/migrations/sql/`.
- Table (name may vary), e.g. **`user_client_presence`**:
  - `username` → `REFERENCES users(username) ON DELETE CASCADE`
  - `client_id` `TEXT NOT NULL` (use `''` if unknown so `(username, client_id)` PK works)
  - `last_seen_at` `TIMESTAMPTZ NOT NULL`
  - `last_data_version` `BIGINT NULL`
  - `app_bundle_version` `TEXT NULL`
  - Optional: `last_ode_version` `TEXT NULL`
  - Indexes for admin listing as needed.

Schema is **additive** only.

## Middleware

- Package under e.g. `synkronus/pkg/middleware/presence/` — avoid naming collisions with `pkg/presence` recorder types.
- After JWT: read user from context; optional headers (e.g. client id) if documented; **never** await DB.
- Register in `synkronus/internal/api/api.go` inside the protected group, **after** `AuthMiddleware`.
- **CORS**: add any new custom headers to `AllowedHeaders` if browser clients send them.

## Handler hooks (server-side enrichment)

Sync JSON already includes `client_id`; body is not available in generic middleware before read:

| Location | Record (enqueue, same async path) |
|----------|-----------------------------------|
| Successful **Pull** | `client_id`, `since.version` (or 0), `last_seen_at` |
| Successful **Push** | `last_data_version` from response `current_version` |
| **App bundle manifest** (authenticated) | `app_bundle_version` from resolved manifest |

Optional: `x-ode-version` / `x-formulus-version` via existing middleware for `last_ode_version`.

## Admin API

- Extend admin **list users** (or dedicated route) to expose optional **`lastSeenAt`**, **`clients[]`**, etc., with backwards-compatible JSON.
- Update **`openapi/synkronus.yaml`** and a short narrative doc under `synkronus/documentation/`; link from `synkronus/README.md` if appropriate.
- Regenerate server OpenAPI artifacts if your workflow uses them (e.g. `synkronus/scripts/generate-api.ps1` / `internal/api/generated` per repo practice).

## Phase 2 — synkronus-cli (after OpenAPI lists presence fields)

**Regenerate OpenAPI client** — From `synkronus-cli/`: `go generate ./pkg/client` (see [`pkg/client/generate.go`](../synkronus-cli/pkg/client/generate.go), [`oapi-codegen.yaml`](../synkronus-cli/oapi-codegen.yaml)). Run `go test ./...` in `synkronus-cli`.

**Implement retrieval / display** — Extend [`pkg/client/user.go`](../synkronus-cli/pkg/client/user.go) (`ListUsers`) and [`internal/cmd/user.go`](../synkronus-cli/internal/cmd/user.go) (`synk user list`): columns for last-seen (and optionally client id / bundle version), **“N/A”** when absent; document column order if it changes. If the API adds query params (e.g. `includePresence`), add matching flags.

**Documentation** — [`synkronus-cli/README.md`](../synkronus-cli/README.md), [`synkronus-cli/LLM_context.md`](../synkronus-cli/LLM_context.md).

**Shell completion** — Cobra generates from [`internal/cmd/root.go`](../synkronus-cli/internal/cmd/root.go). Add `RegisterFlagCompletionFunc` for new enum-like flags (see [`internal/cmd/data.go`](../synkronus-cli/internal/cmd/data.go)); document in README if needed.

## Phase 3 — synkronus-portal (after OpenAPI lists presence fields)

**Regenerate API client** — From `synkronus-portal/`: `npm run generate:api` → [`src/api/synkronus/generated`](../synkronus-portal/src/api/synkronus/generated).

**Wire data** — [`src/services/api.ts`](../synkronus-portal/src/services/api.ts) (`listUsers`), [`src/pages/Dashboard.tsx`](../synkronus-portal/src/pages/Dashboard.tsx) (`User` interface).

**Users tab UI** — Panel above the users table (glass/card styling from [`Dashboard.css`](../synkronus-portal/src/pages/Dashboard.css)), e.g. **“Last activity”**: per-user summary (latest last-seen, client count); hide or **“Not available”** when the server omits presence.

```mermaid
flowchart LR
  openapi["synkronus OpenAPI plus handlers"]
  cliGen["CLI go generate"]
  portalGen["Portal npm run generate:api"]
  cliCmd["synk user list plus docs"]
  portalUi["Dashboard presence panel"]
  openapi --> cliGen
  openapi --> portalGen
  cliGen --> cliCmd
  portalGen --> portalUi
```

## Testing

- **Synkronus:** Unit: repository UPSERT, throttle, queue-full drop, shutdown. Integration: authenticated traffic updates presence; login/public routes do not; no blocking on request path (mocks that would detect awaits).
- **synkronus-cli:** Add or extend tests where the repo already does for similar features (e.g. client parsing, command output, flag handling) — follow existing patterns in `synkronus-cli`.
- **synkronus-portal:** Add tests where relevant (e.g. formatting helpers, thin logic extracted from `Dashboard` if needed) — follow existing ESLint/Prettier and test conventions in that package.

## Formatting (before review / PR)

Run on touched packages so diffs stay clean and CI stays green:

- **Go** (`synkronus`, `synkronus-cli`, and any other edited Go modules): `go fmt ./...` (or format only changed packages).
- **synkronus-portal** (TypeScript/JSON touched by codegen or hand edits): `npm run format` from `synkronus-portal/` (see `package.json`).

## PR description (final step)

Before opening the PR, produce a **concise summary** suitable for pasting into the PR body so reviewers can orient quickly:

- **What** changed (Synkronus / CLI / Portal — scope per package).
- **Why** (presence / last-seen for operators; non-blocking writes).
- **Notable details**: new migration, new headers, OpenAPI/client regen, admin-only fields, any behavior caveats (best-effort, queue drop).
- **How to verify**: e.g. local steps, key tests, or manual checks.

Match the repository’s PR template and tone if one exists. For ODE-style markdown body text, the **[`pr-description` skill](./skills/pr-description/SKILL.md)** documents the expected format.

## Deliverables checklist

### Phase 1 — Synkronus (backend)

| Item | Notes |
|------|--------|
| Migration + repository | Goose under `pkg/migrations/sql/`; table e.g. `user_client_presence`; FK to `users`; read path for admin list |
| `pkg/presence` recorder | Throttle + bounded queue + workers; UPSERT off request path |
| Middleware + `api.go` wiring | After `AuthMiddleware`; public routes excluded; CORS for new headers |
| Sync + app-bundle hooks | Pull / push / manifest enqueue as in handler-hooks table |
| Admin list + OpenAPI + docs | Enrich list response; `openapi/synkronus.yaml`; `synkronus/documentation/`; README link |
| Server codegen | If repo uses generated API types, regen after YAML change |

### Phase 2 — synkronus-cli

| Item | Notes |
|------|--------|
| Client regen | `go generate ./pkg/client` |
| `user list` + client | `pkg/client/user.go`, `internal/cmd/user.go`; optional flags for API query params |
| Docs | README, `LLM_context.md` |
| Completions | `RegisterFlagCompletionFunc` for new flags only |

### Phase 3 — synkronus-portal

| Item | Notes |
|------|--------|
| Client regen | `npm run generate:api` |
| API + UI | `api.ts`, `Dashboard.tsx` User type; “Last activity” panel + CSS |

### Phase 4 — All packages

| Item | Notes |
|------|--------|
| Tests | Synkronus + CLI + Portal where relevant (see Testing) |
| Formatting | `go fmt`; `npm run format` in portal when applicable |
| PR description | Paste-ready summary (see PR description section) |
