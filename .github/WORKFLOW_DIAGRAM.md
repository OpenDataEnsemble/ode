# Synkronus CI/CD Workflow Diagram

Visual representation of the Docker build and deployment workflow.

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Developer Actions                            │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌───────────┐  ┌───────────┐  ┌───────────┐
            │Push to    │  │Push to    │  │Create     │
            │main       │  │develop/   │  │Pull       │
            │           │  │feature    │  │Request    │
            └───────────┘  └───────────┘  └───────────┘
                    │              │              │
                    └──────────────┼──────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GitHub Actions Trigger                          │
│  Condition: Files in synkronus/** changed                           │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Build Process                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 1. Checkout repository                                       │  │
│  │ 2. Set up Docker Buildx                                      │  │
│  │ 3. Login to GHCR                                             │  │
│  │ 4. Extract metadata (tags, labels)                           │  │
│  │ 5. Build multi-platform image (amd64, arm64)                 │  │
│  │ 6. Push to GHCR (if not PR)                                  │  │
│  │ 7. Generate attestation                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌───────────┐  ┌───────────┐  ┌───────────┐
            │main       │  │develop/   │  │PR         │
            │→ latest   │  │feature    │  │→ pr-N     │
            │→ main-sha │  │→ branch   │  │(validate  │
            │           │  │→ branch-  │  │ only)     │
            │           │  │  sha      │  │           │
            └───────────┘  └───────────┘  └───────────┘
                    │              │              │
                    └──────────────┼──────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│              GitHub Container Registry (GHCR)                        │
│                                                                      │
│  ghcr.io/opendataensemble/synkronus:{tag}                           │
│                                                                      │
│  Available for:                                                     │
│  • Docker pull                                                      │
│  • Docker Compose                                                   │
│  • Kubernetes                                                       │
│  • Coolify                                                          │
│  • Any container platform                                           │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌───────────┐  ┌───────────┐  ┌───────────┐
            │Production │  │Staging    │  │Development│
            │(latest)   │  │(develop)  │  │(feature-x)│
            └───────────┘  └───────────┘  └───────────┘
```

## Detailed Flow by Branch

### Main Branch Flow

```
Developer
    │
    ├─> git push origin main
    │
    ▼
GitHub Actions
    │
    ├─> Detect synkronus/** changes
    │
    ├─> Build Docker image
    │   ├─> Platform: linux/amd64
    │   └─> Platform: linux/arm64
    │
    ├─> Tag images
    │   ├─> latest
    │   └─> main-{sha}
    │
    ├─> Push to GHCR
    │
    └─> Generate attestation
    │
    ▼
GHCR
    │
    ├─> ghcr.io/opendataensemble/synkronus:latest
    └─> ghcr.io/opendataensemble/synkronus:main-abc123
    │
    ▼
Production Deployment
    │
    └─> docker pull ghcr.io/opendataensemble/synkronus:latest
```

### Feature Branch Flow

```
Developer
    │
    ├─> git checkout -b feature-xyz
    ├─> git push origin feature-xyz
    │
    ▼
GitHub Actions
    │
    ├─> Detect synkronus/** changes
    │
    ├─> Build Docker image
    │   ├─> Platform: linux/amd64
    │   └─> Platform: linux/arm64
    │
    ├─> Tag images
    │   ├─> feature-xyz
    │   └─> feature-xyz-{sha}
    │
    └─> Push to GHCR
    │
    ▼
GHCR
    │
    ├─> ghcr.io/opendataensemble/synkronus:feature-xyz
    └─> ghcr.io/opendataensemble/synkronus:feature-xyz-abc123
    │
    ▼
Testing Environment
    │
    └─> docker pull ghcr.io/opendataensemble/synkronus:feature-xyz
```

### Pull Request Flow

```
Developer
    │
    ├─> Create Pull Request
    │
    ▼
GitHub Actions
    │
    ├─> Detect synkronus/** changes
    │
    ├─> Build Docker image (validation)
    │   ├─> Platform: linux/amd64
    │   └─> Platform: linux/arm64
    │
    ├─> Tag: pr-{number}
    │
    └─> DO NOT PUSH (validation only)
    │
    ▼
Build Status
    │
    ├─> ✅ Success → PR can be merged
    └─> ❌ Failure → Fix required
```

## Manual Release Flow

```
Maintainer
    │
    ├─> Go to Actions → Synkronus Docker Build & Publish
    ├─> Click "Run workflow"
    ├─> Select branch: main
    ├─> Enter version: v1.0.0
    └─> Click "Run workflow"
    │
    ▼
GitHub Actions
    │
    ├─> Build Docker image
    │   ├─> Platform: linux/amd64
    │   └─> Platform: linux/arm64
    │
    ├─> Tag images
    │   ├─> latest
    │   ├─> v1.0.0
    │   └─> v1.0
    │
    └─> Push to GHCR
    │
    ▼
GHCR
    │
    ├─> ghcr.io/opendataensemble/synkronus:latest
    ├─> ghcr.io/opendataensemble/synkronus:v1.0.0
    └─> ghcr.io/opendataensemble/synkronus:v1.0
```

## Deployment Scenarios

### Scenario 1: Coolify Production Deployment

```
Coolify
    │
    ├─> Service Type: Docker Image
    ├─> Image: ghcr.io/opendataensemble/synkronus:latest
    │
    ├─> Environment Variables
    │   ├─> DB_CONNECTION
    │   ├─> JWT_SECRET
    │   └─> ...
    │
    ├─> Volume Mount
    │   └─> /app/data/app-bundles
    │
    └─> Deploy
    │
    ▼
Running Container
    │
    ├─> Health Check: /health
    ├─> Port: 8080
    └─> Logs: Available in Coolify
```

### Scenario 2: Docker Compose Development

```
Developer
    │
    ├─> docker-compose.yml
    │   └─> image: ghcr.io/opendataensemble/synkronus:develop
    │
    ├─> docker-compose up -d
    │
    ▼
Local Environment
    │
    ├─> Synkronus Container
    │   └─> Port: 8080
    │
    └─> PostgreSQL Container
        └─> Port: 5432
```

### Scenario 3: Direct Docker Run

```
User
    │
    ├─> docker pull ghcr.io/opendataensemble/synkronus:latest
    │
    ├─> docker run -d \
    │     -p 8080:8080 \
    │     -e DB_CONNECTION="..." \
    │     -e JWT_SECRET="..." \
    │     -v synkronus-bundles:/app/data/app-bundles \
    │     ghcr.io/opendataensemble/synkronus:latest
    │
    ▼
Running Container
    │
    └─> Access: http://localhost:8080
```

## Rollback Scenario

```
Production Issue Detected
    │
    ├─> Identify last working version
    │   └─> Example: v1.0.0
    │
    ├─> Pull previous version
    │   └─> docker pull ghcr.io/opendataensemble/synkronus:v1.0.0
    │
    ├─> Stop current container
    │   └─> docker stop synkronus
    │
    ├─> Remove current container
    │   └─> docker rm synkronus
    │
    ├─> Run previous version
    │   └─> docker run -d [options] ghcr.io/opendataensemble/synkronus:v1.0.0
    │
    ▼
Service Restored
    │
    └─> Investigate issue in development
```

## Build Cache Flow

```
First Build
    │
    ├─> Download all dependencies
    ├─> Build all layers
    ├─> Cache to GitHub Actions cache
    │   └─> type=gha,mode=max
    │
    └─> Total time: ~5-10 minutes
    │
    ▼
Subsequent Builds
    │
    ├─> Restore from cache
    │   └─> type=gha
    │
    ├─> Only rebuild changed layers
    │
    └─> Total time: ~1-2 minutes
```

## Multi-Platform Build

```
Docker Buildx
    │
    ├─> Build for linux/amd64
    │   ├─> Base: golang:1.24.2-alpine
    │   ├─> Compile Go binary
    │   └─> Create runtime image
    │
    ├─> Build for linux/arm64
    │   ├─> Base: golang:1.24.2-alpine
    │   ├─> Compile Go binary
    │   └─> Create runtime image
    │
    └─> Push both to GHCR
    │
    ▼
GHCR Manifest
    │
    ├─> Manifest list
    │   ├─> linux/amd64 → sha256:abc...
    │   └─> linux/arm64 → sha256:def...
    │
    └─> Docker automatically pulls correct platform
```

## Security Flow

```
Build Process
    │
    ├─> Multi-stage build
    │   ├─> Stage 1: Builder (with build tools)
    │   └─> Stage 2: Runtime (minimal)
    │
    ├─> Non-root user
    │   └─> UID: 1000, GID: 1000
    │
    ├─> Minimal base image
    │   └─> alpine:latest
    │
    ├─> Build attestation
    │   └─> Provenance metadata
    │
    └─> OCI labels
        ├─> org.opencontainers.image.title
        ├─> org.opencontainers.image.description
        └─> org.opencontainers.image.vendor
```

## Monitoring Flow

```
GitHub Actions
    │
    ├─> Workflow runs
    │   └─> Actions tab
    │
    ├─> Build logs
    │   └─> Step-by-step output
    │
    └─> Build status
        ├─> ✅ Success
        ├─> ❌ Failure
        └─> ⏸️ In progress
    │
    ▼
GHCR
    │
    ├─> Package versions
    │   └─> All published tags
    │
    ├─> Download stats
    │   └─> Pull counts
    │
    └─> Package details
        ├─> Size
        ├─> Platforms
        └─> Attestation
```

## Legend

```
┌─────┐
│ Box │  = Process or Component
└─────┘

   │
   ▼     = Flow direction

   ├─>   = Branch or option

  ✅     = Success state
  ❌     = Failure state
  ⏸️     = In progress state
```

## Quick Reference

| Symbol | Meaning |
|--------|---------|
| `main` | Main branch (production) |
| `develop` | Development branch (staging) |
| `feature-xyz` | Feature branch (testing) |
| `pr-N` | Pull request number N |
| `latest` | Latest stable release |
| `v1.0.0` | Semantic version tag |
| `{sha}` | Git commit SHA |
| GHCR | GitHub Container Registry |
| OCI | Open Container Initiative |

---

*For more details, see [CICD.md](CICD.md)*
