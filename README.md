# Open Data Ensemble (ODE) 🎼

<!-- Build & CI status -->
[![CI](https://github.com/OpenDataEnsemble/ode/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/OpenDataEnsemble/ode/actions/workflows/ci.yml)
[![Synkronus Docker](https://github.com/OpenDataEnsemble/ode/actions/workflows/synkronus-docker.yml/badge.svg?branch=main)](https://github.com/OpenDataEnsemble/ode/actions/workflows/synkronus-docker.yml)
[![Synkronus CLI](https://github.com/OpenDataEnsemble/ode/actions/workflows/synkronus-cli.yml/badge.svg?branch=main)](https://github.com/OpenDataEnsemble/ode/actions/workflows/synkronus-cli.yml)
[![Formulus Android](https://github.com/OpenDataEnsemble/ode/actions/workflows/formulus-android.yml/badge.svg?branch=main)](https://github.com/OpenDataEnsemble/ode/actions/workflows/formulus-android.yml)
[![ODE Desktop](https://github.com/OpenDataEnsemble/ode/actions/workflows/ode-desktop.yml/badge.svg?branch=main)](https://github.com/OpenDataEnsemble/ode/actions/workflows/ode-desktop.yml)
[![E2E attachments](https://github.com/OpenDataEnsemble/ode/actions/workflows/e2e-attachments.yml/badge.svg?branch=main)](https://github.com/OpenDataEnsemble/ode/actions/workflows/e2e-attachments.yml)

<!-- Release & distribution -->
[![Latest release](https://img.shields.io/github/v/release/OpenDataEnsemble/ode?include_prereleases&sort=semver)](https://github.com/OpenDataEnsemble/ode/releases)
[![Synkronus image](https://img.shields.io/badge/ghcr.io-synkronus-blue?logo=docker)](https://github.com/OpenDataEnsemble/ode/pkgs/container/synkronus)
<!-- F-Droid badge: enable once Formulus is published to F-Droid -->
<!-- [![F-Droid](https://img.shields.io/f-droid/v/org.opendataensemble.formulus.svg)](https://f-droid.org/packages/org.opendataensemble.formulus) -->

<!-- Project meta -->
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-contributing)

Welcome to the **Open Data Ensemble** - a comprehensive platform for mobile data collection and synchronization! 

## About ODE

ODE is a monorepo containing all the core components in the ODE universe - the essential members of our *ensemble*, if you will. We're building a modern, open-source solution for field data collection that works seamlessly across mobile devices and web platforms.

## Architecture

This repository houses four main components:

### **formulus**
A React Native project containing the code for Android and iOS apps. This is your mobile data collection companion, designed for field work and offline-first data gathering.

### **formulus-formplayer**
A React web application responsible for rendering JSON forms and communicating with the Formulus mobile app. It provides the dynamic form interface that powers your data collection workflows.

### **synkronus**
The server component written in Go. This handles data synchronization, storage, and provides the backbone for all data operations across the platform.

### **synkronus-cli**
A command-line utility to interact with the Synkronus server. Use it to manage custom app data, handle user administration, export data to Parquet format, and perform various administrative tasks.

You can install the CLI by running this command:

#### Powershell
```powershell
irm https://raw.githubusercontent.com/OpenDataEnsemble/ode/main/scripts/install-synkronus-cli.ps1 | iex
```

#### Mac OS / zsh
```sh
curl -fsSL https://raw.githubusercontent.com/OpenDataEnsemble/ode/main/scripts/install-synkronus-cli.sh | bash
```


**License note:** this component is currently **GPL-2.0-or-later** (see `synkronus-cli/LICENSE`) while the QR PNG stack depends on GPL-classified libraries; we plan to swap in a stdlib-only renderer and return the CLI to **MIT**. See `synkronus-cli/FOLLOWUP-custom-qrcode-writer.md` and `THIRD_PARTY_NOTICES.md`.

### **synkronus-portal**
A web-based version of the the **synkronus-cli**

## We're Young & Fresh! 🌱🌱🌱

ODE is a **young and vibrant open-source project**, and we're incredibly welcoming to contributors of all experience levels and interests! Whether you're passionate about:

- **Software Development** (React Native, React, Go, TypeScript)
- **Documentation** (helping others understand and use ODE)
- **Implementation** (deploying, testing, real-world usage)
- **Community Building** (fostering collaboration and growth)
- **UI/UX Design** (making data collection delightful)
- **Data Science** (improving data workflows and analytics)

...we'd love to have you join our ensemble! 

## 🤝 Contributing

We believe that diverse perspectives and varied skill sets make our project stronger. Don't worry if you're new to open source or if you think your skills might not be "technical enough" - there's a place for everyone here.

**Getting Started:**
- Browse our issues to find something that interests you
- Join our discussions to share ideas
- Improve documentation where you see gaps
- Test the platform and report your experience
- Share how you're using ODE in your work

## CI/CD Pipeline 
This monorepo uses GitHub Actions for CI/CD. For details (trigger conditions, tags, and workflows), see `.github/CICD.md`.

- Synkronus Docker build & publish: `.github/workflows/synkronus-docker.yml`
- Formulus Android build (includes Formplayer asset build): `.github/workflows/formulus-android.yml`
- Synkronus deployment docs: `synkronus/DOCKER.md`, `synkronus/DEPLOYMENT.md`

## Code Quality: Linting & Formatting 

ODE enforces consistent formatting and linting for the frontend projects both **locally** and in **CI**.

### Formulus (React Native)

- **Run linting**: `cd formulus && npm run lint`
- **Run linting with auto-fix**: `cd formulus && npm run lint:fix`
- **Format code**: `cd formulus && npm run format`
- **Check formatting (no writes)**: `cd formulus && npm run format:check`

### Formulus Formplayer (React Web)

- **Run linting**: `cd formulus-formplayer && npm run lint`
- **Run linting with auto-fix**: `cd formulus-formplayer && npm run lint:fix`
- **Format code**: `cd formulus-formplayer && npm run format`
- **Check formatting (no writes)**: `cd formulus-formplayer && npm run format:check`

### What CI Enforces

In the main CI workflow:

- For `formulus`:
  - Runs `npm run format:check` and `npm run lint` after install and before tests.
- For `formulus-formplayer`:
  - Runs `npm run lint`, `npm run format:check`, then tests and build.

CI will **fail** if:

- ESLint finds errors, or
- Prettier formatting checks fail (unformatted files).

## License

The repository root is [MIT](./LICENSE). **synkronus-cli** is **GPL-2.0-or-later** until the QR dependency cleanup above is done. Third-party and mixed-component details: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Get Involved 📬 

Ready to join the ensemble? We're excited to meet you and see what unique perspective you'll bring to ODE!

---

*Building the future of open data collection, one contribution at a time.* ✨