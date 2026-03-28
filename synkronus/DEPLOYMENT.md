# Synkronus Production Deployment Guide

This guide covers deploying Synkronus in production using Docker Compose.

## Recommended Production Setup

For a production deployment, we recommend:

- **Clean Linux server** (Ubuntu 22.04 LTS or Debian 12)
- **Docker & Docker Compose** installed
- **Cloudflared tunnel** for secure external access (no port forwarding needed)
- **PostgreSQL** database (dockerized via docker-compose)
- **Nginx** reverse proxy (included in docker-compose)
- **Persistent volumes** for data storage

## Quick Start

### 1. Server Preparation

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

### 2. Deploy Synkronus

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

# Update docker-compose.yml with secrets (PostgreSQL root and Synkronus secrets)
sed -i "s/CHANGE_THIS_PASSWORD/$DB_ROOT_PASSWORD/g" docker-compose.yml
sed -i "s/CHANGE_THIS_TO_RANDOM_32_CHAR_STRING/$JWT_SECRET/g" docker-compose.yml
sed -i "s/CHANGE_THIS_ADMIN_PASSWORD/$ADMIN_PASSWORD/g" docker-compose.yml

# Start the stack (Postgres, Synkronus, nginx)
docker compose up -d

# Verify it's running via nginx health endpoint
curl http://localhost/health
```

### 3. Create Database and User for Synkronus

In this setup we use **one PostgreSQL container** and create one or more application databases inside it using the root `postgres` user. This is the recommended way to initialize databases for Synkronus.

```bash
# Open a psql shell into the Postgres container (as root user)
docker compose exec postgres psql -U postgres
```

From the `psql` prompt, create a role (user) and a database **owned by that role** for Synkronus:

```sql
-- Replace names/passwords as appropriate
CREATE ROLE synkronus_user LOGIN PASSWORD 'CHANGE_THIS_APP_PASSWORD';
CREATE DATABASE synkronus OWNER synkronus_user;
```

Then update the `synkronus` service `DB_CONNECTION` in `docker-compose.yml` to match:

```yaml
services:
  synkronus:
    environment:
      DB_CONNECTION: "postgres://synkronus_user:CHANGE_THIS_APP_PASSWORD@postgres:5432/synkronus?sslmode=disable"
```

To add **additional Synkronus instances** later, repeat the same pattern:

```sql
CREATE ROLE synkronus_another_user LOGIN PASSWORD 'another_password';
CREATE DATABASE synkronus_another OWNER synkronus_another_user;
```

and point a new Synkronus service at that database with its own `DB_CONNECTION`.

### 3. Set Up Cloudflared Tunnel (Optional but Recommended)

Cloudflared provides secure external access without exposing ports or managing SSL certificates.

#### Install Cloudflared

```bash
# Download and install
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Verify installation
cloudflared --version
```

#### Create Tunnel

```bash
# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create synkronus

# Note the tunnel ID from the output
```

#### Configure Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <your-tunnel-id>
credentials-file: /root/.cloudflared/<your-tunnel-id>.json

ingress:
  - hostname: synkronus.your-domain.com
    service: http://localhost:80
  - service: http_status:404
```

#### Route DNS

```bash
# Route your domain to the tunnel
cloudflared tunnel route dns synkronus synkronus.your-domain.com
```

#### Run Tunnel as Service

```bash
# Install as systemd service
sudo cloudflared service install

# Start service
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared
```

Your Synkronus instance is now accessible at `https://synkronus.your-domain.com` with automatic SSL!

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
| `MAX_VERSIONS_KEPT` | `5` | Number of app bundle versions to retain |
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | `admin` | Initial admin password (CHANGE THIS!) |
| `SYNKRONUS_RECOVERY_CREATE_USER` | *(empty)* | Recovery admin username (must be set with pass) |
| `SYNKRONUS_RECOVERY_CREATE_PASS` | *(empty)* | Recovery admin plaintext password (must be set with user) |

In the official container image, the process runs from **`/app`** (binary at **`/app/synkronus`**), so app bundles are stored at **`/app/data/app-bundle/active`** and **`/app/data/app-bundle/versions`**. Mount your persistent volume at **`/app/data`**.

`ADMIN_USERNAME`/`ADMIN_PASSWORD` are bootstrap credentials and only apply when there are no users yet. For emergency recovery, set `SYNKRONUS_RECOVERY_CREATE_USER` and `SYNKRONUS_RECOVERY_CREATE_PASS` together; on startup, Synkronus creates or overwrites that user as admin. Remove these recovery variables after use so credentials are not reset on every restart.

## Volume Management

### Migrating from older layouts

Earlier examples used separate mounts for `/app/data/app-bundles` and `/app/data/app-bundle-versions`, and the active bundle lived at `app-bundles` instead of `app-bundle/active`. Mutable filesystem data for the official image lives under **`/app/data`** (see above).

To move to a single volume at `/app/data`:

1. Stop the stack.
2. On the volume that will be mounted at `/app/data`, create: `app-bundle/active`, `app-bundle/versions`, and `attachments`.
3. Copy the previous active bundle files into `app-bundle/active`, and numbered version folders into `app-bundle/versions`.
4. Move attachment blobs into `attachments/` if they were stored elsewhere (e.g. under an old ephemeral path).
5. In Compose, use one volume mount `synkronus_data:/app/data` (see `docker-compose.example.yml`).

### Persistent Volumes

The docker-compose setup uses persistent volumes for:

1. **postgres-data**: PostgreSQL database files
2. **synkronus_data** (or your chosen name): All Synkronus mutable filesystem data under `/app/data` (app-bundle active + versions, attachments)

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

### Data directory permissions (`/app/data` in Docker)

When you bind-mount a host directory at **`/app/data`** (next to the binary at `/app/synkronus`), the Synkronus container must be able to write there. The container runs as user `synkronus` with `uid=1000` and `gid=1000`, so the host directory should be owned (or at least writable) by `1000:1000`.

```bash
# Check running containers
docker ps

# Confirm the user inside the synkronus container
docker exec -it <synkronus-container-id> id

# Example: fix permissions on the host bind mount used for Synkronus data
sudo chown -R 1000:1000 ~/server/synkronus-data
```

If you use a different host path, adjust the `chown` command accordingly. After fixing permissions, you may need to restart the stack:

```bash
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
  $(docker volume inspect synkronus_postgres-data --format '{{ .Mountpoint }}')

# Filesystem data (adjust volume name if Compose adds a project prefix — use `docker volume ls`):
# docker run --rm -v synkronus_data:/data -v $(pwd):/backup alpine tar czf /backup/synkronus-data.tar.gz -C /data .
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

```bash
# After first deployment, change admin password via API
curl -X POST https://synkronus.your-domain.com/users/change-password \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"old","new_password":"new"}'
```

### 3. Regular Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker compose pull
docker compose up -d
```

### 4. Firewall Configuration

```bash
# If not using cloudflared, configure firewall
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 5. Enable SSL (if not using Cloudflared)

Update `nginx.conf` to include SSL configuration and mount certificates in `docker-compose.yml`.

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

### Cloudflared Tunnel Issues

```bash
# Check tunnel status
sudo systemctl status cloudflared

# View tunnel logs
sudo journalctl -u cloudflared -f

# Test tunnel connectivity
cloudflared tunnel info synkronus
```

### Port Already in Use

```bash
# Find what's using port 80
sudo lsof -i :80

# Stop conflicting service
sudo systemctl stop apache2  # or nginx, etc.
```

## Performance Tuning

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
  - "-c"
  - "maintenance_work_mem=64MB"
  - "-c"
  - "checkpoint_completion_target=0.9"
  - "-c"
  - "wal_buffers=16MB"
  - "-c"
  - "default_statistics_target=100"
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

### Nginx Caching

Update `nginx.conf` to add caching for static assets:

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;
proxy_cache my_cache;
```

## Scaling

### Horizontal Scaling

To run multiple Synkronus instances:

```yaml
# In docker-compose.yml
synkronus:
  image: ghcr.io/opendataensemble/synkronus:latest
  deploy:
    replicas: 3
```

Update nginx.conf upstream:

```nginx
upstream synkronus_backend {
    least_conn;
    server synkronus:8080;
    # Add more instances as needed
}
```

### External PostgreSQL

For better performance, use a managed PostgreSQL service:

1. Remove postgres service from `docker-compose.yml`
2. Update `DB_CONNECTION` to point to external database
3. Ensure network connectivity

## Monitoring

### Prometheus Metrics (Future Enhancement)

Add to `docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus-data:/prometheus
  ports:
    - "9090:9090"

grafana:
  image: grafana/grafana
  ports:
    - "3000:3000"
  volumes:
    - grafana-data:/var/lib/grafana
```

### Log Aggregation

Use Docker logging drivers:

```yaml
# In docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Architecture Diagram

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

## Support and Resources

### Documentation
- [Docker Quick Start](DOCKER.md) - Quick start guide
- [GitHub Repository](https://github.com/opendataensemble/ode)
- [CI/CD Documentation](../.github/CICD.md)

### External Resources
- [Docker Documentation](https://docs.docker.com/)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)

### Getting Help

1. Check logs: `docker compose logs`
2. Review this guide
3. Check GitHub issues
4. Consult the troubleshooting section

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

---

**Your Synkronus instance is now ready for production! 🚀**
