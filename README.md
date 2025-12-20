# Open Data Ensemble (ODE) 🎼

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

This monorepo uses GitHub Actions for continuous integration and deployment:

### Current Pipelines

#### Synkronus Docker Build & Publish
- **Trigger**: Push to `main` branch or pull requests affecting `synkronus/` directory
- **Registry**: GitHub Container Registry (ghcr.io)
- **Image**: `ghcr.io/opendataensemble/synkronus`
- **Tagging Strategy**:
  - `main` branch → `latest` + `v{version}` (release versions)
  - Other branches → `{branch-name}` (pre-release versions)
- **Workflow**: `.github/workflows/synkronus-docker.yml`

### Image Versioning

Images follow semantic versioning:
- **Release**: `ghcr.io/opendataensemble/synkronus:latest` or `ghcr.io/opendataensemble/synkronus:v1.0.0`
- **Pre-release**: `ghcr.io/opendataensemble/synkronus:develop` or `ghcr.io/opendataensemble/synkronus:feature-xyz`

### Using Published Images

Pull and run the latest Synkronus image:

```bash
docker pull ghcr.io/opendataensemble/synkronus:latest
docker run -d -p 8080:8080 \
  -e DB_CONNECTION="postgres://user:pass@host:5432/synkronus" \
  -e JWT_SECRET="your-secret-key" \
  -v synkronus-bundles:/app/data/app-bundles \
  ghcr.io/opendataensemble/synkronus:latest
```

**Documentation:**
- [CI/CD Pipeline Details](.github/CICD.md) - Comprehensive CI/CD documentation
- [Synkronus Docker Guide](synkronus/DOCKER.md) - Quick start guide
- [Synkronus Deployment Guide](synkronus/DEPLOYMENT.md) - Production deployment

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

## Get Involved 📬 

Ready to join the ensemble? We're excited to meet you and see what unique perspective you'll bring to ODE!

---

*Building the future of open data collection, one contribution at a time.* ✨