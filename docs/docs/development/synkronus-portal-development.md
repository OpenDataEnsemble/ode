---
sidebar_position: 6
---

# Synkronus Portal Development

Complete guide for developing the Synkronus Portal web interface.

## Prerequisites

- **Node.js** 20+ and **pnpm** 10.33.2
- **Go** 1.22+ (for backend)
- **PostgreSQL** 17+ (for backend)

Install shared packages before the portal:

```bash
cd packages/tokens && pnpm install && pnpm run build && cd ../..
cd packages/components && pnpm install && cd ../..
```

## Local Development Setup

<Tabs>
  <TabItem value="dockerless" label="Dockerless Development">

#### Step 1: Set Up Backend

See [Synkronus Development](/development/synkronus-development) for backend setup.

#### Step 2: Set Up Frontend

```bash
cd synkronus-portal
pnpm install
```

#### Step 3: Start Development Server

```bash
pnpm run dev
```

Portal available at http://localhost:5174

  </TabItem>
  <TabItem value="docker" label="Docker Development">

#### Start Backend Services

```bash
docker compose up -d postgres synkronus
```

#### Start Frontend

```bash
cd synkronus-portal
pnpm install
pnpm run dev
```

Portal available at http://localhost:5174

  </TabItem>
</Tabs>

## Development Features

- **Hot Module Replacement**: Instant code updates
- **Fast Refresh**: React components update without losing state
- **Source Maps**: Debug in browser DevTools
- **Error Overlay**: Errors shown in browser

## Building for Production

### Build

```bash
pnpm run build
```

`prebuild` runs OpenAPI client generation from `../synkronus/openapi/synkronus.yaml`. Output is in `dist/`.

### Docker Production Build

```bash
docker compose up -d --build
```

## Project Structure

- `src/`: React source code
- `src/components/`: Reusable components
- `src/pages/`: Page components
- `src/services/`: API service
- `src/contexts/`: React contexts

## Adding Features

See [Synkronus Portal Reference](/reference/synkronus-portal) for detailed patterns.

## Related Documentation

- [Synkronus Portal Reference](/reference/synkronus-portal) - Component reference
- [Deployment Guide](/guides/deployment) - Production deployment
