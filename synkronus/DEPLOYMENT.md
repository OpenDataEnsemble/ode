# Synkronus Docker Deployment Guide

This guide covers deploying Synkronus using Docker, including deployment on platforms like Coolify.

## Quick Start

### Building the Docker Image

```bash
docker build -t synkronus:latest .
```

### Running with Docker

```bash
docker run -d \
  --name synkronus \
  -p 8080:8080 \
  -e DB_CONNECTION="postgres://user:password@your-db-host:5432/synkronus" \
  -e JWT_SECRET="your-secret-jwt-key" \
  -e APP_BUNDLE_PATH="/app/data/app-bundles" \
  -v synkronus-bundles:/app/data/app-bundles \
  synkronus:latest
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_CONNECTION` | PostgreSQL connection string | `postgres://user:pass@host:5432/dbname` |
| `JWT_SECRET` | Secret key for JWT token signing | `your-secret-key-min-32-chars` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warn`, `error`) |
| `APP_BUNDLE_PATH` | `/app/data/app-bundles` | Path for app bundle storage |
| `MAX_VERSIONS_KEPT` | `5` | Number of app bundle versions to retain |
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | `admin` | Initial admin password |

## Volume Mounts

### App Bundle Storage

The application stores app bundles (uploaded application files) in a persistent directory. You **must** mount a volume to preserve this data:

```bash
-v /path/on/host:/app/data/app-bundles
```

Or using a named volume:

```bash
-v synkronus-bundles:/app/data/app-bundles
```

## Deployment on Coolify

### Prerequisites

1. **PostgreSQL Database**: Set up a PostgreSQL database in Coolify first
2. **Note the connection details**: hostname, port, username, password, database name

### Deployment Steps

1. **Create a new service** in Coolify
   - Choose "Docker Image" or "Git Repository"
   - If using Git, point to your Synkronus repository

2. **Configure Environment Variables**:
   ```env
   DB_CONNECTION=postgres://username:password@postgres-host:5432/synkronus
   JWT_SECRET=your-very-secure-random-secret-key-here
   PORT=8080
   LOG_LEVEL=info
   APP_BUNDLE_PATH=/app/data/app-bundles
   MAX_VERSIONS_KEPT=5
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-admin-password
   ```

3. **Configure Persistent Storage**:
   - Add a volume mount in Coolify
   - Source: Create a new persistent volume (e.g., `synkronus-app-bundles`)
   - Destination: `/app/data/app-bundles`

4. **Configure Port Mapping**:
   - Container port: `8080`
   - Public port: Your choice (or let Coolify assign)

5. **Health Check** (optional but recommended):
   - Path: `/health`
   - Port: `8080`
   - Interval: `30s`

6. **Deploy**: Click deploy and monitor the logs

### Database Connection String Format

For PostgreSQL in Coolify, your connection string will look like:

```
postgres://username:password@service-name:5432/database_name?sslmode=disable
```

- Replace `service-name` with your PostgreSQL service name in Coolify
- Use `sslmode=require` if your database requires SSL

### Security Recommendations

1. **JWT Secret**: Generate a strong random secret:
   ```bash
   openssl rand -base64 32
   ```

2. **Admin Password**: Change the default admin password immediately after first login

3. **Database Password**: Use a strong, unique password for your database

4. **SSL/TLS**: Enable SSL for database connections in production:
   ```
   postgres://user:pass@host:5432/db?sslmode=require
   ```

## Docker Compose (Local Development)

For local development and testing, use the provided `docker-compose.example.yml`:

```bash
# Copy and customize the example
cp docker-compose.example.yml docker-compose.yml

# Edit docker-compose.yml with your settings
nano docker-compose.yml

# Start services
docker-compose up -d

# View logs
docker-compose logs -f synkronus

# Stop services
docker-compose down
```

## Troubleshooting

### Database Connection Issues

1. **Check connection string format**:
   ```
   postgres://username:password@hostname:port/database?sslmode=disable
   ```

2. **Verify database is accessible** from the container:
   ```bash
   docker exec -it synkronus sh
   apk add postgresql-client
   psql "postgres://user:pass@host:5432/dbname"
   ```

3. **Check logs**:
   ```bash
   docker logs synkronus
   ```

### Volume/Storage Issues

1. **Verify volume is mounted**:
   ```bash
   docker inspect synkronus | grep -A 10 Mounts
   ```

2. **Check permissions**:
   ```bash
   docker exec -it synkronus ls -la /app/data/app-bundles
   ```

### Application Won't Start

1. **Check environment variables**:
   ```bash
   docker exec -it synkronus env | grep -E 'DB_CONNECTION|JWT_SECRET|PORT'
   ```

2. **View detailed logs**:
   ```bash
   docker logs synkronus --tail 100
   ```

3. **Test health endpoint**:
   ```bash
   curl http://localhost:8080/health
   ```

## Updating the Application

### Pull New Image

```bash
docker pull your-registry/synkronus:latest
docker stop synkronus
docker rm synkronus
docker run -d [same options as before] synkronus:latest
```

### With Docker Compose

```bash
docker-compose pull
docker-compose up -d
```

### On Coolify

Coolify will automatically rebuild and redeploy when you push to your repository (if using Git deployment).

## Backup and Restore

### Database Backup

```bash
docker exec postgres pg_dump -U synkronus_user synkronus > backup.sql
```

### App Bundle Backup

```bash
docker cp synkronus:/app/data/app-bundles ./backup-bundles
```

### Restore

```bash
# Database
docker exec -i postgres psql -U synkronus_user synkronus < backup.sql

# App Bundles
docker cp ./backup-bundles synkronus:/app/data/app-bundles
```

## Performance Tuning

### Database Connection Pooling

The application uses Go's database/sql package with built-in connection pooling. For high-traffic deployments, ensure your PostgreSQL server is properly configured.

### Resource Limits

Set appropriate resource limits in production:

```bash
docker run -d \
  --memory="512m" \
  --cpus="1.0" \
  [other options] \
  synkronus:latest
```

Or in docker-compose.yml:

```yaml
services:
  synkronus:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Monitoring

### Health Check Endpoint

The application exposes a `/health` endpoint for monitoring:

```bash
curl http://localhost:8080/health
```

### Logs

View application logs:

```bash
docker logs -f synkronus
```

Set log level via environment variable:

```env
LOG_LEVEL=debug  # debug, info, warn, error
```

## Support

For issues and questions:
- Check the logs first: `docker logs synkronus`
- Review this deployment guide
- Check the main README.md for application-specific documentation
