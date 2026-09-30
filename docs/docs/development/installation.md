---
sidebar_position: 4
---

# Installation

Complete installation guide for all ODE components. This guide covers prerequisites, server setup, and mobile app installation.

## Prerequisites

Before installing ODE components, ensure your system meets the following requirements.

### System Requirements

#### For Mobile Development (Formulus)

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Operating System** | macOS 10.15, Windows 10, or Linux | Latest stable version |
| **Node.js** | 20.0 or higher | Latest stable |
| **pnpm** | 10.33.2 (via Corepack or global install) | Match `packageManager` in ODE `package.json` files |
| **Android Studio** | Latest stable | Latest stable |
| **Xcode** | 14.0 or higher (macOS only) | Latest stable |
| **Java Development Kit** | JDK 17 | JDK 17 or higher |

#### For Server Deployment (Synkronus)

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Operating System** | Linux, macOS, or Windows | Linux |
| **Go** | 1.24 or higher | Latest stable |
| **PostgreSQL** | 13.0 or higher | 15.0 or higher |
| **Docker** | 20.10 or higher (optional) | Latest stable |
| **Memory** | 2 GB RAM | 4 GB RAM or more |
| **Storage** | 10 GB free space | 50 GB or more |

### Development Tools

**Required Tools:**
- Git: Version control system
- Code Editor: Visual Studio Code, IntelliJ IDEA, or similar
- Terminal: Command-line interface for running commands

**Recommended Tools:**
- Postman or curl: For testing API endpoints
- pgAdmin or DBeaver: For database management
- Docker Desktop: For containerized development

### Verification

Verify your installation by running:

<Tabs>
  <TabItem value="linux-mac" label="Linux/macOS">

```bash
# Check Node.js version
node --version

# Check pnpm version
pnpm --version

# Check Go version
go version

# Check PostgreSQL version
psql --version

# Check Docker version (if using)
docker --version
```

  </TabItem>
  <TabItem value="windows" label="Windows">

Using PowerShell:

```powershell
# Check Node.js version
node --version

# Check pnpm version
pnpm --version

# Check Go version
go version

# Check PostgreSQL version
psql --version

# Check Docker version (if using)
docker --version
```

Or using Git Bash/WSL (same commands as Linux/macOS):

```bash
node --version
pnpm --version
go version
psql --version
docker --version
```

  </TabItem>
</Tabs>

## Installing Synkronus Server

Synkronus is the backend server component of ODE, responsible for data synchronization, storage, and API services.

<Tabs>
  <TabItem value="docker" label="Docker (Recommended)">

The easiest way to run Synkronus is using Docker:

```bash
# Pull the latest image
docker pull ghcr.io/opendataensemble/synkronus:latest

# Run the container
docker run -d \
  --name synkronus \
  -p 8080:8080 \
  -e DB_CONNECTION="postgres://user:password@host:5432/synkronus" \
  -e JWT_SECRET="your-secret-key-here" \
  -v synkronus-bundles:/app/data/app-bundles \
  ghcr.io/opendataensemble/synkronus:latest
```

  </TabItem>
  <TabItem value="docker-compose" label="Docker Compose">

For a complete setup with PostgreSQL:

```bash
# Clone the repository
git clone https://github.com/OpenDataEnsemble/ode.git
cd ode

# Start with Docker Compose (includes PostgreSQL)
docker compose up -d
```

  </TabItem>
  <TabItem value="source" label="Build from Source">

Build and run Synkronus from source:

<Tabs>
  <TabItem value="source-linux-mac" label="Linux/macOS">

```bash
# Clone the repository
git clone https://github.com/OpenDataEnsemble/ode.git
cd ode

# Build the Synkronus portal first
cd packages/tokens && pnpm install --frozen-lockfile && pnpm run build && cd ../..
cd packages/components && pnpm install --frozen-lockfile && cd ..
cd synkronus-portal && pnpm install --frozen-lockfile && pnpm run build && cd ..

# Build and run Synkronus
cd synkronus
go build -o synkronus ./cmd/synkronus
./synkronus
```

  </TabItem>
  <TabItem value="source-windows" label="Windows">

Using PowerShell:

```powershell
# Clone the repository
git clone https://github.com/OpenDataEnsemble/ode.git
cd ode

# Build the Synkronus portal first
cd packages/tokens && pnpm install --frozen-lockfile && pnpm run build && cd ../..
cd packages/components && pnpm install --frozen-lockfile && cd ..
cd synkronus-portal && pnpm install --frozen-lockfile && pnpm run build && cd ..

# Build and run Synkronus
cd synkronus
go build -o synkronus.exe ./cmd/synkronus
.\synkronus.exe
```

Or using Git Bash/WSL (same as Linux/macOS):

```bash
git clone https://github.com/OpenDataEnsemble/ode.git
cd ode

# Build the Synkronus portal first
cd packages/tokens && pnpm install --frozen-lockfile && pnpm run build && cd ../..
cd packages/components && pnpm install --frozen-lockfile && cd ..
cd synkronus-portal && pnpm install --frozen-lockfile && pnpm run build && cd ..

# Build and run Synkronus
cd synkronus
go build -o bin/synkronus ./cmd/synkronus
./bin/synkronus
```

  </TabItem>
</Tabs>

  </TabItem>
</Tabs>

### Configuration

Synkronus is configured using environment variables. Create a `.env` file or set environment variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | HTTP server port | `8080` | No |
| `DB_CONNECTION` | PostgreSQL connection string | - | Yes |
| `JWT_SECRET` | Secret key for JWT signing | - | Yes |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` | No |
| `APP_BUNDLE_PATH` | Directory for app bundles | `./data/app-bundles` | No |
| `MAX_VERSIONS_KEPT` | Maximum app bundle versions to keep | `5` | No |

**Example Configuration:**

```bash
PORT=8080
DB_CONNECTION=postgres://synkronus:password@localhost:5432/synkronus?sslmode=disable
JWT_SECRET=your-secret-key-change-this-in-production
LOG_LEVEL=info
APP_BUNDLE_PATH=./data/app-bundles
MAX_VERSIONS_KEPT=5
```

### Database Setup

Before running Synkronus, set up a PostgreSQL database:

<Tabs>
  <TabItem value="local-linux-mac" label="Local PostgreSQL (Linux/macOS)">

```bash
# Connect to PostgreSQL
psql -U postgres
```

Then run SQL commands:

```sql
-- Create database
CREATE DATABASE synkronus;

-- Create user (optional)
CREATE USER synkronus WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE synkronus TO synkronus;
```

  </TabItem>
  <TabItem value="local-windows" label="Local PostgreSQL (Windows)">

Using PowerShell or Command Prompt:

```powershell
# Connect to PostgreSQL
psql -U postgres
```

Then run SQL commands:

```sql
-- Create database
CREATE DATABASE synkronus;

-- Create user (optional)
CREATE USER synkronus WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE synkronus TO synkronus;
```

Or using Git Bash/WSL (same as Linux/macOS):

```bash
psql -U postgres
```

  </TabItem>
  <TabItem value="docker" label="Docker PostgreSQL">

```bash
# Connect to PostgreSQL container
docker compose exec postgres psql -U postgres
```

Then run SQL commands:

```sql
CREATE DATABASE synkronus;
CREATE USER synkronus WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE synkronus TO synkronus;
```

  </TabItem>
</Tabs>

The database schema will be created automatically on first run.

### Verification

Verify the installation:

1. Check that the server is running:
   ```bash
   curl http://localhost:8080/health
   ```

2. Check the API documentation:
   ```bash
   curl http://localhost:8080/api/docs
   ```

## Installing Formulus App

Formulus is the mobile application component of ODE, available for Android and iOS devices.

For detailed installation instructions, see the [Installing Formulus guide](/docs/getting-started/installation/installing-formulus) which covers:

- F-Droid installation (recommended for end users)
- Direct APK installation
- System requirements
- Post-installation setup

For developers who want to install via ADB or emulator, see the [Development Installation guide](/docs/development/installing-formulus-dev).

### Quick Installation Summary

#### For End Users

1. **F-Droid** (Recommended): Install via F-Droid app store
2. **Direct APK**: Download and install APK file directly

See [Installing Formulus](/docs/getting-started/installation/installing-formulus) for complete instructions.

#### For Developers

1. **ADB Installation**: Install via Android Debug Bridge
2. **Emulator**: Run on Android emulator
3. **Development Build**: Build from source with hot reload

See [Installing Formulus for Development](/docs/development/installing-formulus-dev) for complete instructions.

### App Configuration

After installation, configure the app to connect to your Synkronus server:

1. Open the Formulus app
2. Navigate to Settings
3. Enter your server URL (e.g., `https://your-server.com`)
4. Enter your authentication credentials
5. Save the configuration

## Installing Synkronus CLI

The Synkronus CLI is a command-line utility for interacting with the Synkronus server.

### Installation

```bash
go install github.com/OpenDataEnsemble/ode/synkronus-cli/cmd/synkronus@latest
```

Or build from source:

```bash
git clone https://github.com/OpenDataEnsemble/ode/synkronus-cli.git
cd synkronus-cli
go build -o bin/synk ./cmd/synkronus
```

### Configuration

By default, the CLI uses a configuration file located at `$HOME/.synkronus.yaml`.

**Example configuration file:**

```yaml
api:
  url: http://localhost:8080
  version: 1.0.0
```

You can override this per-command with `--config <path>` or use `synk config use <path>` to set a persistent default.

## Troubleshooting

### Server Not Accessible

If the mobile app cannot connect to the server:

- Verify the server is running: `curl http://localhost:8080/health`
- Check firewall settings
- For Android emulator, use `10.0.2.2` instead of `localhost`
- For iOS simulator, use `localhost` or your machine's IP address

### Database Connection Issues

**Problem**: Cannot connect to database

**Solution**: Verify the `DB_CONNECTION` string format and ensure PostgreSQL is running and accessible.

### Port Already in Use

**Problem**: Port 8080 is already in use

**Solution**: Change the `PORT` environment variable to use a different port.

### Build Errors

**Problem**: Build fails with errors

**Solution**: 
- Ensure all prerequisites are installed
- Check that dependencies are up to date
- Review error messages for specific issues
- See component-specific documentation for build instructions

## Next Steps

- Follow the [Quick Start guide](/docs/getting-started/index) for a complete setup
- Learn how to [use the app](/docs/using/your-first-form) for data collection
- Review the [Deployment guide](/docs/guides/deployment) for production setup

