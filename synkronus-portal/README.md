# Synkronus Portal

Frontend service for Synkronus, built with React + TypeScript + Vite.

## Overview

The Synkronus Portal provides a web-based interface for managing app bundles, users, observations, and data exports. It supports both development (hot reload) and production (optimized build) modes.

## Prerequisites

Before starting, ensure you have:

### For Docker-based Setup (Recommended)

- **Docker** (version 20.10+) and **Docker Compose** (version 2.0+)
- Check: `docker --version` and `docker compose version`
- **Git** (for cloning the repository)
- **4GB+ free disk space** (for Docker images and volumes)

**Note for Windows users:** Ensure WSL2 is enabled if using Docker Desktop.

### For Dockerless Development Setup

- **Node.js** 20+ and **pnpm**
- **Go** 1.22+ (for running the backend API)
- **PostgreSQL** 17+ (installed locally or accessible)
- **Git** (for cloning the repository)

---

## Quick Reference

| Mode                         | Command                                                    | URL                   | Hot Reload | Docker Required |
| ---------------------------- | ---------------------------------------------------------- | --------------------- | ---------- | --------------- |
| **Production**               | `docker compose up -d --build`                             | http://localhost:5173 | ❌ No      | ✅ Yes          |
| **Development (Docker)**     | `docker compose up -d postgres synkronus`<br>`pnpm run dev` | http://localhost:5174 | ✅ Yes     | ✅ Partial      |
| **Development (Dockerless)** | See [Dockerless Setup](#dockerless-development-setup)      | http://localhost:5174 | ✅ Yes     | ❌ No           |

**Default Login Credentials:**

- Username: `admin`
- Password: `admin`

---

## Quick Start (First Time)

**For users who just want to get it running:**

### Option 1: Production Mode (Docker - Easiest)

1. **Navigate to directory:**

   ```bash
   cd synkronus-portal
   ```

2. **Start everything:**

   ```bash
   docker compose up -d --build
   ```

3. **Wait ~30 seconds** for services to start

4. **Open in browser:**
   - Portal: http://localhost:5173

5. **Login with:** `admin` / `admin`

That's it! 🎉

### Option 2: Development Mode (Dockerless - No Docker Required)

See the [Dockerless Development Setup](#dockerless-development-setup) section below for complete instructions.

---

## Production Mode (Optimized Build)

**Step 1:** Navigate to the portal directory

```bash
cd synkronus-portal
```

**Step 2:** Build and start all services in production mode

```bash
# Option 1: Build and start in one command (recommended)
docker compose up -d --build
# Option 2: Build first, then start (if you prefer separate steps)
docker compose build
docker compose up -d
```

**Note:** The `--build` flag ensures the frontend is built before starting. If you skip building, Docker will build automatically, but it's better to be explicit.

**Step 3:** Wait for services to start (about 10-30 seconds)

```bash
# Check service status
docker compose ps
# View logs if needed
docker compose logs -f
```

**Step 4:** Access the portal

- **Frontend Portal**: http://localhost:5173 (Nginx serving optimized production build)
- **Backend API**: http://localhost:8080
- **PostgreSQL**: localhost:5432
- **Swagger UI**: http://localhost:8080/openapi/swagger-ui.html

**Production Mode Features:**

- ✅ Optimized production build (minified, tree-shaken)
- ✅ Static file serving via Nginx (fast, efficient)
- ✅ Persistent data storage (survives container restarts)
- ✅ Production-ready performance
- ❌ No hot reload (requires rebuild for changes)

**To stop production mode:**

```bash
docker compose down
```

**Note:** Stopping containers with `docker compose down` does **NOT** delete your data. Volumes persist automatically. Your database and app bundles remain safe.

---

## Development Mode (Hot Reload)

### Development with Docker (Partial Docker)

**Step 1:** Navigate to the portal directory

```bash
cd synkronus-portal
```

**Step 2:** Start backend services (PostgreSQL + API)

```bash
# Start only backend services (postgres + synkronus API)
docker compose up -d postgres synkronus
# This starts the database and backend API, but not the frontend
# The frontend will be started separately with hot reload
```

**Step 3:** Wait for backend to be ready (about 10-20 seconds)

```bash
# Check backend health
curl http://localhost:8080/health
# Should return JSON like: {"status":"ok",...}
```

**Step 4:** Install dependencies (if not already done)

```bash
pnpm install
```

**Step 5:** Start the Vite dev server

```bash
pnpm run dev
```

**Step 6:** Access the portal

- **Frontend Portal**: http://localhost:5174 (Vite dev server with hot reload)
- **Backend API**: http://localhost:8080 (already running from Step 2)

**Development Mode Features:**

- ✅ Hot Module Replacement (HMR) - instant code updates without page refresh
- ✅ Fast refresh - React components update instantly
- ✅ Source maps for debugging
- ✅ Same persistent storage as production - data is shared
- ✅ Full debugging support in browser DevTools
- ✅ Real-time error overlay in browser

**To stop development mode:**

```bash
# Stop Vite dev server: Press Ctrl+C in the terminal running
pnpm run dev
# Stop backend services
docker compose down
```

**Note:** Stopping containers with `docker compose down` does **NOT** delete your data. Volumes persist automatically. Your database and app bundles remain safe.

---

## Dockerless Development Setup

**Perfect for developers who prefer not to use Docker or want a fully local development environment.**

### Prerequisites

- **Node.js** 20+ and **pnpm**
- **Go** 1.22+ ([Install Go](https://go.dev/doc/install))
- **PostgreSQL** 17+ ([Install PostgreSQL](https://www.postgresql.org/download/))
- **Git**

### Step 1: Set Up PostgreSQL Database

**Create the database and user:**

```bash
# Connect to PostgreSQL (as superuser)
psql -U postgres
# In PostgreSQL prompt, run:
CREATE DATABASE synkronus;
CREATE USER synkronus_user WITH PASSWORD 'dev_password_change_in_production';
GRANT ALL PRIVILEGES ON DATABASE synkronus TO synkronus_user;
# Connect to synkronus database
\c synkronus
# Grant schema privileges
GRANT ALL ON SCHEMA public TO synkronus_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO synkronus_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO synkronus_user;
# Exit
\q
```

**Windows PowerShell alternative:**

```powershell
# Using psql command line
$env:PGPASSWORD='postgres'; psql -U postgres -c "CREATE DATABASE synkronus;"
$env:PGPASSWORD='postgres'; psql -U postgres -c "CREATE USER synkronus_user WITH PASSWORD 'dev_password_change_in_production';"
$env:PGPASSWORD='postgres'; psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE synkronus TO synkronus_user;"
```

### Step 2: Set Up Backend API (Synkronus)

**Navigate to synkronus directory:**

```bash
cd ../synkronus
```

**Install dependencies:**

```bash
go mod download
```

**Create environment file (`.env` in synkronus directory):**

```bash
# Create .env file
cat > .env << EOF
PORT=8080
LOG_LEVEL=debug
DB_CONNECTION=postgres://synkronus_user:dev_password_change_in_production@localhost:5432/synkronus?sslmode=disable
JWT_SECRET=dev_jwt_secret_change_in_production_32chars
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
APP_BUNDLE_PATH=./data/app-bundles
MAX_VERSIONS_KEPT=5
EOF
```

**Windows PowerShell alternative:**

```powershell
@"PORT=8080
LOG_LEVEL=debug
DB_CONNECTION=postgres://synkronus_user:dev_password_change_in_production@localhost:5432/synkronus?sslmode=disable
JWT_SECRET=dev_jwt_secret_change_in_production_32chars
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
APP_BUNDLE_PATH=./data/app-bundles
MAX_VERSIONS_KEPT=5"@ | Out-File -FilePath .env -Encoding utf8
```

**Create app bundles directory:**

```bash
mkdir -p data/app-bundles
```

**Run the backend API:**

```bash
# Option 1: Run directly (recommended for development)
go run cmd/synkronus/main.go
# Option 2: Build and run
go build -o bin/synkronus cmd/synkronus/main.go
./bin/synkronus
```

**Verify backend is running:**

```bash
# In another terminal
curl http://localhost:8080/health
# Should return JSON like: {"status":"ok",...}
```

### Step 3: Set Up Frontend Portal

**Navigate to portal directory:**

```bash
cd ../synkronus-portal
```

**Install dependencies:**

```bash
pnpm install
```

**Start the Vite dev server:**

```bash
pnpm run dev
```

**Access the portal:**

- **Frontend Portal**: http://localhost:5174
- **Backend API**: http://localhost:8080
- **Login**: `admin` / `admin`

### Step 4: Verify Everything Works

1. **Check backend health:**

   ```bash
   curl http://localhost:8080/health
   # Should return JSON like: {"status":"ok",...}
   ```

2. **Open frontend in browser:**
   - Navigate to http://localhost:5174
   - You should see the login page

3. **Test login:**
   - Username: `admin`
   - Password: `admin`
   - Should successfully log in and show the dashboard

### Stopping Dockerless Development

1. **Stop frontend:** Press `Ctrl+C` in the terminal running `pnpm run dev`
2. **Stop backend:** Press `Ctrl+C` in the terminal running the Go server

### Troubleshooting Dockerless Setup

**Backend won't start:**

- Verify PostgreSQL is running: `psql -U postgres -c "SELECT version();"`
- Check database connection string in `.env` file
- Ensure database and user were created correctly

**Frontend can't connect to backend:**

- Verify backend is running on port 8080: `curl http://localhost:8080/health`
- Check `vite.config.ts` proxy configuration
- Ensure no firewall is blocking localhost connections

**Database connection errors:**

- Verify PostgreSQL is running
- Check connection string format: `postgres://user:password@host:port/database`
- Ensure user has proper permissions

---

## Verification Checklist

After setting up (any mode), verify everything is working:

1. **Check service status (Docker mode):**

```bash
docker compose ps
```

All services should show "Up" status. Health checks may show "starting" for the first 30-60 seconds - this is normal.

2. **Test API health:**

```bash
curl http://localhost:8080/health
```

Should return JSON like: `{\"status\":\"ok\",...}`

3. **Test frontend:**

- Open http://localhost:5173 (production) or http://localhost:5174 (development) in your browser
- Should show the login page

4. **Test login:**

- Username: `admin`
- Password: `admin`
- Should successfully authenticate and show dashboard

5. **Check logs (if issues):**

```bash
# Docker mode
docker compose logs -f
# Dockerless mode - check terminal output
```

---

## Common Issues

### "cannot execute: required file not found" (init-db.sh)

**Symptom:** PostgreSQL container fails to initialize database user.

**Cause:** Windows line endings (CRLF) in shell scripts.

**Solution:**

```powershell
# Convert line endings (PowerShell)
$content = Get-Content init-db.sh -Raw
$content = $content -replace "`r`n", "`n"
[System.IO.File]::WriteAllText((Resolve-Path init-db.sh), $content, [System.Text.UTF8Encoding]::new($false))
# Then restart
docker compose down -v
docker compose up -d --build
```

**Prevention:** The `.gitattributes` file enforces LF line endings. If you're on Windows, ensure Git is configured correctly:

```bash
git config core.autocrlf false
```

### Port Already in Use

**Production Mode (Port 5173):**

```bash
# Edit docker-compose.yml and change the port mapping:
ports:
   - "5173:80"  # Change 5173 to your desired port
```

**Development Mode (Port 5174):**

```bash
# Edit vite.config.ts and change the port:
server: {
   port: 5174,  # Change to your desired port
}
```

**Backend API (Port 8080):**

```bash
# Docker mode: Edit docker-compose.yml
ports:
  - "8080:8080"  # Change 8080 to your desired port
# Dockerless mode: Edit .env file in synkronus directory
PORT=8080  # Change to your desired port
```

### Health Checks Show "Unhealthy" or "Starting"

**This is normal!** Health checks can take 30-60 seconds to pass on first startup. As long as:

- Services show "Up" status
- `curl http://localhost:8080/health` returns JSON with `"status":"ok"`
- Frontend loads in browser

Then everything is working correctly. The health check status will update to "healthy" after a few cycles.

### Hot Reload Not Working (Development Mode)

1. Ensure you're running `pnpm run dev` (not Docker for frontend)
2. Check that Vite is running on port 5174
3. Verify the browser is connected to the correct port (http://localhost:5174)
4. Check browser console for HMR connection errors
5. Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
6. **Windows users:** Ensure file watching is enabled. If using WSL2, files should be in the WSL filesystem, not Windows filesystem.
7. Check `vite.config.ts` for correct HMR configuration (should be set up by default)

### API Connection Issues

1. **Docker mode:**
   - Verify backend is running: `docker compose ps`
   - Check backend logs: `docker compose logs synkronus`
   - Test API directly: `curl http://localhost:8080/health`

2. **Dockerless mode:**
   - Verify backend process is running (check terminal)
   - Check backend logs in terminal output
   - Test API directly: `curl http://localhost:8080/health`
   - Verify PostgreSQL is running and accessible

### App Bundles Not Persisting

If app bundles disappear after restarting containers:

1. **Verify the volume exists (Docker mode):**

```bash
docker volume ls | grep app-bundles
```

2. **Check if bundles are in the volume:**

```bash
# If containers are running
docker compose exec synkronus ls -la /app/data/app-bundles
# If containers are stopped
docker run --rm -v synkronus-portal_app-bundles:/data alpine ls -la /data
```

3. **Verify volume is mounted correctly:**

```bash
docker compose config | grep -A 5 app-bundles
```

4. **Check backend logs for app bundle initialization:**

```bash
docker compose logs synkronus | grep -i "app bundle\|bundle path"
```

5. **Ensure you're not using `docker compose down -v`:**

- Use `docker compose down` (preserves volumes) ✅
- Avoid `docker compose down -v` (deletes volumes) ❌

**Note:** App bundles are stored in the `app-bundles` volume (Docker) or `./data/app-bundles` directory (Dockerless).

This persists across restarts. If bundles are missing, check that:

- The volume/directory wasn't accidentally deleted
- The backend has proper permissions to read/write
- The `APP_BUNDLE_PATH` environment variable is set correctly

### Windows-Specific Issues

**Line Endings:**

- Git should handle this automatically with `.gitattributes`
- If issues persist: `git config core.autocrlf false`

**File Watching (Dockerless):**

- If hot reload doesn't work, files may need to be in WSL filesystem
- Or use polling mode in `vite.config.ts` (already configured)

**PowerShell vs Bash:**

- Most commands work in both
- Use backticks for line continuation in PowerShell: `` ` ``

---

## Architecture

### Development Mode (Docker)

```
┌─────────────────────────────────────────────────────────────┐
│              Development Environment (docker-compose.yml)   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────┐      ┌───────────────────┐           │
│  │  synkronus-portal │      │   synkronus-api   │           │
│  │   (Frontend)      │      │    (Backend)      │           │
│  │                   │      │                   │           │
│  │  • Vite Dev       │◄────►│  • Go Server      │           │
│  │  • Port 5174      │      │  • Port 8080      │           │
│  │  • Hot Reload     │      │  • App Bundles    │           │
│  │  • Source Mounted │      │  • PostgreSQL     │           │
│  └───────────────────┘      └───────┬───────────┘           │
│         │                           │                       │
│         │                           │                       │
│         └───────────────────────────┼───────────────────────┘
│                                     │                       │
│                            ┌────────▼──────────┐            │
│                            │   PostgreSQL      │            │
│                            │   Port 5432       │            │
│                            │   Persistent DB   │            │
│                            └───────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Development Mode (Dockerless)

```
┌─────────────────────────────────────────────────────────────┐
│              Dockerless Development Environment             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────┐      ┌───────────────────┐           │
│  │  Vite Dev Server  │      │   Go API Server   │           │
│  │   (Frontend)      │      │    (Backend)      │           │
│  │                   │      │                   │           │
│  │  • pnpm run dev    │◄────►│  • go run         │           │
│  │  • Port 5174      │      │  • Port 8080      │           │
│  │  • Hot Reload     │      │  • App Bundles    │           │
│  │  • Local Files    │      │  • Local Files    │           │
│  └───────────────────┘      └───────┬───────────┘           │
│         │                           │                       │
│         │                           │                       │
│         └───────────────────────────┼───────────────────────┘
│                                     │                       │
│                            ┌────────▼──────────┐            │
│                            │   PostgreSQL      │            │
│                            │   (Local Install) │            │
│                            │   Port 5432       │            │
│                            └───────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Production Mode

```
┌─────────────────────────────────────────────────────────────┐
│              Production Environment (docker-compose.yml)    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────┐      ┌───────────────────┐           │
│  │  synkronus-portal │      │   synkronus-api   │           │
│  │   (Frontend)      │      │    (Backend)      │           │
│  │                   │      │                   │           │
│  │  • Nginx          │◄────►│  • Go Server      │           │
│  │  • Static Files   │      │  • Port 8080      │           │
│  │  • Port 5173      │      │  • App Bundles    │           │
│  │  • Optimized      │      │  • PostgreSQL     │           │
│  └───────────────────┘      └───────┬───────────┘           │
│         │                           │                       │
│         │                           │                       │
│         └───────────────────────────┼───────────────────────┘
│                                     │                       │
│                            ┌────────▼──────────┐            │
│                            │   PostgreSQL      │            │
│                            │   Port 5432       │            │
│                            │   Persistent DB   │            │
│                            └───────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## API Proxy Configuration

### Development Mode

The Vite dev server automatically proxies `/api/*` requests to the backend:

- **Frontend → Backend**: `/api/*` → `http://localhost:8080/*` (via Vite proxy)
- **Configuration**: See `vite.config.ts`

### Production Mode

Nginx proxies `/api/*` requests to the backend:

- **Frontend → Backend**: `/api/*` → `http://synkronus:8080/*` (via Nginx)
- **Configuration**: See `Dockerfile` nginx config

---

## Storage Persistence

### Docker Mode

Both development and production modes use the **same named Docker volumes**, ensuring your data persists across:

- Container restarts
- Mode switches (dev ↔ prod)
- Container removal (with `docker compose down`)
- System reboots

**Volumes:**

- **postgres-data**: PostgreSQL database files (users, observations, app bundles metadata)
- **app-bundles**: App bundle ZIP files and versions (stored at `/app/data/app-bundles` in the container)

**Important:** App bundles are stored in **both** places:

- **Files**: Actual ZIP files and extracted content in the `app-bundles` volume
- **Database**: Metadata about bundles (versions, manifest info) in the `postgres-data` volume

Both volumes must persist for app bundles to work correctly after restart.

**Volume Persistence Guarantee:**
✅ **Volumes are NOT deleted when you:**

- Stop containers: `docker compose down`
- Restart containers: `docker compose restart`
- Switch between dev/prod modes
- Rebuild containers: `docker compose build`

⚠️ **Volumes ARE deleted ONLY when you:**

- Explicitly use: `docker compose down -v` (the `-v` flag removes volumes)
- Manually delete: `docker volume rm <volume-name>`

### Dockerless Mode

Data is stored in local directories:

- **PostgreSQL**: Uses your local PostgreSQL data directory (configured during PostgreSQL installation)
- **App Bundles**: Stored in `../synkronus/data/app-bundles` directory

**Backup Recommendations:**

- Regularly backup your PostgreSQL database
- Backup the `data/app-bundles` directory

---

## Stopping Services

### Docker Mode

**Safe Stop (Preserves Data):**

```bash
# Stop all services - VOLUMES ARE PRESERVED ✅
docker compose down
```

This command:

- ✅ Stops all containers
- ✅ Removes containers
- ✅ **Keeps all volumes** (your data is safe!)
- ✅ Removes networks

**Complete Removal (⚠️ DELETES ALL DATA):**

```bash
# Stop services AND delete volumes - ⚠️ THIS DELETES ALL DATA!
docker compose down -v
```

**⚠️ WARNING:** The `-v` flag removes volumes, which will:

- Delete all database data (users, observations, etc.)
- Delete all uploaded app bundles
- **This action cannot be undone!**

**Restarting Services:**

```bash
# Start services (volumes are automatically reattached)
docker compose up -d
```

Your data will be exactly as you left it!

### Dockerless Mode

**Stop Frontend:**

- Press `Ctrl+C` in the terminal running `pnpm run dev`

**Stop Backend:**

- Press `Ctrl+C` in the terminal running the Go server

**Stop PostgreSQL:**

- Use your system's service manager (e.g., `systemctl stop postgresql` on Linux)

---

## Default Credentials

- **Admin username**: `admin`
- **Admin password**: `admin`

**⚠️ Warning**: These are development credentials only. Change them before production use.

---

## Switching Between Modes

### From Production to Development (Docker)

1. Stop production containers:

   ```bash
   docker compose down
   ```

2. Start backend services:

   ```bash
   docker compose up -d postgres synkronus
   ```

3. Start dev server:

   ```bash
   pnpm run dev
   ```

### From Development to Production (Docker)

1. Stop Vite dev server (`Ctrl+C`).

2. Stop backend containers:

   ```bash
   docker compose down
   ```

3. Start production mode:

   ```bash
   docker compose up -d --build
   ```

**Important:** Your data (database, app bundles) persists when switching between modes because both use the same Docker volumes.

### From Docker to Dockerless (or vice versa)

**Note:** Data is not automatically shared between Docker and Dockerless modes. You'll need to:

- Export data from one mode
- Import into the other mode
- Or use the same PostgreSQL instance for both

---

## Building for Production

### First Time Setup

For the first time, or after code changes:

```bash
# Build and start (recommended - does both in one command)
docker compose up -d --build
# Or build first, then start (if you prefer separate steps)
docker compose build
docker compose up -d
```

### Rebuilding After Code Changes

If you've made changes to the frontend code:

```bash
# Rebuild just the portal image
docker compose build synkronus-portal
# Restart the portal service
docker compose up -d synkronus-portal
```

**Note:** The `--build` flag in `docker compose up -d --build` will:

- Build images if they don't exist
- Rebuild images if the Dockerfile or source code changed
- Start all services after building
  This is the easiest way to ensure everything is up-to-date!

---

## Environment Variables

### Development

- `VITE_API_URL`: Backend API URL (default: uses `/api` proxy)
- `DOCKER_ENV`: Set to `true` when running in Docker

### Production

- `VITE_API_URL`: Backend API URL (default: `http://localhost:8080`)

### Backend (Dockerless)

See `../synkronus/README.md` for complete backend environment variable documentation.

---

## See Also

- [SETUP_ANALYSIS.md](./SETUP_ANALYSIS.md) - Detailed setup analysis and recommendations
- [../synkronus/README.md](../synkronus/README.md) - Backend API documentation
- [../synkronus/DEPLOYMENT.md](../synkronus/DEPLOYMENT.md) - Production deployment guide
