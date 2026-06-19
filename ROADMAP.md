# ODE roadmap

## Principles

- **Runtime flexibility** — tailored collection experiences (JSON Forms, custom apps).
- **Data sovereignty** — data should **flow through** the system; **Synkronus** is a **clearinghouse**, not a warehouse. One **public API**; no privileged clients.

Details: [architecture overview](https://opendataensemble.org/docs/getting-started/architecture-overview).

---

## What exists (monorepo)

| Piece | Role |
|-------|------|
| **Synkronus** | Sync, auth, bundles, export, API |
| **Formulus** | Mobile client: forms + custom apps, offline-first |
| **Formulus Formplayer** | Web bundle embedded in Formulus (JSON Forms UI) |
| **Portal** | Browser admin: users, bundles, export |
| **Synkronus CLI** | Scripting, automation, `synk` |
| **ODE Desktop** | Desktop app: data management + forms/app workbench ([`desktop/`](desktop/)) |

CI overview: [.github/CICD.md](.github/CICD.md).

---

## ODE Desktop

**Tauri** app (React + Rust): **ODE Desktop**, two modes in one window:

| Mode | Purpose |
|------|---------|
| **Data management** | Local copy of synced data; inspect, edit, push corrections |
| **Forms / app workbench** | Bundle + formplayer + custom-app test; bundle deploy (with safeguards) |

Same Synkronus API as everything else. Form behaviour should match **Formulus** / **formplayer** for the same bundle (extensions, `ext.json`, custom question types).

Detailed requirements live in the **ODE Desktop** project plan ([`desktop/`](desktop/) in this repo). Implementation is modular, not phased.

**Backlog:** [Custom data-management apps](desktop/docs/CUSTOM_DATA_APPS.md) — optional Workbench mini-apps shipped in the bundle for choice-list admin, randomization, cleaning, etc.

---

## Product map

- **Field collection** → Formulus  
- **Server ops** → Portal (and CLI)  
- **Automation** → CLI  
- **Local data + desktop tooling** → ODE Desktop  

---

## Decisions (short)

1. JSON observations are canonical; tables are derived.  
2. Local custody is first-class (extract → work locally → push).  
3. ODE Desktop does **not** ship as a second “Workshop” app — workbench is a **mode**.
