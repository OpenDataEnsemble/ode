---
sidebar_position: 1
---

# Development Setup

Complete guide to setting up a development environment for ODE.

## Prerequisites

Before setting up the development environment, ensure you have:

- **Node.js** 20.0 or higher
- **pnpm** 10.33.2 (ODE pins this via `packageManager` in each package; enable with [Corepack](https://nodejs.org/api/corepack.html): `corepack enable && corepack prepare pnpm@10.33.2 --activate`)
- **Go** 1.24 or higher (for server and CLI development)
- **PostgreSQL** 13.0 or higher (for server development)
- **Git** for version control
- **Docker** and **Docker Compose** (optional, for containerized development)

## Repository Structure

ODE is a monorepo containing multiple components:

```
ode/
├── formulus/              # React Native mobile app
├── formulus-formplayer/   # React web form renderer
├── synkronus/            # Go backend server
├── synkronus-cli/        # Go command-line utility
├── synkronus-portal/     # React web portal
└── packages/
    ├── tokens/           # Design tokens package
    └── components/       # Shared UI components
```

## Package manager (pnpm)

ODE JavaScript/TypeScript packages use **pnpm** (`pnpm@10.33.2` via Corepack) with a **per-package** `pnpm-lock.yaml` (there is no root workspace install). Run `pnpm install` inside each component directory you work on.

**Recommended install order** when setting up several components:

1. `packages/tokens` — `pnpm install` then `pnpm run build`
2. Consumers — `pnpm install` in `formulus-formplayer`, `formulus`, `packages/components`, `synkronus-portal`, or `desktop` as needed

CI and Docker use `pnpm install --frozen-lockfile` for reproducible installs.

## Clone the Repository

```bash
git clone https://github.com/OpenDataEnsemble/ode.git
cd ode
```

## Formulus Development

### Setup

```bash
cd packages/tokens && pnpm install && pnpm run build && cd ../..
cd formulus
pnpm install
```

Android builds require the Notifee native core (gitignored). `pnpm run android` runs `preandroid` to vendor it automatically; or run `pnpm run vendor:notifee` before `./gradlew` directly.

### Running

```bash
# Start Metro bundler
pnpm start

# Run on Android
pnpm run android

# Run on iOS (macOS only)
pnpm run ios
```

### Code Quality

ODE enforces consistent formatting and linting:

```bash
# Run linting
pnpm run lint

# Run linting with auto-fix
pnpm run lint:fix

# Format code
pnpm run format

# Check formatting (no writes)
pnpm run format:check
```

### Generating Files

```bash
# Generate WebView injection script
pnpm run generate

# Generate API client from OpenAPI spec
pnpm run generate:api
```

## Formplayer Development

### Setup

```bash
cd packages/tokens && pnpm install && pnpm run build && cd ../..
cd formulus-formplayer
pnpm install
```

### Running

```bash
# Development server
pnpm start

# Build and copy assets into Formulus (and ODE Desktop)
pnpm run build:copy
```

### Code Quality

```bash
# Run linting
pnpm run lint

# Run linting with auto-fix
pnpm run lint:fix

# Format code
pnpm run format

# Check formatting (no writes)
pnpm run format:check
```

## ODE Desktop Development

See [ODE Desktop Development](/docs/development/ode-desktop-development) for setup, scripts, and Formplayer integration.

For testing a local custom app build in the Workbench, see [ODE Desktop developer mode](/docs/guides/ode-desktop-developer-mode).

## Synkronus Development

### Setup

```bash
cd synkronus
go mod download
```

### Configuration

Create a `.env` file:

```bash
PORT=8080
DB_CONNECTION=postgres://synkronus:password@localhost:5432/synkronus?sslmode=disable
JWT_SECRET=your-secret-key-for-development
LOG_LEVEL=debug
APP_BUNDLE_PATH=./data/app-bundles
```

### Running

```bash
# Build
go build -o bin/synkronus cmd/synkronus/main.go

# Run
./bin/synkronus

# Or run directly
go run cmd/synkronus/main.go
```

### Database Setup

Ensure PostgreSQL is running and create a database:

```sql
CREATE DATABASE synkronus;
```

The schema will be created automatically on first run.

## Synkronus CLI Development

### Setup

```bash
cd synkronus-cli
go mod download
```

### Building

```bash
# Build
go build -o bin/synk ./cmd/synkronus

# Run
./bin/synk
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Make your code changes following the coding standards.

### 3. Test Locally

```bash
# Run tests (from each package directory)
cd formulus && pnpm run test --ci --coverage --watchAll=false
cd formulus-formplayer && pnpm run test run
go test ./...  # For Go projects (from synkronus/, etc.)

# Check code quality
pnpm run lint
pnpm run format:check
```

### 4. Commit Changes

```bash
git add .
git commit -m "Description of changes"
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Create a pull request on GitHub.

## Code Quality Standards

### Frontend (React/React Native)

- **Linting**: ESLint with project-specific rules
- **Formatting**: Prettier with consistent configuration
- **TypeScript**: Strict type checking enabled
- **Testing**: Jest for unit tests

### Backend (Go)

- **Formatting**: `gofmt` or `goimports`
- **Linting**: `golangci-lint` (if configured)
- **Testing**: Standard Go testing package
- **Documentation**: Godoc comments for exported functions

### CI/CD

The CI pipeline automatically:

- Runs linting and formatting checks
- Runs tests
- Builds components
- Publishes Docker images (for synkronus)

## Development Tools

### Recommended IDE Setup

- **VS Code**: With extensions for TypeScript, Go, and React
- **IntelliJ IDEA**: With Go and JavaScript plugins
- **Android Studio**: For Android development
- **Xcode**: For iOS development (macOS only)

### Useful Commands

```bash
# Check all components
cd formulus && pnpm run lint && cd ..
cd formulus-formplayer && pnpm run lint && cd ..
cd synkronus && go test ./... && cd ..

# Format all code
cd formulus && pnpm run format && cd ..
cd formulus-formplayer && pnpm run format && cd ..
cd synkronus && go fmt ./... && cd ..
```

## Troubleshooting

### Node Modules Issues

```bash
# Clear and reinstall (run inside the package directory, e.g. formulus/)
rm -rf node_modules
pnpm install
```

If dependencies are missing after clone, ensure you ran `pnpm install` in that package directory (and built `packages/tokens` first when using `@ode/tokens` or `@ode/components`).

### Go Module Issues

```bash
# Clean module cache
go clean -modcache
go mod download
```

### Database Connection Issues

- Verify PostgreSQL is running
- Check connection string format
- Ensure database exists
- Verify user permissions

## Related Documentation

- [Architecture Overview](/development/architecture)
- [Contributing Guide](/development/contributing)
- [Building & Testing](/development/building-testing)
