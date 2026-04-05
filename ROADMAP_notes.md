# 🧭 ODE Architecture & Product Division (Decision Log)

## 🎯 Purpose

This document summarizes how ODE functionality is divided across components, based on:

- user profiles
- responsibilities
- current implementation
- planned evolution

It serves as a **companion to the roadmap**, explaining *why* functionality lives where it does.

---

# 🧠 Core Architectural Principle

> **Synkronus is a data clearinghouse, not a data warehouse.**

This leads to three key consequences:

1. Data is expected to **flow through**, not remain centrally stored
2. Users must be able to **extract and retain local copies**
3. Functionality is distributed across **multiple specialized clients**

---

# 🧱 Current State (What Exists Today)

## 1. Synkronus (Backend)

### Role
Central synchronization and coordination service.

### Responsibilities
- pull/push sync protocol
- authentication and user management
- app bundle hosting
- data export
- API for all clients

### Notes
- No privileged clients — everything uses the same API
- Acts as **hub**, not final storage

---

## 2. Formulus (Mobile Client)

### User Profile
- field workers
- data collectors

### Responsibilities
- render JSONForms
- run custom apps (webview)
- collect observations
- offline-first operation
- sync with Synkronus

### Key Insight
Formulus is the **runtime environment for data collection**, not a general-purpose data tool.

---

## 3. Portal (Web Client)

### User Profile
- administrators
- junior developers
- operational staff

### Responsibilities
- user management
- app bundle upload
- data export
- system administration

### Technical Note
- React app served as static assets
- uses same API as CLI
- no special backend access

### Positioning
Portal is the **operational interface** to Synkronus.

---

## 4. CLI (Synkronus CLI)

### User Profile
- power users
- senior developers
- automation / CI workflows

### Responsibilities
- sync operations
- deployment workflows
- scripting and automation
- admin tasks

### Positioning
CLI is the **scriptable control surface** of the platform.

---

# 🚧 Identified Gap

## Problem

Current system lacks a clear solution for:

- pulling data out of Synkronus in a structured way
- keeping a **durable local copy**
- modifying records safely
- pushing corrected data back

## Consequence

Without this:
- "clearinghouse" positioning is weak
- users risk relying on Synkronus as storage
- analysis workflows are fragmented

---

# 🆕 New Component: ODE Custodian

## Role

> **Local data stewardship and custody tool**

---

## User Profile

- analysts
- data managers
- technical project leads

---

## Responsibilities

### Core
- pull data from Synkronus
- store locally (JSON-first)
- maintain durable dataset

### Data Stewardship
- inspect records
- identify issues
- modify JSON documents
- track local changes ("dirty" state)

### Sync
- prepare push payloads
- push corrected records back

---

## Design Principles

- local-first
- JSON is canonical
- safe editing (avoid accidental writes)
- explicit sync state (clean vs dirty)

---

## Implementation Phases

### Phase 1 (Immediate)
- CLI-based workflows
- JSON files as local store
- optional Python scripting

### Phase 2
- structured local store (e.g. SQLite + JSON)
- dirty tracking
- query capabilities

### Phase 3
- desktop UI (Tauri)
- browsing, editing, validation

---

## Positioning

Custodian is:

> **The place where data lives after leaving Synkronus**

---

# 🆕 New Component: ODE Workshop

## Role

> **Development environment for custom apps and forms**

---

## User Profile

- developers
- solution designers
- advanced implementers

---

## Responsibilities

### Development
- load custom app bundles
- run apps locally

### Simulation
- inject `formulusAPI`
- provide mock or real data

### Testing
- validate app behavior
- debug interactions

---

## Future Capabilities

- JSONForms editor
- FormPlayer runtime
- live preview workflows

---

## Positioning

Workshop is:

> **Where collection experiences are built and tested**

---

# 🧩 Functional Division

## By Responsibility

| Function                        | Component        |
|--------------------------------|------------------|
| Data collection                | Formulus         |
| Sync + coordination            | Synkronus        |
| Administration                 | Portal / CLI     |
| Automation                     | CLI              |
| Local data custody             | Custodian        |
| Data cleaning & correction     | Custodian        |
| Custom app development         | Workshop         |

---

## By User Type

| User Type            | Primary Tool        |
|---------------------|---------------------|
| Field worker        | Formulus            |
| Admin / ops         | Portal              |
| Power user / DevOps | CLI                 |
| Analyst             | Custodian           |
| Developer           | Workshop            |

---

# 🔗 Relationships Between Components

## Shared Principles

- all clients use the **same Synkronus API**
- no hidden or privileged pathways
- consistent data model (JSON observations)

---

## Data Flow

```text
Formulus → Synkronus → Custodian → Analysis tools
                         ↑
                    (push corrections)