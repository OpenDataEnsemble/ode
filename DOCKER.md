# Docker Build and Run Guide

This guide explains how to build and run the combined Synkronus Docker image, which includes both the Synkronus API backend and the Portal frontend in a single container.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (run as separate container or use existing database)

## Quick Start with Docker Compose (Recommended)

1. **Update credentials** in `docker-compose.yml`:
   - `POSTGRES_PASSWORD`: Change `your_password`
   - `DB_CONNECTION`: Update password in connection string
   - `JWT_SECRET`: Generate with `openssl rand -base64 32`

2. **Start all services**:
   ```bash
   docker compose up -d
   ```


## Docker Compose Commands

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Check status
docker compose ps

# Stop services
docker compose down

# Stop and remove volumes (WARNING: deletes data)
docker compose down -v
```
