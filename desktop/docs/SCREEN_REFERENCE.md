# Custodian — screen reference

Structured product/UX reference for the ODE Custodian (Tauri) app.

## Navigation

Hash routes: `#/overview`, `#/observations`, `#/import`, `#/sync`, `#/profiles`.

**Redirects (bookmarks):** `#/` → Overview; `#/explorer` and `#/records` → Observations; `#/health` → Overview; `#/workspace` and `#/settings` → Profiles.

**Sidebar (primary):** Overview, Observations, Import, Sync, Profiles.

**App shell:** Brand, sidebar nav, footer server status (polls `GET {activeProfile.serverUrl}/health`), Open Data Ensemble credit.

---

## Per-screen specifications

Authoritative detail for each primary screen (purpose, user questions, scope, actions, data):

| Screen   | Spec |
|----------|------|
| Overview | [docs/screens/overview.md](./screens/overview.md) |
| Observations | [docs/screens/observations.md](./screens/observations.md) |
| Import   | [docs/screens/import.md](./screens/import.md) |
| Sync     | [docs/screens/sync.md](./screens/sync.md) |
| Profiles | [docs/screens/profiles.md](./screens/profiles.md) |

---

## Follow-up (review checklist)

| Task | Status | Notes |
|------|--------|--------|
| Keyring / Linux fallback | Done | See [profiles.md](./screens/profiles.md) |
| Structured UI review | Open | Walk specs above; mark keep/remove/defer |
| Linux deps for testers | Optional | README / Profiles: Secret Service for saved passwords |
| Token storage hardening | Future | Tokens in `localStorage` per profile; could move to keyring |

Capture review decisions in an issue or doc section with a date.
