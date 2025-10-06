# Docker Quick Start Guide

## TL;DR - Deploy on Coolify

1. **Set up PostgreSQL database** in Coolify (note connection details)

2. **Create new Docker service** in Coolify with these settings:

   **Environment Variables:**
   ```env
   DB_CONNECTION=postgres://username:password@postgres-service:5432/synkronus
   JWT_SECRET=<generate-with-openssl-rand-base64-32>
   APP_BUNDLE_PATH=/app/data/app-bundles
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<your-secure-password>
   PORT=8080
   LOG_LEVEL=info
   ```

3. **Add Persistent Volume:**
   - Source: New volume (e.g., `synkronus-bundles`)
   - Destination: `/app/data/app-bundles`

4. **Deploy!**

## Build Locally

```powershell
docker build -t synkronus:latest .
```

## Run Locally (with existing PostgreSQL)

```powershell
docker run -d `
  --name synkronus `
  -p 8080:8080 `
  -e DB_CONNECTION="postgres://user:password@host:5432/synkronus" `
  -e JWT_SECRET="your-secret-key" `
  -e APP_BUNDLE_PATH="/app/data/app-bundles" `
  -v synkronus-bundles:/app/data/app-bundles `
  synkronus:latest
```

## Test with Docker Compose

```powershell
# Copy example and customize
Copy-Item docker-compose.example.yml docker-compose.yml

# Edit docker-compose.yml with your settings

# Start everything (includes PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f synkronus

# Stop
docker-compose down
```

## Essential Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_CONNECTION` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for JWT tokens (min 32 chars) |
| `APP_BUNDLE_PATH` | ⚠️ | Path for app bundles (default: `/app/data/app-bundles`) |

## Volume Mount (IMPORTANT!)

**You MUST mount a volume** to persist app bundles:

```
-v your-volume-name:/app/data/app-bundles
```

Without this, uploaded app bundles will be lost when the container restarts.

## Health Check

Test if the service is running:

```powershell
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

## Complete Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Detailed Coolify deployment instructions
- Troubleshooting guide
- Security best practices
- Backup and restore procedures
- Performance tuning
