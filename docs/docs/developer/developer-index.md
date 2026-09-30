---
sidebar_position: 4
title: ⚙️ For Developers
---

# Development & Engineering

Welcome to the **Developer** section! Whether you're contributing to ODE, building custom extensions, or deploying the platform, this guide covers development, architecture, and contribution workflows.

:::note Documentation paths
Persona pages live under `/docs/developer/`; technical guides under `/docs/development/`. Deploying for production? Start with [Server Architecture for IT](/docs/guides/server-architecture-for-it).
:::

## Who This Guide Is For

This section is designed for:

- Software engineers contributing to ODE
- Developers building custom applications with ODE
- System administrators deploying ODE
- Architects evaluating ODE architecture
- Contributors wanting to improve the codebase

:::tip AI coding assistants
Building **custom applications** (HTML, JS, CSS bundles and JSON forms) without cloning the ODE monorepo? Use the **[custom_app](https://github.com/OpenDataEnsemble/custom_app)** repository on GitHub (`AGENTS.md` and `CONTEXT_*.md` for assistants and authors), together with the main **[documentation](https://opendataensemble.org/docs/)** site.
:::

:::info Not developing?
If you're collecting data, see the [Data Collector Guide](/docs/collector/collector-index).  
If you're designing forms, see the [Implementer Guide](/docs/implementer/implementer-index).
:::

## Quick Start

Set up your development environment in 20 minutes:

1. **[Getting Started](/docs/developer/developer-getting-started)** - Choose your path
2. **[Architecture Overview](/docs/development/architecture)** - Understand the system
3. **[Set Up Environment](/docs/development/setup)** - Install dependencies
4. **[Run Tests](/docs/development/building-testing)** - Verify your setup

## What You'll Learn

<div className="row">
  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>🚀 Getting Started</h4>
      </div>
      <div className="card__body">
        <p>Choose your development path and get started.</p>
        <a className="button button--primary button--sm button--block" href="/docs/developer/developer-getting-started">Start →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>🏗️ Architecture</h4>
      </div>
      <div className="card__body">
        <p>Deep dive into ODE system design and components.</p>
        <a className="button button--primary button--sm button--block" href="/docs/development/architecture">Learn More →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>🔧 Setup Environment</h4>
      </div>
      <div className="card__body">
        <p>Configure your dev machine and install dependencies.</p>
        <a className="button button--primary button--sm button--block" href="/docs/development/setup">Setup →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>🏗️ Build & Test</h4>
      </div>
      <div className="card__body">
        <p>Build projects and run test suites.</p>
        <a className="button button--primary button--sm button--block" href="/docs/development/building-testing">Learn More →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>🤝 Contributing</h4>
      </div>
      <div className="card__body">
        <p>How to contribute to ODE development.</p>
        <a className="button button--primary button--sm button--block" href="/docs/development/contributing">Contribute →</a>
      </div>
    </div>
  </div>

  <div className="col col--6 col--12-mobile margin-bottom--md">
    <div className="card card--compact">
      <div className="card__header">
        <h4>⚡ Extending ODE</h4>
      </div>
      <div className="card__body">
        <p>Build custom extensions and integrations.</p>
        <a className="button button--primary button--sm button--block" href="/docs/development/extending">Learn More →</a>
      </div>
    </div>
  </div>
</div>

## Documentation Roadmap

### 🚀 Get Started
- [Development Paths](/docs/developer/developer-getting-started#paths)
- [Prerequisites & Requirements](/docs/developer/developer-getting-started#prerequisites)
- [Quick Start Guide](/docs/developer/developer-getting-started#quick-start)

### 🏗️ Understand Architecture
- [System Overview](/docs/development/architecture)
- [Component Architecture](/docs/development/architecture#components)
- [Data Flow & Sync Protocol](/docs/development/architecture#data-flow)
- [Authentication & Security](/docs/reference/security)

### 🔧 Set Up Environment
- [macOS Setup](/docs/development/setup#macos)
- [Linux Setup](/docs/development/setup#linux)
- [Windows Setup](/docs/development/setup#windows)
- [Docker Setup](/docs/development/setup#docker)

### 📚 Component Development
- [Formulus (React Native)](/docs/development/formulus-development)
- [Synkronus Server (Go)](/docs/development/synkronus-development)
- [Formplayer (React)](/docs/development/formplayer-development)
- [Synkronus CLI (Go)](/docs/development/setup)

### 🏗️ Building & Testing
- [Building Projects](/docs/development/building-testing#building)
- [Running Tests](/docs/development/building-testing#testing)
- [Code Quality & Linting](/docs/development/building-testing#quality)
- [CI/CD Pipeline](/docs/development/building-testing#ci-cd)

### 🤝 Contributing
- [Contributing Workflow](/docs/development/contributing#workflow)
- [Code Standards](/docs/development/contributing#standards)
- [Commit Messages](/docs/development/contributing#commits)
- [Pull Request Process](/docs/development/contributing#pull-requests)
- [Code of Conduct](/docs/community/contribute/code-of-conduct)

### ⚡ Extending ODE
- [Custom Applications](/docs/development/extending#custom-apps)
- [Custom Form Controls](/docs/development/extending#form-controls)
- [Server Plugins](/docs/development/extending#plugins)
- [Integration Patterns](/docs/development/extending#integrations)

### 📖 API Reference
- [REST API Overview](/docs/reference/rest-api/overview)
- [Authentication](/docs/reference/rest-api/authentication)
- [Sync Protocol](/docs/reference/rest-api/sync)
- [App Bundle Format](/docs/reference/app-bundle-format)
- [Attachments](/docs/reference/rest-api/attachments)

## Development Paths

### Path 1: Contributing to ODE Core

You want to help improve Formulus, Synkronus, or Formplayer.

1. [Clone the monorepo](https://github.com/OpenDataEnsemble/ode)
2. [Set up environment](/docs/development/setup)
3. [Choose a component](/docs/development)
4. [Follow contributing guide](/docs/development/contributing)

→ **Best for:** Passionate developers improving the platform

### Path 2: Building Custom Applications

You want to build custom data collection applications on ODE.

1. [Understand architecture](/docs/development/architecture)
2. [Learn the REST API](/docs/reference/rest-api/overview)
3. [Set up development environment](/docs/development/setup)
4. [Follow extending guide](/docs/development/extending)

→ **Best for:** Building organization-specific solutions

### Path 3: System Administration & Deployment

You want to deploy and manage ODE in your infrastructure.

1. [Understand system architecture](/docs/development/architecture)
2. [Read deployment guide](/docs/guides/deployment)
3. [Learn configuration options](/docs/reference/configuration/server)
4. [Set up monitoring](/docs/development/setup#monitoring)

→ **Best for:** SysAdmins and DevOps engineers

### Path 4: Integration & APIs

You want to integrate ODE with external systems.

1. [Learn REST API](/docs/reference/rest-api/overview)
2. [Understand app bundle format](/docs/reference/app-bundle-format)
3. [Review sync protocol](/docs/reference/rest-api/sync)
4. [Build custom integrations](/docs/development/extending#integrations)

→ **Best for:** Backend developers and integrations engineers

## Tech Stack Overview

### Formulus (Mobile App)
- **Language:** TypeScript/JavaScript
- **Framework:** React Native
- **Database:** WatermelonDB
- **Platforms:** Android, iOS

### Synkronus (Server)
- **Language:** Go 1.22+
- **Database:** PostgreSQL
- **API:** REST + OpenAPI
- **Deployment:** Docker, Kubernetes

### Formplayer (Form Renderer)
- **Language:** TypeScript/JavaScript
- **Framework:** React
- **Rendering:** JSON Forms
- **Execution:** WebView (Formulus) or Browser

### Synkronus CLI
- **Language:** Go
- **Distribution:** Prebuilt binaries
- **Package Manager:** Homebrew, curl

## Key Architecture Concepts

### Offline-First Design
```
Device                          Server
├─ Local DB                      ├─ PostgreSQL
│  (WatermelonDB)                │
├─ Forms Cache                   ├─ REST API
└─ Sync Queue                    ├─ Sync Engine
   (offline buffer)              └─ Authentication
```

### Client-Server Sync
```
1. Pull: Client requests new forms from server
2. Push: Client sends completed submissions
3. Merge: Server resolves conflicts
4. Acknowledge: Client marks submissions as synced
```

### Authentication & Security
- JWT-based authentication
- Role-based access control (RBAC)
- End-to-end encryption options
- Secure offline token storage

## Getting Help

- **Architecture questions?** → [Read Architecture Guide](/docs/development/architecture)
- **Setup issues?** → [Setup Environment](/docs/development/setup)
- **Contributing questions?** → [Contributing Guide](/docs/development/contributing)
- **API documentation?** → [REST API](/docs/reference/rest-api/overview)
- **Need community help?** → [Community Support](/docs/community/getting-help)

## Contribution Ideas

Here are some ways to contribute:

| Contribution | Difficulty | Impact |
|--------------|------------|--------|
| Fix typos in docs | Easy | High |
| Report bugs | Easy | High |
| Fix UI bugs | Medium | High |
| Add tests | Medium | High |
| Implement features | Medium-Hard | High |
| Add new form control | Hard | High |
| Database optimization | Hard | Medium |
| Mobile performance | Hard | High |

## Code Quality Standards

ODE maintains high code quality:

- ✅ ESLint + Prettier for JavaScript/TypeScript
- ✅ Go fmt for Go code
- ✅ Comprehensive test coverage
- ✅ Pre-commit hooks
- ✅ CI/CD validation on all PRs

## Next Steps

Ready to contribute or develop?

→ **[Getting Started](/docs/developer/developer-getting-started)**

Or dive into a specific area:

→ **[Architecture Deep Dive](/docs/development/architecture)**  
→ **[Set Up Environment](/docs/development/setup)**  
→ **[Contributing Guide](/docs/development/contributing)**

---

:::tip Welcome to ODE!
We're excited to have you contribute to ODE. Whether it's code, documentation, bug reports, or ideas—all contributions are valued!
:::
