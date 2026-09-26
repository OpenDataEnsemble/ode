---
sidebar_position: 1
title: Getting Started with ODE Development
---

# Getting Started: ODE Development

Welcome to the ODE development guide! This page will help you get started contributing to or extending ODE.

## Choose Your Path

### Path 1: Contributing to ODE Core

You want to help improve ODE itself (Formulus, Synkronus, Formplayer, or CLI).

**Requirements:**
- Comfortable with Git and GitHub
- Familiar with your tech stack (React Native, Go, React, TypeScript)
- Willing to follow project standards

**Time to first contribution:** 2-4 hours

**Next Steps:**
1. [Set up your environment](/docs/development/setup)
2. [Read architecture overview](/docs/development/architecture)
3. [Choose a component](/docs/development)
4. [Follow contributing guide](/docs/development/contributing)

### Path 2: Building Custom Applications

You want to build custom data collection apps using ODE APIs.

**Requirements:**
- Knowledge of REST APIs
- Understanding of authentication (JWT)
- Ability to build web/mobile applications

**Time to first app:** 4-8 hours

**Next Steps:**
1. [Understand ODE architecture](/docs/development/architecture)
2. [Learn the REST API](/docs/reference/rest-api/overview)
3. [Review API examples](/docs/reference/rest-api/authentication)
4. [Read extending guide](/docs/development/extending)

### Path 3: System Administration & Deployment

You want to deploy and manage ODE in your infrastructure.

**Requirements:**
- Linux/Docker experience
- Understanding of databases (PostgreSQL)
- Basic networking knowledge
- Experience with deployment platforms (cloud or on-premise)

**Time to first deployment:** 1-2 hours

**Next Steps:**
1. [Server Architecture for IT](/docs/guides/server-architecture-for-it)
2. [Understand system architecture](/docs/development/architecture)
3. [Learn server configuration](/docs/reference/configuration/server)
4. [Follow deployment guide](/docs/guides/deployment)
5. [Security reference](/docs/reference/security)

### Path 4: Integration & APIs

You want to integrate ODE with external systems (database, analytics, etc.).

**Requirements:**
- Experience with API integrations
- Understanding of data formats (JSON, Parquet, CSV)
- Knowledge of your target system

**Time to first integration:** 2-4 hours

**Next Steps:**
1. [Learn REST API](/docs/reference/rest-api/overview)
2. [Understand data formats](/docs/reference/app-bundle-format)
3. [Review sync protocol](/docs/reference/rest-api/sync)
4. [Build custom integrations](/docs/development/extending)

## Quick Prerequisites

Before diving in, make sure you have:

### For Core Development

**macOS:**
```bash
# Install Homebrew if not present
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node go postgresql git
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install nodejs npm golang postgresql git
# Enable pnpm for the ODE monorepo (pinned in package.json files):
# corepack enable && corepack prepare pnpm@10.33.2 --activate
```

**Windows:**
- [Node.js LTS](https://nodejs.org/)
- [Go 1.22+](https://golang.org/doc/install)
- [PostgreSQL](https://www.postgresql.org/download/)
- [Git](https://git-scm.com/)

### For All Developers

- Git account & credentials configured
- GitHub account (for issues, PRs, discussions)
- Code editor (VS Code recommended)
- Terminal/command line experience

## 15-Minute Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/OpenDataEnsemble/ode.git
cd ode
```

### 2. Explore the Structure

```bash
# See the main components
ls -la

# You'll see:
# formulus/              - React Native app
# formulus-formplayer/   - React form renderer
# synkronus/             - Go server
# docs/                  - Documentation
```

### 3. Choose a Component to Explore

#### Option A: Explore Backend (Go)

```bash
cd synkronus
cat README.md           # Read the overview
ls -la cmd/synkronus/   # See the entry point
```

#### Option B: Explore Frontend (React/React Native)

```bash
cd formulus
cat README.md                    # Read the overview
cat package.json | grep scripts  # See build commands
```

#### Option C: Explore Form Renderer

```bash
cd formulus-formplayer
cat README.md           # Read the overview
cat package.json        # See scripts
```

### 4. Understand the Architecture

Read the [Architecture Overview](/docs/development/architecture) - it explains:
- How components communicate
- The sync protocol
- Authentication flow
- Data models

### 5. Set Up Development Environment

Follow the detailed [Environment Setup](/docs/development/setup) guide for your component.

## Understanding ODE's Tech Stack

### Frontend Components

| Component | Language | Framework | Purpose |
|-----------|----------|-----------|---------|
| **Formulus** | TypeScript | React Native | Mobile app (Android/iOS) |
| **Formplayer** | TypeScript | React | Form rendering in WebView |

**Frontend Skills Needed:**
- TypeScript/JavaScript
- React or React Native
- State management (Redux/MobX)
- REST API integration

### Backend Components

| Component | Language | Purpose |
|-----------|----------|---------|
| **Synkronus** | Go | Server, API, sync protocol |
| **Synkronus CLI** | Go | Command-line administration |
| **Synkronus Portal** | TypeScript/React | Web-based admin dashboard |

**Backend Skills Needed:**
- Go (for server development)
- REST API design
- Database design (PostgreSQL)
- Authentication/security

### Databases

| System | Purpose | Skill Level |
|--------|---------|------------|
| **PostgreSQL** | Server data storage | Intermediate |
| **WatermelonDB** | Mobile local storage | Beginner |

## Common Development Tasks

### Task 1: Add a New Form Control

**Skills:** React/TypeScript  
**Time:** 2-3 hours  
**Impact:** Enable new data types for form designers

→ [Extending ODE - Form Controls](/docs/development/extending#form-controls)

### Task 2: Fix a Bug in Formulus

**Skills:** React Native, TypeScript  
**Time:** 1-2 hours  
**Impact:** Improve stability for field workers

→ [Formulus Development](/docs/development/formulus-development)

### Task 3: Add a New API Endpoint

**Skills:** Go, REST APIs, PostgreSQL  
**Time:** 2-4 hours  
**Impact:** Enable custom integrations

→ [Synkronus Development](/docs/development/synkronus-development)

### Task 4: Improve Documentation

**Skills:** Technical writing  
**Time:** 1-2 hours  
**Impact:** Help other developers

→ [Contributing - Documentation](/docs/development/contributing#documentation)

### Task 5: Set Up Local Development

**Skills:** Docker, Docker Compose, or manual setup  
**Time:** 30-60 minutes  
**Impact:** Run ODE locally for testing

→ [Setup Environment](/docs/development/setup)

## Development Workflow

### Step 1: Plan Your Work

1. **Check existing issues** - Is this already being worked on?
2. **Open an issue** - Describe what you want to do
3. **Discuss approach** - Get feedback from maintainers
4. **Get approval** - Make sure the direction is right

### Step 2: Set Up Your Environment

1. **Clone the repo**
2. **Install dependencies**
3. **Run tests** to verify setup
4. **Create a feature branch**

### Step 3: Make Your Changes

1. **Write code** following project standards
2. **Run tests** to check your work
3. **Lint your code** (ESLint, Go fmt)
4. **Test manually** if needed

### Step 4: Submit Your Work

1. **Commit with clear messages**
2. **Push to your fork**
3. **Create a pull request** with description
4. **Address feedback** from reviewers
5. **Celebrate when merged**

## Code Quality Standards

ODE maintains high standards:

### JavaScript/TypeScript
```bash
# Run linter
pnpm run lint

# Auto-fix issues
pnpm run lint:fix

# Format code
pnpm run format
```

### Go
```bash
# Format code
go fmt ./...

# Run tests
go test ./...

# Check coverage
go test -cover ./...
```

### Testing
- Write tests for new features
- Maintain test coverage > 80%
- Run full test suite before submitting PR

### Git Commits
- Use meaningful messages
- Reference issues (`Fixes #123`)
- Keep commits focused
- Squash related commits

Example:
```
git commit -m "Add GPS field control for forms (Fixes #456)"
```

## Learning Resources

### ODE Specific
- [Architecture Deep Dive](/docs/development/architecture)
- [Component Documentation](/docs/development)
- [Contributing Guide](/docs/development/contributing)
- [API Reference](/docs/reference/rest-api/overview)

### React Native
- [Official Docs](https://reactnative.dev/)
- [React Native Community](https://github.com/react-native-community)

### Go
- [Official Docs](https://golang.org/doc/)
- [Go by Example](https://gobyexample.com/)

### React
- [Official Docs](https://react.dev/)
- [Learn React](https://react.dev/learn)

### PostgreSQL
- [Official Docs](https://www.postgresql.org/docs/)
- [SQL Tutorial](https://sqlzoo.net/)

## Getting Help

**Stuck on something?**

1. **Check the docs** - Most answers are in [Architecture](/docs/development/architecture) or [Component Guides](/docs/development)
2. **Search existing issues** - Your question might be answered
3. **Ask in discussions** - [GitHub Discussions](https://github.com/OpenDataEnsemble/ode/discussions)
4. **Contact maintainers** - hello@opendataensemble.org

## What to Expect

### First Week
- ✅ Understand project structure
- ✅ Set up development environment
- ✅ Make first small contribution (docs, tiny fix)
- ✅ Get familiar with contribution process

### First Month
- ✅ Make several contributions
- ✅ Understand a component deeply
- ✅ Have code merged to main
- ✅ Help answer other developers' questions

### First Quarter
- ✅ Be recognized as contributor
- ✅ Have meaningful PRs merged
- ✅ Potentially become code reviewer
- ✅ Mentor new contributors

## Next Steps

### Ready to Code?

Choose your path and dive in:

1. **[Core Contributor Path](/docs/development/setup)** - Set up environment
2. **[Custom App Path](/docs/reference/rest-api/overview)** - Learn the APIs
3. **[Deployment Path](/docs/guides/server-architecture-for-it)** - IT overview, then [deployment guide](/docs/guides/deployment)
4. **[Integration Path](/docs/development/extending)** - Build integrations

### Read More

- [Architecture Overview](/docs/development/architecture)
- [Component Development](/docs/reference/components)
- [Contributing Guide](/docs/development/contributing)
- [Community Support](/docs/community/getting-help)

---

:::tip Welcome to ODE Development!
We're excited to have you contribute. Don't hesitate to ask questions—the community is friendly and helpful.

→ **[Set Up Your Environment](/docs/development/setup)**
:::
