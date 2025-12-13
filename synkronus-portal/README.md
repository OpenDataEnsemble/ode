# Synkronus Portal

Frontend service for Synkronus, built with React + TypeScript + Vite.

## Quick Start

Start all services (frontend, backend API, and PostgreSQL):

```bash
docker compose up -d
```

This will start:
- **Frontend Portal**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **PostgreSQL**: localhost:5432
- **Swagger UI**: http://localhost:8080/openapi/swagger-ui.html

## Development Mode

For development with hot reload:

```bash
docker compose -f docker-compose.dev.yml up
```

## Stopping Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (clears database)
docker compose down -v
```

## Default Credentials

- **Admin username**: `admin`
- **Admin password**: `admin`

**Note**: These are development credentials only. Change them before production use.
