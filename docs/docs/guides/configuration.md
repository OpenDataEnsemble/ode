---
sidebar_position: 4
---

# Configuration

Complete configuration guide for ODE components including server settings, client settings, and environment variables.

## Server Configuration (Synkronus)

Synkronus is configured using environment variables. You can use either environment variables directly or a `.env` file for local development.

### Configuration File Locations

For local development, create a `.env` file in one of these locations (searched in order):

1. Current working directory (where you run the command from)
2. Same directory as the executable
3. Parent directory of the executable

### Required Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_CONNECTION` | PostgreSQL connection string | `postgres://user:password@localhost:5432/synkronus?sslmode=disable` |
| `JWT_SECRET` | Secret key for JWT token signing (minimum 32 characters) | Generate with `openssl rand -base64 32` |

### Optional Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, or `error` |
| `APP_BUNDLE_PATH` | `./data/app-bundles` | Directory path for app bundle storage |
| `MAX_VERSIONS_KEPT` | `5` | Maximum number of app bundle versions to retain |
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | `admin` | Initial admin password (must be changed in production) |

### Example Configuration File

```bash
# Server Configuration
PORT=8080
DB_CONNECTION=postgres://synkronus:password@localhost:5432/synkronus?sslmode=disable
JWT_SECRET=your-secret-key-change-this-in-production
LOG_LEVEL=info
APP_BUNDLE_PATH=./data/app-bundles
MAX_VERSIONS_KEPT=5

# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-password
```

### Database Connection String Format

The `DB_CONNECTION` string follows PostgreSQL connection URI format:

```
postgres://[user[:password]@][host][:port][/database][?param1=value1&...]
```

**Components:**
- `user`: Database username
- `password`: Database password
- `host`: Database hostname or IP address
- `port`: Database port (default: 5432)
- `database`: Database name
- `sslmode`: SSL mode (`disable`, `require`, `verify-full`, etc.)

**Examples:**

```bash
# Local development
DB_CONNECTION=postgres://synkronus:password@localhost:5432/synkronus?sslmode=disable

# Remote database
DB_CONNECTION=postgres://synkronus:password@db.example.com:5432/synkronus?sslmode=require

# Docker Compose
DB_CONNECTION=postgres://synkronus:password@postgres:5432/synkronus?sslmode=disable
```

## Client Configuration (Formulus)

The Formulus mobile app is configured through the app settings interface.

### Server URL

Enter the URL of your Synkronus server:

<Tabs>
  <TabItem value="development" label="Development">

**Physical Device**: `http://192.168.1.100:8080` (your machine's IP address)

**Android Emulator**: `http://10.0.2.2:8080` (special IP for emulator)

**iOS Simulator**: `http://localhost:8080` or your machine's IP address

  </TabItem>
  <TabItem value="production" label="Production">

**HTTPS URL**: `https://synkronus.your-domain.com`

**Custom Port**: `https://synkronus.your-domain.com:8443` (if using non-standard port)

  </TabItem>
</Tabs>

### Authentication

Configure authentication credentials:

1. **Username**: Your user account username
2. **Password**: Your user account password
3. **Server URL**: As described above

The app stores credentials securely and uses them for API authentication.

### Sync Settings

Configure synchronization behavior:

- **Auto-sync**: Enable automatic synchronization when connectivity is available
- **Sync interval**: How often to check for sync (default: every 15 minutes)
- **Sync on app start**: Automatically sync when the app is opened
- **Sync on observation save**: Sync immediately after saving an observation

## Synkronus CLI Configuration

The Synkronus CLI uses a configuration file located at `$HOME/.synkronus.yaml` by default.

### Configuration File Format

```yaml
api:
  url: http://localhost:8080
  version: 1.0.0
```

### Multiple Endpoints

You can manage multiple endpoint configurations:

```bash
# Create separate config files
synk config init -o ~/.synkronus-dev.yaml
synk config init -o ~/.synkronus-prod.yaml

# Point CLI at dev by default
synk config use ~/.synkronus-dev.yaml

# Point CLI at prod by default
synk config use ~/.synkronus-prod.yaml

# Temporarily override for a single command
synk --config ~/.synkronus-dev.yaml status
```

### Authentication

The CLI stores authentication tokens in the configuration file after login:

```bash
# Login to the API
synk login --username your-username

# Check authentication status
synk status

# Logout
synk logout
```

## Docker Configuration

### Docker Compose Configuration

When using Docker Compose, configuration is set in the `docker-compose.yml` file:

```yaml
services:
  synkronus:
    image: ghcr.io/opendataensemble/synkronus:latest
    environment:
      PORT: 8080
      DB_CONNECTION: postgres://synkronus:password@postgres:5432/synkronus?sslmode=disable
      JWT_SECRET: your-secret-key
      LOG_LEVEL: info
      APP_BUNDLE_PATH: /app/data/app-bundles
      MAX_VERSIONS_KEPT: 5
    volumes:
      - app-bundles:/app/data/app-bundles
    depends_on:
      - postgres
```

### Environment File

You can also use a `.env` file with Docker Compose:

```bash
# .env file
DB_CONNECTION=postgres://synkronus:password@postgres:5432/synkronus?sslmode=disable
JWT_SECRET=your-secret-key
LOG_LEVEL=info
```

Reference in `docker-compose.yml`:

```yaml
services:
  synkronus:
    env_file:
      - .env
```

## Security Configuration

### JWT Secret

Generate a strong JWT secret:

```bash
# Using OpenSSL
openssl rand -base64 32

# Using PowerShell (Windows)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Important:** Use a different secret for each environment (development, staging, production).

### Database Passwords

Generate strong database passwords:

```bash
# Generate random password
openssl rand -base64 24
```

### Admin Password

Change the default admin password immediately after deployment:

```bash
# Via API
curl -X POST https://your-server.com/users/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"admin","new_password":"new-secure-password"}'
```

## Logging Configuration

### Log Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `debug` | Detailed diagnostic information | Development, troubleshooting |
| `info` | General informational messages | Production (default) |
| `warn` | Warning messages | Production |
| `error` | Error messages only | Production (minimal logging) |

### Log Output

Logs are written to standard output (stdout) and can be captured by:

- Docker logging drivers
- Systemd journal
- Log aggregation services (e.g., Fluentd, Logstash)

### Docker Logging

Configure Docker logging in `docker-compose.yml`:

```yaml
services:
  synkronus:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Performance Configuration

### PostgreSQL Settings

Optimize PostgreSQL for your workload:

```yaml
services:
  postgres:
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

Set resource limits in Docker Compose:

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

## Configuration Validation

### Verify Configuration

Test your configuration:

```bash
# Check environment variables are set
docker compose config

# Test database connection
docker compose exec synkronus sh -c 'apk add postgresql-client && psql "$DB_CONNECTION"'

# Check server health
curl http://localhost:8080/health
```

### Common Configuration Issues

**Problem**: Database connection fails

**Solution**: Verify `DB_CONNECTION` string format and database accessibility.

**Problem**: JWT authentication fails

**Solution**: Ensure `JWT_SECRET` is at least 32 characters and matches across all instances.

**Problem**: App bundles not persisting

**Solution**: Verify `APP_BUNDLE_PATH` is set and volume is properly mounted.

## Related Documentation

- [Installation Guide](/docs/getting-started/installation)
- [Deployment Guide](/guides/deployment)
- [API Reference](/reference/api)
