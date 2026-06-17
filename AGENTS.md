# Open Data Ensemble (ODE) — AI and developer guide

This monorepo contains the core platform for **offline-first data collection** and **synchronization**. Use this file when you work across packages or need the big picture. For deep dives, open the **`AGENTS.md`** in the package you are changing.

**Published architecture (users and external readers):** [Architecture overview](https://opendataensemble.org/docs/getting-started/architecture-overview) on [opendataensemble.org](https://opendataensemble.org/).

---

## Ecosystem map

ODE is a **clearinghouse** model: data is collected on devices, synchronized through **Synkronus**, and is intended to **flow through** the system for local analysis and stewardship—not to live only on the server.

- **Formulus** — React Native mobile app: runs forms (JSON Forms) and **custom app bundles** in WebViews, offline-first, syncs with Synkronus.
- **Formulus Formplayer** — React web app embedded in Formulus: renders forms inside a WebView; shares the same bridge contract as custom apps.
- **Synkronus** — Go backend: auth, sync, app bundle distribution, export, shared HTTP API.
- **Synkronus Portal** — Web admin UI (React + Vite): same API as other clients; no privileged backend channel.
- **Synkronus CLI** — `synk` command-line client: automation, bundles, sync, export.
- **ODE Desktop** — Tauri app: **Data management** + **Forms / app workbench**; source in [`desktop/`](desktop/). See [ROADMAP.md](ROADMAP.md).

```mermaid
flowchart LR
  Formulus[Formulus_RN]
  Formplayer[Formulus_Formplayer]
  Synkronus[Synkronus_API]
  Portal[Portal]
  CLI[CLI]
  Formulus -->|sync| Synkronus
  Portal -->|same_API| Synkronus
  CLI -->|same_API| Synkronus
  Formulus -->|hosts_WebView| Formplayer
```

**Design principle:** [One backend, many clients](https://opendataensemble.org/docs/getting-started/architecture-overview) — prefer the public API for all user-facing tools.

---

## User profiles (what to optimize for)

| Profile | Typical focus | Where to work |
|--------|----------------|---------------|
| **Platform developer** | You are editing **this repo**: RN, Go, React, shared packages, CI. | Package `AGENTS.md` below. |
| **Custom app author** | You ship an **HTML/JS/CSS** app bundle and JSON forms for Formulus; you may **not** clone this monorepo. | [Custom app template (AI + author context)](https://github.com/OpenDataEnsemble/custom_app) and [documentation](https://opendataensemble.org/docs/). |

Do not assume custom app authors have local checkouts of **ODE** or internal example repos.

---

## Monorepo layout

| Package | Role | Stack | Agent guide |
|---------|------|-------|-------------|
| [formulus](formulus/) | Mobile runtime, WebViews, native bridge | React Native | [formulus/AGENTS.md](formulus/AGENTS.md) |
| [formulus-formplayer](formulus-formplayer/) | Form UI in WebView | React, Vite, JSON Forms | [formulus-formplayer/AGENTS.md](formulus-formplayer/AGENTS.md) |
| [synkronus](synkronus/) | Sync API and coordination | Go | [synkronus/AGENTS.md](synkronus/AGENTS.md) |
| [synkronus-cli](synkronus-cli/) | CLI for API operations | Go | [synkronus-cli/AGENTS.md](synkronus-cli/AGENTS.md) |
| [synkronus-portal](synkronus-portal/) | Web administration | React, TypeScript, Vite | [synkronus-portal/AGENTS.md](synkronus-portal/AGENTS.md) |
| [packages/tokens](packages/tokens/) | Design tokens (`@ode/tokens`) | Style Dictionary | [packages/tokens/AGENTS.md](packages/tokens/AGENTS.md) |
| [packages/components](packages/components/) | Shared UI (`@ode/components`) | React | [packages/components/AGENTS.md](packages/components/AGENTS.md) |
| [desktop](desktop/) | Data management + Forms / app workbench (Tauri) | React, Rust | [desktop/AGENTS.md](desktop/AGENTS.md) |

---

## Cross-cutting contracts

- **Formulus ↔ WebView (custom apps + formplayer):** [`formulus/src/webview/FormulusInterfaceDefinition.ts`](formulus/src/webview/FormulusInterfaceDefinition.ts) is the **source of truth** for the injected JavaScript API. Formplayer copies a synced TypeScript snapshot via `pnpm run sync-interface` in `formulus-formplayer` (see [formulus-formplayer/AGENTS.md](formulus-formplayer/AGENTS.md)).
- **ODE Desktop workbench developer mode:** local custom app mirror under `bundles/dev-local/` (profile-scoped); see [desktop/AGENTS.md](desktop/AGENTS.md) and [developer mode guide](https://opendataensemble.org/docs/guides/ode-desktop-developer-mode).
- **Built-in attachment fields:** `photo`, `audio`, `video`, and generic file (`select_file`) persist attachment **basenames** (and metadata) in observation JSON while binaries live under Formulus **`attachments/`** storage and sync via the attachment pipeline—see published docs ([form specifications](https://opendataensemble.org/docs/reference/form-specifications), [form design guide](https://opendataensemble.org/docs/guides/form-design)) and [`FormulusInterfaceDefinition.ts`](formulus/src/webview/FormulusInterfaceDefinition.ts).
- **Custom app bridge (v1.1.0+):** `persistObservation` (headless write), `sync`, `getConnectivityStatus`, `getCurrentDataRevisionCount`, and `openFormplayer` options `skipFinalize` / `skipDraftSelection` — contract in [`FormulusInterfaceDefinition.ts`](formulus/src/webview/FormulusInterfaceDefinition.ts); run `pnpm run sync-interface` in formplayer after changes.
- **Sub-observations:** Each nested Formplayer session validates its own schema; `skipFinalize` only skips the Finalize page. Custom validators are per-session — see [Custom Extensions — nested sessions](https://opendataensemble.org/docs/guides/custom-extensions#nested-sessions-and-custom-validators) (docs site).
- **Shared UI tokens:** Install **tokens** before **components** / **formplayer** where the docs require it (see package READMEs and formplayer AGENTS).

---

## CI and code quality

- **Pipelines:** [.github/CICD.md](.github/CICD.md).
- **Lint/format:** Run the relevant scripts in the **package you touch** (see root [README.md](README.md) and each package).
- **Pre-flight before opening a PR:** each package `AGENTS.md` lists the local `lint` / `format:check` / `test` / `build` commands that match CI — run them in every package you changed (e.g. [formulus-formplayer/AGENTS.md](formulus-formplayer/AGENTS.md#pre-flight-before-a-pr)).
- **Commits/PRs:** Conventional Commits and PR expectations are documented in [formulus-formplayer/AGENTS.md](formulus-formplayer/AGENTS.md) (project-wide convention).

---

## Roadmap

ODE Desktop ships in [`desktop/`](desktop/) (see [desktop/AGENTS.md](desktop/AGENTS.md)). Broader product direction: [ROADMAP.md](ROADMAP.md) and [opendataensemble.org](https://opendataensemble.org/docs/).

---

## Custom app authors (pointer)

Authoritative **public** documentation: [opendataensemble.org](https://opendataensemble.org/docs/).

Optional **AI-focused** context (no ODE clone required): [custom_app](https://github.com/OpenDataEnsemble/custom_app) on GitHub (`README.md`, `AGENTS.md`, `CONTEXT_*.md`).
