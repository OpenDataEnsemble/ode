---
sidebar_position: 5
---

# Synkronus Server Development

Complete guide for developing the Synkronus server component.

## Prerequisites

- **Go** 1.22+
- **PostgreSQL** 12+
- **Git**

## Local Development Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/OpenDataEnsemble/ode.git
cd ode/synkronus
```

### Step 2: Install Dependencies

```bash
go mod download
```

### Step 3: Set Up Database

<Tabs>
  <TabItem value="linux-mac" label="Linux/macOS">

```bash
# Create database
createdb synkronus

# Or using psql
psql -U postgres -c "CREATE DATABASE synkronus;"
```

  </TabItem>
  <TabItem value="windows" label="Windows">

Using PowerShell or Command Prompt:

```powershell
# Using psql
psql -U postgres -c "CREATE DATABASE synkronus;"
```

Or using Git Bash/WSL:

```bash
# Create database
createdb synkronus

# Or using psql
psql -U postgres -c "CREATE DATABASE synkronus;"
```

  </TabItem>
</Tabs>

### Step 4: Configure Environment

Create `.env` file:

```bash
PORT=8080
DB_CONNECTION=postgres://user:password@localhost:5432/synkronus?sslmode=disable
JWT_SECRET=dev-secret-change-in-production
LOG_LEVEL=debug
APP_BUNDLE_PATH=./data/app-bundles
MAX_VERSIONS_KEPT=5
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
```

### Step 5: Create Directories

```bash
mkdir -p data/app-bundles
```

### Step 6: Run Server

```bash
go run cmd/synkronus/main.go
```

Or build and run:

```bash
go build -o bin/synkronus cmd/synkronus/main.go
./bin/synkronus
```

## Development Workflow

### Hot Reload

Use tools like `air` for hot reload:

```bash
go install github.com/cosmtrek/air@latest
air
```

### Testing

```bash
go test ./...
```

### API Documentation

View OpenAPI docs:

```bash
# Server must be running
open http://localhost:8080/openapi/swagger-ui.html
```

## Building for Production

### Build Binary

```bash
go build -o bin/synkronus cmd/synkronus/main.go
```

### Cross-Platform Builds

<Tabs>
  <TabItem value="linux" label="Linux">

```bash
GOOS=linux GOARCH=amd64 go build -o bin/synkronus-linux cmd/synkronus/main.go
```

  </TabItem>
  <TabItem value="windows" label="Windows">

```powershell
$env:GOOS="windows"; $env:GOARCH="amd64"; go build -o bin/synkronus.exe cmd/synkronus/main.go
```

Or using bash (Git Bash/WSL):

```bash
GOOS=windows GOARCH=amd64 go build -o bin/synkronus.exe cmd/synkronus/main.go
```

  </TabItem>
  <TabItem value="mac" label="macOS">

```bash
GOOS=darwin GOARCH=amd64 go build -o bin/synkronus-macos cmd/synkronus/main.go
```

  </TabItem>
</Tabs>

## Docker Development

### Using Docker Compose

```bash
docker compose up -d
```

### Development with Hot Reload

Mount source code for live updates.

## Related Documentation

- [Synkronus Server Reference](/reference/synkronus-server) - Component reference
- [Deployment Guide](/guides/deployment) - Production deployment
- [Configuration Guide](/guides/configuration) - Configuration options

