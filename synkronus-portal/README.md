# Synkronus Portal

Frontend service for Synkronus, built with React + TypeScript + Vite.

## Overview

The Synkronus Portal provides a web-based interface for managing app bundles, users, observations, and data exports. It supports both development (hot reload) and production (optimized build) modes.

## Quick Reference

| Mode | Command | URL | Hot Reload |
|------|---------|-----|------------|
| **Production** | `docker compose up -d --build` | http://localhost:5173 | ❌ No |
| **Development** | `docker compose up -d postgres synkronus`<br>`npm run dev` | http://localhost:5174 | ✅ Yes |

**Default Login Credentials:**
- Username: `admin`
- Password: `admin`

## Quick Start

### Production Mode (Optimized Build)

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

**First Time Setup:** Use `docker compose up -d --build` to ensure the frontend is built before starting. This is the easiest and most reliable way to get started.

---

### Development Mode (Hot Reload)

**Step 1:** Navigate to the portal directory
```bash
cd synkronus-portal
```

**Step 2:** Start backend services (PostgreSQL + API)
```bash
# Start only backend services (postgres + synkronus API)
docker compose up -d postgres synkronus
```

**Step 3:** Wait for backend to be ready (about 10-20 seconds)
```bash
# Check backend health
curl http://localhost:8080/health
# Should return: OK
```

**Step 4:** Install dependencies (if not already done)
```bash
npm install
```

**Step 5:** Start the Vite dev server
```bash
npm run dev
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
# Stop Vite dev server: Press Ctrl+C in the terminal running npm run dev

# Stop backend services
docker compose down
```

**Note:** Stopping containers with `docker compose down` does **NOT** delete your data. Volumes persist automatically. Your database and app bundles remain safe.

**Note:** The development setup uses the **same named volumes** as production, so your app bundles and database persist across dev/prod switches. You can run the backend in Docker while developing the frontend locally.

**Volume Safety:** Named volumes persist even when containers are stopped. Your data is safe unless you explicitly use `docker compose down -v`.

**App Bundle Persistence:** App bundles are stored in the `app-bundles` volume. If bundles disappear after restart, verify:
1. The volume exists: `docker volume ls | grep app-bundles`
2. The volume is mounted: Check `docker compose config`
3. You're not using `docker compose down -v` (which deletes volumes)

## Architecture

### Development Mode

```
┌─────────────────────────────────────────────────────────────┐
│              Development Environment (docker-compose.dev.yml)│
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │  synkronus-portal │      │   synkronus-api   │           │
│  │   (Frontend)      │      │    (Backend)      │           │
│  │                   │      │                   │           │
│  │  • Vite Dev       │◄────►│  • Go Server      │           │
│  │  • Port 5174      │      │  • Port 8080      │           │
│  │  • Hot Reload     │      │  • App Bundles    │           │
│  │  • Source Mounted │      │  • PostgreSQL     │           │
│  └──────────────────┘      └────────┬───────────┘           │
│         │                           │                        │
│         │                           │                        │
│         └───────────────────────────┼───────────────────────┘
│                                     │                        │
│                            ┌────────▼──────────┐             │
│                            │   PostgreSQL      │             │
│                            │   Port 5432       │             │
│                            │   Persistent DB   │             │
│                            └───────────────────┘             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Production Mode

```
┌─────────────────────────────────────────────────────────────┐
│              Production Environment (docker-compose.yml)     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │  synkronus-portal │      │   synkronus-api   │           │
│  │   (Frontend)      │      │    (Backend)      │           │
│  │                   │      │                   │           │
│  │  • Nginx          │◄────►│  • Go Server      │           │
│  │  • Static Files   │      │  • Port 8080      │           │
│  │  • Port 5173      │      │  • App Bundles    │           │
│  │  • Optimized      │      │  • PostgreSQL     │           │
│  └──────────────────┘      └────────┬───────────┘           │
│         │                           │                        │
│         │                           │                        │
│         └───────────────────────────┼───────────────────────┘
│                                     │                        │
│                            ┌────────▼──────────┐             │
│                            │   PostgreSQL      │             │
│                            │   Port 5432       │             │
│                            │   Persistent DB   │             │
│                            └───────────────────┘             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## API Proxy Configuration

### Development Mode

The Vite dev server automatically proxies `/api/*` requests to the backend:

- **Frontend → Backend**: `/api/*` → `http://synkronus:8080/*` (via Vite proxy)
- **Configuration**: See `vite.config.ts`

### Production Mode

Nginx proxies `/api/*` requests to the backend:

- **Frontend → Backend**: `/api/*` → `http://synkronus:8080/*` (via Nginx)
- **Configuration**: See `Dockerfile` nginx config

## Storage Persistence

Both development and production modes use the **same named Docker volumes**, ensuring your data persists across:
- Container restarts
- Mode switches (dev ↔ prod)
- Container removal (with `docker compose down`)
- System reboots

### Volumes

- **postgres-data**: PostgreSQL database files (users, observations, app bundles metadata)
- **app-bundles**: App bundle ZIP files and versions (stored at `/app/data/app-bundles` in the container)

**Important:** App bundles are stored in **both** places:
- **Files**: Actual ZIP files and extracted content in the `app-bundles` volume
- **Database**: Metadata about bundles (versions, manifest info) in the `postgres-data` volume

Both volumes must persist for app bundles to work correctly after restart.

### Volume Persistence Guarantee

**✅ Volumes are NOT deleted when you:**
- Stop containers: `docker compose down`
- Restart containers: `docker compose restart`
- Switch between dev/prod modes
- Rebuild containers: `docker compose build`

**⚠️ Volumes ARE deleted ONLY when you:**
- Explicitly use: `docker compose down -v` (the `-v` flag removes volumes)
- Manually delete: `docker volume rm <volume-name>`

### Checking Your Volumes

```bash
# List all volumes
docker volume ls

# Inspect a specific volume
docker volume inspect synkronus-portal_postgres-data
docker volume inspect synkronus-portal_app-bundles

# Check volume size
docker system df -v
```

### Backup Volumes (Optional)

To backup your data before making changes:

```bash
# Backup postgres data
docker run --rm -v synkronus-portal_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Backup app bundles
docker run --rm -v synkronus-portal_app-bundles:/data -v $(pwd):/backup alpine tar czf /backup/app-bundles-backup.tar.gz -C /data .
```

**Important:** Your data is safe! Volumes persist by default. Only use `docker compose down -v` if you intentionally want to delete all data.

## Stopping Services

### Safe Stop (Preserves Data)

```bash
# Stop all services - VOLUMES ARE PRESERVED ✅
docker compose down
```

This command:
- ✅ Stops all containers
- ✅ Removes containers
- ✅ **Keeps all volumes** (your data is safe!)
- ✅ Removes networks

### Complete Removal (⚠️ DELETES ALL DATA)

```bash
# Stop services AND delete volumes - ⚠️ THIS DELETES ALL DATA!
docker compose down -v
```

**⚠️ WARNING:** The `-v` flag removes volumes, which will:
- Delete all database data (users, observations, etc.)
- Delete all uploaded app bundles
- **This action cannot be undone!**

### Restarting Services

After stopping with `docker compose down`, simply start again:

```bash
# Start services (volumes are automatically reattached)
docker compose up -d
```

Your data will be exactly as you left it!

## Default Credentials

- **Admin username**: `admin`
- **Admin password**: `admin`

**⚠️ Warning**: These are development credentials only. Change them before production use.

## Switching Between Modes

### From Production to Development

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
   npm run dev
   ```

### From Development to Production

1. Stop Vite dev server (Ctrl+C)

2. Stop backend containers:
   ```bash
   docker compose down
   ```

3. Start production mode:
   ```bash
   docker compose up -d --build
   ```

**Important:** Your data (database, app bundles) persists when switching between modes because both use the same Docker volumes.

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

## Local Development (Without Docker)

### Prerequisites

- Node.js 20+
- npm or yarn
- Backend API running (either in Docker or separately)

### Setup

```bash
# Install dependencies
npm install

# Start Vite dev server (runs on port 5174)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

**Note:** When running locally, ensure the backend API is accessible at `http://localhost:8080`. The Vite proxy will automatically route `/api/*` requests to the backend.

## Environment Variables

### Development

- `VITE_API_URL`: Backend API URL (default: uses `/api` proxy)
- `DOCKER_ENV`: Set to `true` when running in Docker

### Production

- `VITE_API_URL`: Backend API URL (default: `http://localhost:8080`)

## Troubleshooting

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

### Hot Reload Not Working (Development Mode)

1. Ensure you're running `npm run dev` (not Docker for frontend)
2. Check that Vite is running on port 5174
3. Verify the browser is connected to the correct port (http://localhost:5174)
4. Check browser console for HMR connection errors
5. Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### API Connection Issues

1. Verify backend is running: `docker compose ps`
2. Check backend logs: `docker compose logs synkronus`
3. Test API directly: `curl http://localhost:8080/health`

### App Bundles Not Persisting

If app bundles disappear after restarting containers:

1. **Verify the volume exists:**
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

**Note:** App bundles are stored in the `app-bundles` volume. This volume persists across restarts. If bundles are missing, check that:
- The volume wasn't accidentally deleted
- The backend has proper permissions to read/write to the volume
- The `APP_BUNDLE_PATH` environment variable is set correctly

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture documentation
- [../synkronus/README.md](../synkronus/README.md) - Backend API documentation
