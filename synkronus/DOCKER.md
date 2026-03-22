# Docker Quick Start Guide

## 🚀 Using Pre-built Images (Recommended)

Pre-built images are automatically published to GitHub Container Registry (GHCR) via CI/CD.

### Pull the Latest Image

```powershell
docker pull ghcr.io/opendataensemble/synkronus:latest
```

### Available Tags

- `latest` - Latest stable release from main branch
- `v1.0.0` - Specific version tags
- `develop` - Development branch (pre-release)
- `feature-xyz` - Feature branches (pre-release)

### Run Pre-built Image

```powershell
docker run -d `
  --name synkronus `
  -p 8080:8080 `
  -e DB_CONNECTION="postgres://user:password@host:5432/synkronus" `
  -e JWT_SECRET="your-secret-key" `
  -v synkronus_data:/app/data `
  ghcr.io/opendataensemble/synkronus:latest
```

## 🚢 Production Deployment with Docker Compose

### Recommended Setup

For production, we recommend:
- **Clean Linux server** (Ubuntu 22.04 LTS or similar)
- **Docker & Docker Compose** installed
- **Cloudflared tunnel** for secure external access (no port forwarding needed)
- **PostgreSQL** (dockerized or local install)
- **Nginx** as reverse proxy (included in docker-compose)

### Quick Deploy

1. **Copy the example configuration:**
   ```bash
   cp docker-compose.example.yml docker-compose.yml
   cp nginx.conf nginx.conf  # Already configured
   ```

2. **Update secrets in docker-compose.yml:**
   - Change `CHANGE_THIS_PASSWORD` for PostgreSQL
   - Generate JWT secret: `openssl rand -base64 32`
   - Set admin password

3. **Start the stack:**
   ```bash
   docker-compose up -d
   ```

4. **Verify it's running:**
   ```bash
   curl http://localhost/health
   ```

### With Cloudflared Tunnel

For secure external access without exposing ports:

1. **Install cloudflared:**
   ```bash
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```

2. **Create tunnel:**
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create synkronus
   cloudflared tunnel route dns synkronus your-domain.com
   ```

3. **Configure tunnel** (create `~/.cloudflared/config.yml`):
   ```yaml
   tunnel: <tunnel-id>
   credentials-file: /root/.cloudflared/<tunnel-id>.json
   
   ingress:
     - hostname: your-domain.com
       service: http://localhost:80
     - service: http_status:404
   ```

4. **Run tunnel:**
   ```bash
   cloudflared tunnel run synkronus
   ```

## 🔧 Build Locally (Development)

Only needed if you're developing Synkronus or need a custom build.

### Build from Source

```powershell
# From the synkronus directory
docker build -t synkronus:local .
```

### Run Local Build

```powershell
docker run -d `
  --name synkronus `
  -p 8080:8080 `
  -e DB_CONNECTION="postgres://user:password@host:5432/synkronus" `
  -e JWT_SECRET="your-secret-key" `
  -v synkronus_data:/app/data `
  synkronus:local
```

### Build Multi-platform Images

For publishing to registries:

```powershell
# Setup buildx (one-time)
docker buildx create --name multiplatform --use

# Build for multiple platforms
docker buildx build `
  --platform linux/amd64,linux/arm64 `
  -t ghcr.io/opendataensemble/synkronus:custom `
  --push `
  .
```

## 🧪 Local Development with Docker Compose

```bash
# Copy example and customize
cp docker-compose.example.yml docker-compose.yml

# Edit docker-compose.yml with your settings

# Start everything (includes PostgreSQL and Nginx)
docker-compose up -d

# View logs
docker-compose logs -f synkronus

# View all logs
docker-compose logs -f

# Stop
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

## Essential Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_CONNECTION` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for JWT tokens (min 32 chars) |

## Volume Mount (IMPORTANT!)

**Mount one volume** at `/app/data` so app bundles, version history, and attachments survive container restarts. The binary is at `/app/synkronus`; mutable data is always `<directory-of-binary>/data`, i.e. `/app/data`.

```
-v your-volume-name:/app/data
```

## Health Check

Test if the service is running:

```bash
# Via nginx (recommended)
curl http://localhost/health

# Direct to Synkronus (if port exposed)
curl http://localhost:8080/health
```

## View Logs

```powershell
docker logs -f synkronus
```

## Generate Secure JWT Secret

```powershell
# Using OpenSSL (Git Bash on Windows)
openssl rand -base64 32

# Or use PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## Architecture Overview

The docker-compose setup includes:

```
┌─────────────────────────────────────────┐
│         Cloudflared Tunnel              │
│         (Optional - for external        │
│          access via Cloudflare)         │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Nginx Reverse Proxy             │
│         (Port 80/443)                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Synkronus Container             │
│         (Port 8080 - internal)          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         PostgreSQL Database             │
│         (Port 5432 - internal)          │
└─────────────────────────────────────────┘
```

## Complete Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Detailed production deployment guide
- Troubleshooting guide
- Security best practices
- Backup and restore procedures
- Performance tuning
