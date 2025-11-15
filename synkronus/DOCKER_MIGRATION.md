# Docker Migration to GHCR

This document describes the migration from local Docker builds to GitHub Container Registry (GHCR) for the Synkronus project.

## Summary of Changes

The Synkronus project has been modernized to use a CI/CD pipeline that automatically builds and publishes Docker images to GitHub Container Registry.

## What Changed

### 1. GitHub Actions Workflow Created

**File**: `.github/workflows/synkronus-docker.yml`

- Automatically builds Docker images on push to `main`, `develop`, or feature branches
- Publishes images to `ghcr.io/opendataensemble/synkronus`
- Supports multi-platform builds (amd64, arm64)
- Implements semantic versioning and branch-based tagging
- Only triggers when Synkronus files change (monorepo-aware)

### 2. Documentation Updated

#### Root README (`README.md`)
- Added CI/CD Pipeline section
- Documented image tagging strategy
- Added usage examples for GHCR images

#### Synkronus DOCKER.md (`synkronus/DOCKER.md`)
- Prioritizes pre-built images over local builds
- Added available tags documentation
- Included multi-platform build instructions
- Updated Coolify deployment instructions

#### Synkronus DEPLOYMENT.md (`synkronus/DEPLOYMENT.md`)
- Updated quick start to use GHCR images
- Modified Coolify deployment steps
- Added image tag reference
- Maintained comprehensive deployment guide

#### Synkronus README (`synkronus/README.md`)
- Updated Docker quick start to use GHCR images

#### Docker Compose Example (`synkronus/docker-compose.example.yml`)
- Changed default to use GHCR image
- Kept local build option as comment

### 3. New Documentation Created

#### CI/CD Documentation (`.github/CICD.md`)
- Comprehensive pipeline documentation
- Tagging strategy details
- Usage examples
- Troubleshooting guide
- Best practices

## Migration Benefits

### For Developers
- ✅ No need to build images locally for testing
- ✅ Consistent images across all environments
- ✅ Faster deployment iterations
- ✅ Easy rollback to previous versions

### For Operations
- ✅ Automated builds on every commit
- ✅ Version-tagged images for production
- ✅ Multi-platform support (amd64, arm64)
- ✅ Build provenance and attestation
- ✅ Reduced deployment time

### For CI/CD
- ✅ Monorepo-aware (only builds when Synkronus changes)
- ✅ Branch-based pre-release versions
- ✅ Automated semantic versioning
- ✅ Build caching for faster iterations

## Image Tagging Strategy

| Source | Tags | Use Case |
|--------|------|----------|
| `main` branch | `latest`, `main-{sha}` | Production deployments |
| `develop` branch | `develop`, `develop-{sha}` | Staging/testing |
| Feature branches | `{branch}`, `{branch}-{sha}` | Feature testing |
| Manual release | `v{version}`, `v{major}.{minor}` | Versioned releases |
| Pull requests | `pr-{number}` | PR validation (not pushed) |

## How to Use

### For Production Deployments

```bash
# Pull latest stable release
docker pull ghcr.io/opendataensemble/synkronus:latest

# Or use a specific version
docker pull ghcr.io/opendataensemble/synkronus:v1.0.0
```

### For Development/Testing

```bash
# Pull development version
docker pull ghcr.io/opendataensemble/synkronus:develop

# Or pull a feature branch
docker pull ghcr.io/opendataensemble/synkronus:feature-xyz
```

### For Local Development

If you need to build locally (e.g., testing Dockerfile changes):

```bash
cd synkronus
docker build -t synkronus:local .
```

## Production Deployment

### Before (Manual Build)
1. Build Docker image on server
2. Wait for build on every deployment
3. Build happens on deployment server

### After (GHCR Images)
1. Use pre-built images from GHCR
2. Image: `ghcr.io/opendataensemble/synkronus:latest`
3. Instant deployment (no build time)
4. Easy version pinning and rollback
5. Deploy with docker-compose

## Rollback Procedure

If a new version has issues:

```bash
# Stop current container
docker stop synkronus
docker rm synkronus

# Pull and run previous version
docker pull ghcr.io/opendataensemble/synkronus:v1.0.0
docker run -d [same options] ghcr.io/opendataensemble/synkronus:v1.0.0
```

## Creating a Release

### Automatic (Recommended)
Push to `main` branch - automatically creates `latest` tag

### Manual with Version Tag
1. Go to Actions → Synkronus Docker Build & Publish
2. Click "Run workflow"
3. Select `main` branch
4. Enter version: `v1.0.0`
5. Click "Run workflow"

Creates:
- `ghcr.io/opendataensemble/synkronus:latest`
- `ghcr.io/opendataensemble/synkronus:v1.0.0`
- `ghcr.io/opendataensemble/synkronus:v1.0`

## Monitoring

### View Builds
- GitHub → Actions → Synkronus Docker Build & Publish

### View Published Images
- GitHub → Packages → synkronus

### Build Status Badge
Add to README if desired:
```markdown
![Docker Build](https://github.com/opendataensemble/ode/actions/workflows/synkronus-docker.yml/badge.svg)
```

## Troubleshooting

### Image Not Found
- Check tag spelling: `ghcr.io/opendataensemble/synkronus:latest`
- Verify the workflow ran successfully
- For private repos, ensure authentication

### Build Failures
- Check Actions logs for errors
- Verify Dockerfile syntax
- Test build locally first

### Deployment Issues
- Verify environment variables are set
- Check volume mounts are configured
- Review container logs: `docker logs synkronus`

## Next Steps

Recommended enhancements:
1. Add automated testing before build
2. Implement security scanning (Trivy)
3. Add deployment to staging environment
4. Create automated release notes
5. Add notification system (Slack/Discord)

## References

- [GitHub Actions Workflow](.github/workflows/synkronus-docker.yml)
- [CI/CD Documentation](.github/CICD.md)
- [Docker Quick Start](synkronus/DOCKER.md)
- [Deployment Guide](synkronus/DEPLOYMENT.md)
- [GHCR Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
