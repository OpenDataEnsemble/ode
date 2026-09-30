---
sidebar_position: 1
---

# Open Data Ensemble

:::tip Pronunciation
ODE is pronounced like "code", without the "C."
:::

Open Data Ensemble (ODE) is a comprehensive platform for mobile data collection and synchronization. Built for researchers, health professionals, implementers, and developers, ODE provides a robust solution for designing forms, managing data securely, and synchronizing seamlessly across devices, even in offline conditions.

:::info ODE v1.1.0

**ODE v1.1.0** is available with **ODE Desktop** — a native app for data stewardship and app bundle development. [Install ODE Desktop](/docs/getting-started/installation/installing-ode-desktop) or continue with [Formulus on Android](/docs/getting-started/installation).

The source code for ODE is publicly available on GitHub. We welcome anyone willing to help with testing, development, or getting involved in the project.

**Get involved:** Reach out to us at [hello@opendataensemble.org](mailto:hello@opendataensemble.org) - we'd love to hear from you!

**Source Code:** Our monorepo on GitHub contains the source code for all components. Visit our repository: [https://github.com/OpenDataEnsemble/ode](https://github.com/OpenDataEnsemble/ode)

:::

## The Problem ODE Solves

Traditional data collection tools often have limitations:

- **No offline support** - Without internet, collection stops
- **Complexity** - Building forms requires technical expertise  
- **Inflexibility** - Customization is difficult and expensive
- **Lock-in** - Data is trapped in proprietary systems
- **Cost** - Enterprise solutions are prohibitively expensive

## How ODE Works

ODE provides an integrated system for the complete data lifecycle:

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Collect    │  ──► │    Sync      │  ──► │   Analyze    │
│   Data       │      │   Offline    │      │   & Export   │
└──────────────┘      └──────────────┘      └──────────────┘
    Formulus         WatermelonDB +         Parquet Export
    (App)           Synkronus (Server)      (Your Tools)
```

## What is ODE?

ODE is a modern toolkit that simplifies mobile data collection through:

- **Simplicity & Efficiency**: Quickly create complex, validated forms using a powerful yet intuitive JSON-based approach
- **Advanced Offline Sync**: Reliable and conflict-resilient synchronization powered by WatermelonDB
- **Flexible & Extensible UI**: Customize form presentation and interaction effortlessly with JSON Forms, enabling rich, interactive user experiences
- **Cross-platform Support**: Applications run on Android, iOS, and web platforms

## Current Members of the Ensemble

Here's an overview of the current members of the ensemble:

<img src="/img/component_overview.png" alt="Component overview" width="100%" />

* [formulus](/reference/formulus): The Android and iOS app for data collection and form interaction.
* [ode-desktop](/reference/ode-desktop): The desktop app for data stewardship and app bundle development (v1.1.0+).
* [synkronus](/reference/synkronus-server): The robust server backend managing synchronization and data storage.
* [synkronus-cli](/reference/synkronus-cli): Command-line interface for convenient server management and administrative tasks.

## Key Components

ODE consists of these main components that work together:

| Component | Description | Technology |
|-----------|-------------|------------|
| **Formulus** | Mobile application for Android and iOS | React Native |
| **ODE Desktop** | Desktop app for data management and app workbench | Tauri (React + Rust) |
| **Formplayer** | Web-based form rendering engine | React |
| **Synkronus** | Backend server for data synchronization | Go |
| **Synkronus CLI** | Command-line utility for administration | Go |
| **Synkronus Portal** | Web admin for users, bundles, and export | React |

## Core Capabilities

### Form Design

Create sophisticated forms using JSON schema definitions. ODE supports various question types including text, numbers, dates, selections, multimedia capture, GPS coordinates, and custom renderers.

### Offline Functionality

Work seamlessly in areas with unreliable connectivity. Data is stored locally and synchronized when network connectivity is available.

### Data Synchronization

Reliable bidirectional synchronization ensures data consistency across devices and servers, with conflict resolution built into the protocol.

### Custom Applications

Build custom applications that integrate with the ODE platform, allowing for specialized workflows and user interfaces.

## Getting Started

New to ODE? Start with our [Getting Started guide](/docs/getting-started/why-ode) to understand the platform and begin your first project.

For developers looking to contribute or extend ODE, see the [Development section](/docs/development/setup) for architecture details and contribution guidelines.

## Documentation Structure

This documentation is organized to help you find information quickly:

- **Getting Started**: Introduction, installation, and basic concepts
- **Using ODE**: Practical guides for creating forms and managing data
- **Guides**: Step-by-step workflows for form design, custom apps, and deployment
- **Reference**: Complete API documentation and configuration options
- **Development**: Architecture details and contribution guidelines
- **Community**: Support resources and examples

## Next Steps

- Read [What is ODE?](/docs/getting-started/what-is-ode) for a detailed overview
- Follow the [Installation guide](/docs/getting-started/installation) to set up your environment
- Create your [first form](/docs/using/your-first-form) to see ODE in action
- Explore the [API Reference](/docs/reference/api) for technical details
