---
sidebar_position: 10
---

# ODE Desktop Reference

Complete technical reference for **ODE Desktop** — the Open Data Ensemble desktop application for data stewardship and app development.

:::info Released in ODE v1.1.0

ODE Desktop joined the ODE ensemble in **v1.1.0**. See [Installing ODE Desktop](/docs/getting-started/installation/installing-ode-desktop) for download and setup.

:::

## Overview

ODE Desktop is a **Tauri** application (React + Rust) that provides two modes in one window:

| Mode | Purpose |
|------|---------|
| **Data management** | Pull, inspect, correct, and sync **observations**; import JSON; manage conflicts and local workspace state. |
| **Forms / app workbench** | Develop and test **app bundles**, embedded **formplayer**, and **custom apps** — aligned with Formulus and the shared WebView contract. |

## Who it is for

- **Field and data staff** managing observations and sync (Data management mode).
- **Form and app authors** testing bundles and custom apps against Synkronus before mobile deploy (Workbench mode).

## Relationship to other ODE components

ODE Desktop uses the **same public Synkronus API** as Formulus, Portal, and the CLI — there is no privileged desktop channel.

| Component | Role relative to ODE Desktop |
|-----------|------------------------------|
| **Synkronus** | Server for sync, auth, and app bundle distribution |
| **Formulus** + **formplayer** | Runtime parity target for forms and custom apps |
| **Portal** | Browser admin for users, bundles, and export |
| **Synkronus CLI** | Scripting and automation against the same API |

## Technology stack

- **Shell**: Tauri 2 (Rust backend, native WebView)
- **Frontend**: React, TypeScript, Vite
- **Local storage**: SQLite per profile workspace; attachments on disk
- **Formplayer**: Bundled under `public/formplayer_dist/` (same contract as Formulus)

## Profiles and workspace

Each **profile** is a server-scoped unit of custody:

- Synkronus server URL and credentials
- Dedicated **workspace folder** (SQLite database, attachments, bundle cache)
- Optional OS keyring storage for passwords

Typical workspace layout:

```
<workspace>/
  repository.sqlite
  attachments/
  bundles/
    active/          ← Synk-downloaded bundle (app/, forms/, etc.)
    dev-local/       ← Developer mode mirror (when enabled)
      app/
      forms/
```

Switch profiles from **Data management → Profiles**. Authentication is per profile.

## Data management screens

| Screen | Route | Purpose |
|--------|-------|---------|
| Profiles | `#/data/profiles` | Configure server, workspace, and authentication |
| Observations | `#/data/observations` | Search, edit, and resolve local observations |
| Import | `#/data/import` | Import JSON observation files |
| Sync | `#/data/sync` | Pull, push, and workspace maintenance |
| About | `#/data/about` | Support links and license |

See the [ODE Desktop user guide](/docs/using/ode-desktop/) for step-by-step workflows.

## Workbench screens

| Screen | Route | Purpose |
|--------|-------|---------|
| Bundles | `#/workbench/bundles` | List server bundle versions; download and apply |
| Form preview | `#/workbench/form-preview` | Open forms from the bundle with init JSON |
| Custom app | `#/workbench/custom-app` | Embed the custom app WebView |

**Developer mode** mirrors a local folder (with `index.html`) into `bundles/dev-local/` so you can iterate without overwriting `bundles/active/`. See [ODE Desktop developer mode](/docs/guides/ode-desktop-developer-mode).

## Formplayer and bridge parity

ODE Desktop loads formplayer and custom apps with the same **Formulus bridge contract** (`FormulusInterfaceDefinition`). In Workbench preview:

- **Observations and attachments** use the profile SQLite store and Tauri file APIs where applicable.
- **Device APIs** (camera, GPS, QR, audio, video) are **stubbed** in preview — same limitation as before developer mode.
- **Nested sub-observations** (`openFormplayer` with `subObservationMode`) open stacked preview sessions; child schemas validate independently.

Bundle extensions (`forms/ext.json`, per-form `ext.json`) follow the same merge rules as Formulus.

## Observation indexes

Custom apps declare `observationIndexes` in `app.config.json`. ODE Desktop builds a local index table for fast `getObservationsByQuery` — indexes are **device-local** and never synced to Synkronus.

After changing index declarations or bulk imports, use **Sync → Re-create index**. When developer mode is on, indexes read from the mirrored app under `bundles/dev-local/app/`. See [Observation queries](/docs/guides/observation-queries).

## Installation

- **End users**: [Installing ODE Desktop](/docs/getting-started/installation/installing-ode-desktop)
- **Contributors**: [ODE Desktop Development](/docs/development/ode-desktop-development)

## Related documentation

- [ODE Desktop user guide](/docs/using/ode-desktop/) — screen-by-screen usage
- [ODE Desktop developer mode](/docs/guides/ode-desktop-developer-mode) — local custom app iteration
- [Understanding app bundles](/docs/using/app-bundles) — bundle structure and Synkronus distribution
- [Custom applications](/docs/using/custom-applications) — custom app role in bundles
- [Architecture overview](/docs/getting-started/architecture-overview) — full ODE ecosystem
