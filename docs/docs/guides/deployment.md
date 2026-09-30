---
sidebar_position: 3
---

# Deployment

Complete guide to deploying ODE in production environments using containers (Docker or Podman).

> **IT overview?** See [Server Architecture for IT](./server-architecture-for-it) for a one-page infrastructure summary.  
> **Quick start?** For a fast setup with automated TLS, see the [Synkronus Quickstart](../getting-started/synkronus-quickstart.md) (Podman/Docker + Caddy + PostgreSQL 17).

## Overview

ODE production deployments center on the **Synkronus container image** (`ghcr.io/opendataensemble/synkronus`). The reference stack is [synkronus-quickstart](https://github.com/OpenDataEnsemble/synkronus-quickstart): Synkronus, PostgreSQL, and **Caddy** for TLS. Your IT team may use any hardened reverse proxy (Nginx, Apache, cloud load balancer) instead of Caddy—the requirement is **TLS termination** forwarding to Synkronus on port 8080.

Pin the image tag in production (e.g. `ghcr.io/opendataensemble/synkronus:v1.3.2`), not `:latest`.

## Recommended Production Setup

For production deployment, we recommend:

- **Clean Linux server** (Ubuntu 22.04 LTS or Debian 12)
- **Podman or Docker** with Compose
- **PostgreSQL** (container via quickstart, or managed service with `sslmode=require`)
- **TLS reverse proxy** (Caddy in quickstart; Nginx or institutional proxy equally valid)
- **Persistent volumes** for `pgdata` and Synkronus `appdata`
- **Backups** for database and `appdata` (see quickstart `utilities/`)
- **Security checklist** in [Security reference](/docs/reference/security)

Optional: **Cloudflared tunnel** or similar if you prefer zero-trust ingress without opening inbound ports (not required when using a standard reverse proxy).

## Quick Start

### Server Preparation

<Tabs>
  <TabItem value="linux" label="Linux">

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

  </TabItem>
  <TabItem value="mac" label="macOS">

```bash
# Install Docker Desktop from https://www.docker.com/products/docker-desktop
# Or use Homebrew:
brew install --cask docker

# Docker Compose is included with Docker Desktop
# Verify installation
docker --version
docker compose version
```

  </TabItem>
  <TabItem value="windows" label="Windows">

1. **Install Docker Desktop** from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
2. **Docker Compose is included** with Docker Desktop
3. **Verify installation** (PowerShell):
   ```powershell
   docker --version
   docker compose version
   ```

  </TabItem>
</Tabs>

### Deploy Synkronus

```bash
# Create deployment directory
mkdir -p ~/synkronus
cd ~/synkronus

# Download configuration files
wget https://raw.githubusercontent.com/opendataensemble/ode/main/synkronus/docker-compose.example.yml -O docker-compose.yml
wget https://raw.githubusercontent.com/opendataensemble/ode/main/synkronus/nginx.conf

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
DB_ROOT_PASSWORD=$(openssl rand -base64 24)
ADMIN_PASSWORD=$(openssl rand -base64 16)

# Update docker-compose.yml with secrets
sed -i "s/CHANGE_THIS_PASSWORD/$DB_ROOT_PASSWORD/g" docker-compose.yml
sed -i "s/CHANGE_THIS_TO_RANDOM_32_CHAR_STRING/$JWT_SECRET/g" docker-compose.yml
sed -i "s/CHANGE_THIS_ADMIN_PASSWORD/$ADMIN_PASSWORD/g" docker-compose.yml

# Start the stack
docker compose up -d

# Verify it's running
curl http://localhost/health
```

### Database Setup

Create a database and user for Synkronus:

<Tabs>
  <TabItem value="docker" label="Docker (Recommended)">

```bash
# Open a psql shell into the Postgres container
docker compose exec postgres psql -U postgres
```

From the `psql` prompt:

```sql
-- Create role and database
CREATE ROLE synkronus_user LOGIN PASSWORD 'CHANGE_THIS_APP_PASSWORD';
CREATE DATABASE synkronus OWNER synkronus_user;
```

  </TabItem>
  <TabItem value="local" label="Local PostgreSQL">

```bash
# Connect to local PostgreSQL
psql -U postgres
```

From the `psql` prompt:

```sql
-- Create role and database
CREATE ROLE synkronus_user LOGIN PASSWORD 'CHANGE_THIS_APP_PASSWORD';
CREATE DATABASE synkronus OWNER synkronus_user;
```

  </TabItem>
</Tabs>

Update the `synkronus` service `DB_CONNECTION` in `docker-compose.yml`:

```yaml
services:
  synkronus:
    environment:
      DB_CONNECTION: "postgres://synkronus_user:CHANGE_THIS_APP_PASSWORD@postgres:5432/synkronus?sslmode=disable"
```

## Using Pre-built Images

Pre-built images are automatically published to GitHub Container Registry (GHCR) via CI/CD.

### Choose an Image Tag

Choose a deployment tag based on the update channel you want:

| Tag | What it tracks | Recommended use |
|-----|----------------|-----------------|
| `latest` | Most recently published **stable** GitHub Release | Production deployments that intentionally auto-update between stable releases |
| `latest-pre-release` | Most recently published GitHub Release marked **pre-release** | Demo/staging deployments and Watchtower-managed pre-release testing |
| `dev` | Tip of the `dev` branch | Bleeding-edge integration testing; may contain unpublished work |
| `main` | Tip of the `main` branch | Testing current main between releases |
| `v1.2.3-alpha.4` | One specific pre-release | Reproducible pre-release deployment; does not auto-update |
| `v1.2.3` | One specific stable release | Reproducible production deployment; does not auto-update |
| `sha-abc1234` | One specific commit | Debugging or exact-build reproduction; does not auto-update |

`dev` is a branch-head channel, **not** the published pre-release channel. To track published alpha or release-candidate images, use `latest-pre-release`:

```bash
docker pull ghcr.io/opendataensemble/synkronus:latest-pre-release
```

Versioned and moving release tags are produced only when a GitHub Release is **published**. Merely pushing a Git tag is not enough, and the release must be marked as a pre-release for `latest-pre-release` to move. Publishing a stable release updates `latest` but does not update `latest-pre-release`; there is no single tag that tracks the newest release regardless of whether it is stable or pre-release.

Feature-branch images are not published automatically. A manually dispatched workflow run publishes only an immutable `sha-{short}` tag and does not move `latest`, `latest-pre-release`, `main`, or `dev`.

### Automatic Updates with Watchtower

Watchtower follows the tag configured on the running container. For a demo server that should receive each published pre-release, configure the Synkronus service with the moving pre-release tag:

```yaml
services:
  synkronus:
    image: ghcr.io/opendataensemble/synkronus:latest-pre-release
```

Use `latest` instead to follow stable releases. Do not use a versioned tag such as `v1.2.3-alpha.4` if you expect automatic upgrades; versioned and `sha-*` tags identify fixed builds.

For production, pin a tested version tag and perform controlled upgrades rather than relying on an automatically moving tag.

### Run Pre-built Image

```bash
docker run -d \
  --name synkronus \
  -p 8080:8080 \
  -e DB_CONNECTION="postgres://user:password@host:5432/synkronus" \
  -e JWT_SECRET="your-secret-key" \
  -e APP_BUNDLE_PATH="/app/data/app-bundles" \
  -v synkronus-bundles:/app/data/app-bundles \
  ghcr.io/opendataensemble/synkronus:latest
```

## Cloudflared Tunnel Setup

Cloudflared provides secure external access without exposing ports or managing SSL certificates.

### Install Cloudflared

```bash
# Download and install
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Verify installation
cloudflared --version
```

### Create Tunnel

```bash
# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create synkronus

# Note the tunnel ID from the output
```

### Configure Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <your-tunnel-id>
credentials-file: /root/.cloudflared/<your-tunnel-id>.json

ingress:
  - hostname: synkronus.your-domain.com
    service: http://localhost:80
  - service: http_status:404
```

### Route DNS

```bash
# Route your domain to the tunnel
cloudflared tunnel route dns synkronus synkronus.your-domain.com
```

### Run Tunnel as Service

```bash
# Install as systemd service
sudo cloudflared service install

# Start service
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared
```

Your Synkronus instance is now accessible at `https://synkronus.your-domain.com` with automatic SSL.

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_CONNECTION` | PostgreSQL connection string | `postgres://user:pass@postgres:5432/synkronus` |
| `JWT_SECRET` | Secret key for JWT token signing | Generate with `openssl rand -base64 32` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warn`, `error`) |
| `APP_BUNDLE_PATH` | `/app/data/app-bundles` | Path for app bundle storage |
| `MAX_VERSIONS_KEPT` | `5` | Number of app bundle versions to retain |
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | `admin` | Initial admin password (CHANGE THIS!) |

## Volume Management

### Persistent Volumes

The docker-compose setup creates persistent volumes:

1. **postgres-data**: PostgreSQL database files
2. **app-bundles**: Uploaded application bundles

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect synkronus_postgres-data

# Backup volume
docker run --rm -v synkronus_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore volume
docker run --rm -v synkronus_postgres-data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /
```

### App Bundle Directory Permissions

When bind-mounting a host directory for `app-bundles`, ensure proper permissions. The container runs as user `synkronus` with `uid=1000` and `gid=1000`:

```bash
# Fix permissions on host directory
sudo chown -R 1000:1000 ~/server/app-bundles

# Restart after fixing permissions
docker compose restart synkronus
```

## Monitoring and Maintenance

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f synkronus
docker compose logs -f postgres
docker compose logs -f nginx

# Last 100 lines
docker compose logs --tail=100 synkronus
```

### Health Checks

```bash
# Check service status
docker compose ps

# Test health endpoint
curl http://localhost/health

# Via cloudflared tunnel
curl https://synkronus.your-domain.com/health
```

### Restart Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart synkronus

# Reload nginx configuration
docker compose exec nginx nginx -s reload
```

### Update to Latest Version

```bash
# Pull latest image
docker compose pull

# Recreate containers with new image
docker compose up -d

# Remove old images
docker image prune -f
```

## Backup and Restore

### Database Backup

```bash
# Create backup
docker compose exec postgres pg_dump -U synkronus_user synkronus > backup-$(date +%Y%m%d).sql

# Automated daily backups (add to crontab)
0 2 * * * cd ~/synkronus && docker compose exec -T postgres pg_dump -U synkronus_user synkronus > /backups/synkronus-$(date +\%Y\%m\%d).sql
```

### Database Restore

```bash
# Restore from backup
docker compose exec -T postgres psql -U synkronus_user synkronus < backup-20250114.sql
```

### Full System Backup

```bash
# Backup everything
tar czf synkronus-full-backup-$(date +%Y%m%d).tar.gz \
  docker-compose.yml \
  nginx.conf \
  $(docker volume inspect synkronus_postgres-data --format '{{ .Mountpoint }}') \
  $(docker volume inspect synkronus_app-bundles --format '{{ .Mountpoint }}')
```

## Security Best Practices

### 1. Use Strong Secrets

```bash
# Generate strong JWT secret
openssl rand -base64 32

# Generate strong passwords
openssl rand -base64 24
```

### 2. Change Default Admin Password

After first deployment, change the admin password via API or CLI.

### 3. Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker compose pull
docker compose up -d
```

### 4. Firewall Configuration

If not using Cloudflared, configure firewall:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Performance Tuning

### Reverse proxy timeouts

Field sync, photo upload, and app-bundle download can run for minutes on slow radio. The bundled [`nginx.conf`](https://github.com/OpenDataEnsemble/ode/blob/main/synkronus/nginx.conf) sets `proxy_send_timeout` and `proxy_read_timeout` to **600s**. If you use Caddy, Apache, or an institutional load balancer, set equivalent send/read (or idle) timeouts to at least 10 minutes. Leave login/refresh on the default short path — Synkronus already bounds `/api/auth/*` at 25s.

### PostgreSQL Optimization

Add to `docker-compose.yml` under postgres service:

```yaml
command:
  - "postgres"
  - "-c"
  - "max_connections=100"
  - "-c"
  - "shared_buffers=256MB"
  - "-c"
  - "effective_cache_size=1GB"
```

### Resource Limits

Add to `docker-compose.yml` under each service:

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

## Architecture

The deployment architecture includes:

```
┌─────────────────────────────────────────┐
│         Cloudflared Tunnel              │
│         (Optional - Cloudflare)         │
│         Automatic SSL/TLS               │
└──────────────┬──────────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────┐
│         Nginx Reverse Proxy             │
│         Port 80/443                     │
│         - Load balancing                │
│         - Request routing               │
│         - Compression                   │
└──────────────┬──────────────────────────┘
               │ HTTP
               ▼
┌─────────────────────────────────────────┐
│         Synkronus Container             │
│         Port 8080 (internal)            │
│         - API endpoints                 │
│         - Business logic                │
│         - File storage                  │
└──────────────┬──────────────────────────┘
               │ PostgreSQL protocol
               ▼
┌─────────────────────────────────────────┐
│         PostgreSQL Database             │
│         Port 5432 (internal)            │
│         - Data persistence              │
│         - Transactions                  │
└─────────────────────────────────────────┘
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs synkronus

# Check environment variables
docker compose config

# Verify database connection
docker compose exec synkronus sh
# Inside container:
apk add postgresql-client
psql "$DB_CONNECTION"
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Test connection from synkronus container
docker compose exec synkronus sh -c 'apk add postgresql-client && psql "$DB_CONNECTION"'
```

### Nginx Issues

```bash
# Test nginx configuration
docker compose exec nginx nginx -t

# Reload nginx
docker compose exec nginx nginx -s reload

# Check nginx logs
docker compose logs nginx
```

## Production Checklist

Before going live:

- [ ] Strong JWT secret generated
- [ ] Strong database password set
- [ ] Admin password changed from default
- [ ] Cloudflared tunnel configured (or SSL certificates installed)
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Health checks passing
- [ ] Firewall configured (if not using Cloudflared)
- [ ] Resource limits set
- [ ] Log rotation configured
- [ ] Documentation reviewed
- [ ] Test deployment verified

## Related Documentation

- [Installation Guide](/docs/getting-started/installation)
- [Configuration Guide](/guides/configuration)
- [API Reference](/reference/api)
