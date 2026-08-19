---
sidebar_position: 1
---

# Architecture Overview

ODE (Open Data Ensemble) is a comprehensive platform for mobile data collection and synchronization. This guide explains the core architecture and components.

> **Current ODE release:** [v1.3.0](https://github.com/OpenDataEnsemble/ode/releases/tag/v1.3.0)

## Core Components

ODE consists of these main components that work together to provide a complete data collection solution:

### Synkronus Server
The backend server responsible for:
- **API Services**: RESTful APIs for data management
- **Data Synchronization**: Offline-first sync capabilities  
- **User Authentication**: JWT-based authentication
- **App Bundle Management**: Upload and version management of custom applications
- **Embedded Portal**: Web interface built directly into the Go binary

### Formulus Mobile App
React Native mobile application for:
- **Data Collection**: Field data capture with rich form support
- **Offline Storage**: Local database with WatermelonDB
- **Camera Integration**: Photo and document capture
- **GPS Location**: Geotagging and location services
- **QR Code Scanning**: Workflow automation

### Formulus Formplayer
React web application that:
- **Renders Forms**: Displays JSON Schema forms in web browsers
- **Form Validation**: Client-side validation with JSON Schema
- **Embedded in Mobile**: Used within the React Native app via WebView

### Synkronus CLI
Command-line utility for:
- **App Management**: Upload and manage custom applications
- **Data Export**: Export data to Parquet format
- **User Administration**: Manage users and permissions
- **Server Administration**: Maintenance and monitoring tasks

### ODE Desktop

Desktop application (Tauri + React + Rust) for data stewardship and app development:

- **Data management**: Pull, inspect, edit, import, and sync observations against Synkronus
- **Forms / app workbench**: Download app bundles, preview forms, and test custom apps
- **Developer mode**: Mirror a local custom app build without replacing the Synk-downloaded bundle
- **Same public API**: Uses Synkronus REST API — no privileged desktop channel

Introduced in **ODE v1.1.0**. See [ODE Desktop reference](/docs/reference/ode-desktop) and [install guide](/docs/getting-started/installation/installing-ode-desktop).

### Synkronus Portal

Web-based administrative interface (also embedded in the Synkronus binary at `/portal`):

- **User and bundle management**
- **Observation viewing and export**
- **Same API** as Formulus, CLI, and ODE Desktop

## Architecture Patterns

### Embedded Portal Architecture

The Synkronus Portal is a React application that gets **embedded directly into the Go binary** during the build process:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Portal  │ -> │   Go Build      │ -> │  Single Binary  │
│   (Source)      │    │   (Embed)       │    │  (API + Portal) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

**Build Process:**
1. Portal built with `pnpm run build` (in `synkronus-portal/`)
2. Build output copied to `synkronus/portal/dist/`
3. Go binary embeds portal using `//go:embed`
4. Portal served at `/portal` route

**Benefits:**
- Single deployment artifact
- No separate web server needed
- Version alignment between API and UI
- Simplified operations

### Component Library System

ODE includes a shared component library for consistent UI across applications:

```
packages/
├── tokens/          # Design tokens (colors, typography, spacing)
└── components/      # React components (web and native)
```

**Features:**
- **Cross-platform**: Works in React Native and React Web
- **Design Tokens**: Centralized design system
- **TypeScript**: Full type safety
- **Theme Support**: Light/dark mode capabilities

### Custom Application Architecture

Custom applications are React apps that run inside the Formulus container:

```
Custom App Structure:
├── app.config.json     # App configuration and theme
├── forms/              # Form definitions (JSON Schema + UI Schema)
├── src/
│   ├── components/     # Reusable components
│   ├── screens/        # Main screens
│   └── theme.js         # Theme generation from config
└── scripts/            # Build and validation scripts
```

**Key Features:**
- **Configuration-driven**: `app.config.json` controls app behavior
- **Form Integration**: Seamless integration with Formulus form system
- **Local observation indexes**: Device-only index table for fast queries (never synced to Synkronus)
- **Theme System**: Material Design 3 based theming
- **Build Process**: Optimized bundle creation for deployment

Study-specific apps (for example AnthroCollect) are **app bundles** uploaded to Synkronus—not separate backend services. IT hosts only Synkronus, PostgreSQL, and a TLS reverse proxy.

## Server deployment view

![Installation view: reverse proxy, Synkronus container, PostgreSQL, and volumes](/img/it-architecture-installation.svg)

For IT departments: see [Server Architecture for IT](/docs/guides/server-architecture-for-it) (full diagrams, security model, backups, sizing).

## Data Flow

### Form Submission Flow
```
Mobile App -> Local Storage -> Sync Server -> PostgreSQL -> Portal Display
```

### App Bundle Deployment
```
Development -> Build -> ZIP Upload -> Server Storage -> Mobile Download
```

## Technology Stack

### Backend (Synkronus)
- **Language**: Go 1.24+
- **Database**: PostgreSQL 13+
- **Authentication**: JWT tokens
- **API**: REST with OpenAPI specification

### Frontend Components
- **Mobile**: React Native 0.83+ with React 19.2+
- **Web**: React 19.2+ with TypeScript
- **UI Framework**: Material Design 3 components
- **Build Tools**: Vite for web apps

### Development Tools
- **Package Manager**: pnpm (per-package lockfiles in the ODE monorepo)
- **Code Quality**: ESLint, Prettier, TypeScript
- **Testing**: Jest for unit tests
- **Containerization**: Docker with multi-stage builds

## Deployment Models

### Single Container Deployment
- **Synkronus**: Go server with embedded portal (`ghcr.io/opendataensemble/synkronus`)
- **Database**: PostgreSQL (container or managed service)
- **Reverse proxy**: TLS termination (Caddy in [synkronus-quickstart](https://github.com/OpenDataEnsemble/synkronus-quickstart); or your institutional proxy)
- **Mobile apps**: Formulus on field devices via Obtainium or F-Droid

See [Server Architecture for IT](/docs/guides/server-architecture-for-it) and [Deployment guide](/docs/guides/deployment).

### Development Setup
- **Local Development**: Docker Compose with hot reload
- **Component Development**: Shared library development
- **Form Development**: JSON Schema with validation tools

## Security Considerations

- **Authentication**: JWT-based with configurable expiration
- **Data encryption in transit**: TLS at your reverse proxy (required in production)
- **Data encryption at rest**: Host platform responsibility (see [Security reference](/docs/reference/security))
- **Input Validation**: JSON Schema validation for all forms
- **Access Control**: Role-based permissions for API endpoints

## Performance Optimizations

- **Offline-First**: Local storage with sync capabilities
- **Bundle Optimization**: Minimized custom app bundles
- **Database Indexing**: Optimized queries for large datasets
- **Caching**: Built-in caching for frequently accessed data

This architecture enables scalable, maintainable data collection applications that work seamlessly across mobile and web platforms.
