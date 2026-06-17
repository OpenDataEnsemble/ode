# ODE Architecture

ODE is an open, extensible, local-first data collection and processing ecosystem.

It is designed around a simple principle:

> **Data should flow through the system, not be trapped inside it.**

That principle shapes both the architecture and the product strategy behind ODE.

---

## The Big Picture

ODE is a coordinated set of components that work together through a shared API and synchronization model - like a well-playing jazz ensemble.

At a high level, the ecosystem consists of:

- **Formulus** for offline-first data collection
- **Synkronus** for synchronization and coordination
- **Portal** for web-based administration and operations
- **CLI** for scripting, automation, and power-user workflows
- **ODE Custodian** for local data stewardship and curation *(planned)*
- **ODE Workshop** for custom app and form development *(planned)*

---

## Core Philosophy

### Runtime flexibility

ODE supports tailored data collection experiences rather than forcing every project into a single rigid UI.

This is enabled through:

- JSONForms-based form rendering
- custom applications running inside a webview
- a shared API surface for interacting with local data and runtime features

### Data sovereignty

ODE is designed so that users can pull data out, retain it locally, analyze it in their own environment, and optionally push curated corrections back.

This is why **Synkronus is best understood as a data clearinghouse and synchronization service, not a data warehouse**.

---

## Existing Components

## Synkronus

**Synkronus** is the backend synchronization and coordination service at the center of ODE.

Its responsibilities include:

- pull/push synchronization
- authentication and user management
- app bundle distribution
- export functionality
- a shared API for ODE clients

Synkronus acts as the **hub** of the system, but not as the final resting place for data. It facilitates exchange between clients and supports local ownership of data outside the server.

---

## Formulus

**Formulus** is the mobile runtime for field data collection.

It is responsible for:

- rendering JSONForms-based forms
- running custom apps inside a webview
- collecting observations
- working offline-first
- synchronizing with Synkronus

Formulus is focused on the collection experience. It is not intended to be the administrative interface or the primary environment for downstream data stewardship.

---

## Portal

**Portal** is the browser-based operational client for Synkronus.

It supports tasks such as:

- user management
- app bundle upload
- data export
- administrative operations

Portal is a standard client of the same Synkronus API used by other ODE components. It does not rely on privileged side-channel access to the backend.

This makes it a clean, transparent part of the overall architecture rather than a special-case admin panel.

---

## CLI

The **Synkronus CLI** is the scriptable and automation-friendly client in the ODE ecosystem.

It is particularly useful for:

- power users
- senior developers
- CI/CD workflows
- deployment and automation
- administrative tasks
- direct sync workflows

The CLI and Portal are complementary. They serve different user preferences while relying on the same underlying API.

---

## Planned Components

## ODE Custodian

**ODE Custodian** is the planned local data stewardship tool in the ODE ecosystem.

Its purpose is to make the "clearinghouse" model operational and credible.

Custodian is intended to allow users to:

- pull data from Synkronus
- keep a durable local copy
- inspect records locally
- modify JSON records where appropriate
- track local changes
- push corrected records back to Synkronus

The first steps toward Custodian are expected to be CLI-driven, with simple local JSON workflows and scripting support. Over time, this can evolve toward a richer local data layer and a desktop interface.

Custodian is aimed at people who need to **retain, curate, and steward real project data** outside the server.

---

## ODE Workshop

**ODE Workshop** is the planned development environment for custom ODE apps and forms.

Its purpose is to make development faster, more transparent, and more pleasant than relying entirely on mobile-device iteration loops.

Workshop is envisioned to support:

- loading custom app bundles locally
- running them in a desktop webview
- injecting a compatible `formulusAPI`
- using mock or real local data
- debugging and rapid iteration
- future JSONForms editing workflows
- future FormPlayer-based development loops

Workshop is aimed at developers, advanced implementers, and solution designers who need a focused environment for building and testing collection experiences.

---

## Functional Division

ODE deliberately separates responsibilities rather than forcing every workflow into a single application.

### Collection
Handled by **Formulus**

### Synchronization and coordination
Handled by **Synkronus**

### Administration and operations
Handled by **Portal** and **CLI**

### Local data stewardship and correction
Planned for **ODE Custodian**

### Custom app and form development
Planned for **ODE Workshop**

This separation helps keep each tool understandable and aligned with the needs of its users.

---

## User Profiles

Different ODE components are optimized for different kinds of users.

### Field workers
Primarily use **Formulus**

### Administrators and operational staff
Primarily use **Portal**

### Power users, senior developers, and automation workflows
Primarily use the **CLI**

### Analysts, data managers, and technical project leads
Will primarily benefit from **ODE Custodian**

### Developers and solution designers
Will primarily benefit from **ODE Workshop**

---

## Why the Architecture Matters

Many systems in this space do one part well:

- data collection
- administrative workflows
- analysis
- extensibility
- local ownership

ODE aims to connect these concerns without forcing them into the same interface.

This architecture matters because it creates room for:

- robust offline-first collection
- clear synchronization boundaries
- local data ownership
- extensible project-specific experiences
- both graphical and scriptable workflows

---

## Architecture Principle: One Backend, Many Clients

A core design decision in ODE is that user-facing components should, where practical, act as clients of the same Synkronus API.

This means:

- no hidden privileged pathways
- cleaner security boundaries
- easier reuse across components
- more consistent behavior between tools
- clearer mental models for users and developers

In practice, this already holds for:

- Portal
- CLI
- Formulus

And it is expected to guide the design of:

- Custodian
- Workshop

---

## Data Flow

A simplified data flow looks like this:

```text
Formulus → Synkronus → Custodian → analysis environment
                         ↑
                  push curated corrections
```

This reflects the intended role of Synkronus as a clearinghouse: data is collected, synchronized, extracted, retained locally, analyzed, and in some cases corrected and pushed back.

---

## Development Flow

A simplified development flow looks like this:

```text
Workshop → Formulus → Synkronus
```

Workshop is intended to shorten the path from custom app and form development to real runtime behavior in Formulus.

---

## What Already Exists vs What Is Envisioned

### Already in place

- **Synkronus** as synchronization and coordination backend
- **Formulus** as offline-first mobile client
- **Portal** as web-based operational client
- **CLI** as scriptable and automation-friendly client
- a shared API model across current clients
- export support from Synkronus

### In active product thinking and future development

- **ODE Custodian** for local data custody, cleaning, and push-back workflows
- **ODE Workshop** for custom app and form development
- richer local data handling and dirty tracking
- desktop tooling based on a webview-friendly stack
- stronger bridges between runtime, operations, and data stewardship

---

## Strategic Positioning

ODE is more than a form app and more than a sync server.

It is an effort to provide:

- a flexible collection runtime
- a clear synchronization backbone
- local-first data ownership
- specialized clients for different roles
- an extensible platform for tailored solutions

In short:

> **ODE is an open, extensible, local-first data collection and processing ecosystem.**
