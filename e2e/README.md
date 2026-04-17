# ODE end-to-end attachment sync harness (design)

This directory is the **design home** for an automated end-to-end (E2E) test
harness that exercises the full attachment-sync flow across the ODE stack.
At the moment it contains **skeletons only** — no tests are wired, and
`docker-compose.e2e.yml` and the companion GitHub Actions workflow stub are
scaffolds intended to be filled in by a follow-up change.

The goal of the harness is to make the class of regressions we just fixed
(drafts never promoted to `pending_upload/`, fresh installs hitting 409,
hard-resets leaving stale manifest rows, …) **impossible to ship without
turning CI red**.

---

## Scope

Three layers, in order of cost and fidelity:

### 1. `synkronus-only` — server contract tests (cheap, always on)

- **Compose:** `postgres` + `synkronus` (see `docker-compose.e2e.yml`,
  profile `synkronus`).
- **Driver:** `synkronus-cli` (`synk`) and raw `curl`/`go test` against a
  live API.
- **What it proves:**
  - Fresh client (no `x-repository-generation`) → 200, adopts server gen.
  - Client with stale gen → 409 `repository_reset_required`.
  - Hard reset wipes `attachment_operations` and on-disk blobs.
  - Manifest returns **latest** op per `attachment_id` only.
  - Split-cursor manifest: attachment ops since `attachment_cursor` are
    never dropped when `observation_cursor` advances independently.
  - HEAD `/api/attachments/{id}` returns 200 after a successful PUT;
    404 before.
- **Runtime budget:** < 2 min on CI.
- **Trigger:** every PR touching `synkronus/**` or `synkronus-cli/**`.

### 2. `headless-client` — Formulus service-layer E2E (medium, always on)

- **Compose:** same as above.
- **Driver:** a Node entry point (`e2e/headless/`) that imports the
  **non-RN-bound** parts of `formulus/src/services/` and
  `formulus/src/api/synkronus/` and runs them against the real Synkronus
  container. RN-specific modules (`react-native-fs`,
  `@react-native-async-storage/async-storage`, WatermelonDB native) are
  replaced with in-memory or `node:fs`-backed test doubles (the same
  doubles used by Jest unit tests).
- **What it proves:**
  - `commitDraftAttachmentsAfterSave` → pending → successful PUT → file
    appears in manifest.
  - `getRepositoryGenerationForRequestOrNull` + handlers: fresh install
    does not produce a "server reset" toast.
  - Server URL switch classification (`ServerSwitchDecision`) triggers
    a wipe warning when a real server URL changes.
  - Idempotent re-upload (HEAD short-circuit) after a simulated crash
    between PUT and `unlink(pending_upload/<id>)`.
  - Sweep of stale draft attachments past TTL.
- **Runtime budget:** < 5 min on CI.
- **Trigger:** every PR touching `formulus/src/**` or `synkronus/**`.

### 3. `full-stack-rn` — Formulus RN on emulator (expensive, nightly / on-label)

- **Compose:** Postgres + Synkronus + Android emulator image
  (`reactivecircus/android-emulator-runner` in CI; locally we
  recommend running Android Studio's AVD and pointing Detox at it).
- **Driver:** [Detox](https://wix.github.io/Detox/) against a debug APK
  of `formulus/` built with the compose-network Synkronus URL baked in
  via `SYNKRONUS_BASE_URL` env at build time.
- **What it proves (delta vs. `headless-client`):**
  - The actual `FormulusMessageHandlers` / Formplayer bridge path —
    form submission from an HTML WebView actually lands an attachment
    and promotes it.
  - `FormulusInterfaceDefinition.getAttachmentUri` resolves against
    `synced/` first, then `pending/`, then `draft/`, for a
    just-captured photo, a queued photo, and a fully-synced photo.
  - Settings screen server-URL switch UX actually shows the
    "local changes will be wiped" warning.
  - Repository-reset recovery path on a device that already has data.
- **Runtime budget:** 15–25 min.
- **Trigger:** nightly `main`, plus `needs-e2e` label on a PR.

> **Note:** only layer 1 needs to ship with the attachment-sync
> regression fix. Layer 2 should follow as a fast-follow PR; layer 3
> is a proper project with its own design doc.

---

## Repository layout (target)

```
e2e/
  README.md                   # this file
  docker-compose.e2e.yml      # postgres + synkronus for test env
  fixtures/
    users.json                # seeded users (admin / sync user)
    bundle-minimal.zip        # tiny custom app bundle for tests
  scripts/
    wait-for-synkronus.sh     # healthcheck poller used by all layers
    seed.sh                   # users + bundle + optional observations
    hard-reset.sh             # wraps `synk` hard-reset
  contracts/                  # layer 1 — server contract tests
    attachments_test.go
    generation_test.go
  headless/                   # layer 2 — Node harness
    package.json
    src/
      doubles/
        rnfs.ts
        async-storage.ts
        watermelon.ts
      scenarios/
        fresh-install.ts
        draft-promotion.ts
        reupload-idempotency.ts
        server-switch.ts
    jest.e2e.config.ts
  rn/                         # layer 3 — Detox, later
    .detoxrc.ts
    specs/
      attachment-capture.e2e.ts
      server-switch.e2e.ts
      repo-reset.e2e.ts
```

None of these files exist yet beyond `README.md` and
`docker-compose.e2e.yml`.

---

## `docker-compose.e2e.yml` — what it does

Mirrors the production `docker-compose.yml` but:

- Binds Postgres on a **random host port** via `ports: ["0:5432"]` so
  parallel CI jobs don't collide.
- Sets `JWT_SECRET` and `POSTGRES_PASSWORD` to stable test values
  (NEVER reused outside tests).
- Adds a `seed` one-shot service that runs `scripts/seed.sh` against
  the API once `synkronus` is healthy, then exits 0. Tests `depends_on`
  this service with `condition: service_completed_successfully`.
- Exposes `synkronus` on `${SYNKRONUS_HOST_PORT:-18080}` so local
  `synk` / `curl` sessions can hit it without colliding with a
  running `docker-compose up` dev stack.

Bring-up from the repo root:

```bash
docker compose -f docker-compose.yml -f e2e/docker-compose.e2e.yml \
  --profile e2e up --build --wait
```

Tear-down (including DB volume):

```bash
docker compose -f docker-compose.yml -f e2e/docker-compose.e2e.yml \
  --profile e2e down -v
```

---

## CI workflow stub

`.github/workflows/e2e-attachments.yml` (skeleton) wires up layer 1 and
layer 2. It is intentionally **disabled on `push`** today — the job is
defined so reviewers can see the shape, but only runs on
`workflow_dispatch` until the test code lands.

Layer 3 will get its own workflow (`e2e-formulus-rn.yml`) driven by
`reactivecircus/android-emulator-runner`. It is out of scope for this
change.

---

## Authoring guidance

- **Prefer layer 1 for any bug that can be reproduced with `curl` +
  `synk`.** It stays green the fastest and pins behavior at the
  public API.
- **Use layer 2 for client-state bugs** (cursors, generation,
  promotion, sweep, URL switch decision). It's still fast and catches
  regressions without a simulator.
- **Only reach for layer 3 when the bug is in the WebView bridge or
  native I/O.** Those tests are expensive; scope them tightly.
- Every regression test should name the symptom, not the
  implementation: `fresh_install_does_not_see_repository_reset_toast`,
  not `getRepositoryGenerationForRequestOrNull_returns_null`.

---

## Status

| Item | State |
|------|-------|
| `README.md` (this file) | drafted |
| `docker-compose.e2e.yml` | skeleton (build target only, no tests) |
| `.github/workflows/e2e-attachments.yml` | stub (workflow_dispatch only) |
| Layer 1 contract tests | **not yet implemented** |
| Layer 2 headless harness | **not yet implemented** |
| Layer 3 Detox specs | **not yet designed** |
