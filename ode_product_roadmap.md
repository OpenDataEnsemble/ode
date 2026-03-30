# ODE Product Roadmap

## Core Philosophy

ODE is built around two fundamental principles:

### 1. Runtime Flexibility  
Users can build and run tailored data collection experiences.

### 2. Data Sovereignty  
Data should **flow through the system**, not be trapped inside it.

> **Synkronus is a data clearinghouse and synchronization service.**  
> It facilitates data exchange between clients while enabling users to extract, retain, and work with their data locally.

---

# Platform Overview

## Core Backend

### Synkronus
Data clearinghouse and synchronization service.

**Responsibilities:**
- sync protocol (pull/push)
- authentication & user management
- app bundle distribution
- data export
- API for all clients

---

## Clients (Current)

### Formulus
Mobile data collection runtime.

- JSONForms-based data capture
- custom app execution (webview)
- offline-first sync with Synkronus

---

### Portal
Web-based operational client (React app).

- user and access management
- app bundle upload
- data export
- system administration

> Portal is a standard API client — no privileged backend access.

---

### CLI (Synkronus CLI)
Scriptable power-user and automation client.

- sync operations
- deployment workflows
- CI/CD integration
- admin tasks

---

# New Components

## Phase 1 — Local Custody (Immediate Priority)

### ODE Custodian (MVP via CLI)

**Purpose:**  
Enable users to **pull, retain, and curate data locally**, reinforcing Synkronus as a clearinghouse.

**Core capabilities:**
- pull data from Synkronus
- store locally in JSON-first format
- inspect and modify records
- push corrected records back

**Initial implementation:**
- CLI-driven workflows
- optional Python helper scripts

**Example workflow:**
```bash
synk pull --out ./dataset
# inspect / modify JSON
synk push-json ./corrected-records
```

**Outcome:**
- users gain true data ownership
- enables offline workflows
- establishes trust in ODE architecture

---

## Phase 2 — Structured Local Store

### Custodian Data Layer

**Purpose:**  
Introduce a more robust local datastore.

**Design:**
- JSON as canonical record format
- optional structured store (e.g. SQLite + JSON blobs)
- sync metadata tracking (dirty state, etc.)

**Capabilities:**
- track local modifications
- identify "dirty" records
- prepare push payloads
- support efficient querying

---

## Phase 3 — Desktop Custodian

### ODE Custodian (Desktop UI)

**Purpose:**  
Provide a user-friendly interface for data stewardship.

**Suggested tech:**
- Tauri (webview-based desktop app)

**Features:**
- browse local datasets
- search and filter records
- JSON viewer/editor
- validation tools
- push corrections to Synkronus
- sync status visibility

**Design principles:**
- safe editing (no accidental writes)
- clear separation of local vs remote state
- audit-friendly workflows

---

## Phase 4 — Workshop (Development Environment)

### ODE Workshop

**Purpose:**  
Provide a desktop harness / workbench for running custom apps in a Formulus-like environment.

ODE Workshop enables developers to run, test, and debug custom applications locally against a runtime that mirrors Formulus.

**Core capabilities:**
- load custom app bundles
- run apps in a webview
- inject a `formulusAPI` compatible interface
- use mock, local, or synced data
- debug and iterate rapidly

**Key idea:**
> Develop custom apps against a local runtime that mirrors Formulus, then deploy with confidence.

**Stretch goals:**
- JSONForms editor
- FormPlayer desktop runtime
- live preview and test harness workflows

---

## Phase 5 — Integration Layer

**Shared foundations between Custodian and Workshop:**

- local datastore
- sync engine (extracted from CLI)
- `formulusAPI` abstraction
- authentication/session handling

**Architecture goal:**
> One backend, one sync contract, multiple specialized clients.

---

# Product Structure

## Backend
- Synkronus (data clearinghouse)

## Clients
- Formulus (collection)
- Portal (admin/ops)
- CLI (automation)
- Custodian (local data stewardship)
- Workshop (custom app development)

---

# Key Design Decisions

### 1. Synkronus is not a data warehouse  
It is a clearinghouse — data is expected to leave.

### 2. JSON is the canonical data format  
Tabular representations are derived, not primary.

### 3. Local custody is first-class  
Users should always be able to:
- extract
- store
- analyze
- curate

### 4. One API, many clients  
All components interact through the same backend API.

### 5. Separation of concerns  
- Custodian = data stewardship  
- Workshop = development  
- Portal = operations  

---

# Immediate Next Steps

1. Implement CLI-based:
   - `synk pull`
   - `synk push-json`

2. Define local JSON storage convention

3. Provide basic scripting examples (Python)

4. Validate real-world workflow:
   - pull → inspect → modify → push

---

# Strategic Positioning

ODE is:

> An open, extensible, local-first data collection and processing ecosystem

With:
- flexible runtime (Formulus + custom apps)
- clean sync backbone (Synkronus)
- user-owned data workflows (Custodian)
- developer tooling (Workshop)
