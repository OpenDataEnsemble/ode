# CI/CD Pipeline Documentation

This document describes the CI/CD pipelines for the Open Data Ensemble (ODE) monorepo.

## Overview

The ODE monorepo uses GitHub Actions for continuous integration and deployment. Each project has its own pipeline that triggers only when relevant files change.

## Pipelines

### Synkronus Docker Build & Publish

**Workflow File**: `.github/workflows/synkronus-docker.yml`

#### Triggers

- **Push to `main`**: Builds and publishes release images
- **Push to `dev`**: Builds and publishes pre-release images
- **Push to feature branches**: Builds and publishes branch-specific images
- **Pull Requests**: Builds but does not publish (validation only)
- **Manual Dispatch**: Allows manual triggering with optional version tag

#### Path Filters

The workflow only runs when files in these paths change:
- `synkronus/**` - Any file in the Synkronus project
- `.github/workflows/synkronus-docker.yml` - The workflow itself

#### Image Registry

Images are published to **GitHub Container Registry (GHCR)**:
- Registry: `ghcr.io`
- Image: `ghcr.io/opendataensemble/synkronus`

#### Tagging Strategy

| Branch/Event | Tags Generated | Description |
|--------------|----------------|-------------|
| `main` | `latest`, `main-{sha}` | Latest stable release |
| `dev` | `dev`, `dev-{sha}` | Development pre-release |
| Feature branches | `{branch-name}`, `{branch-name}-{sha}` | Feature-specific builds |
| Pull Requests | `pr-{number}` | PR validation builds (not pushed) |
| Manual with version | `v{version}`, `v{major}.{minor}`, `latest` | Versioned release |

#### Build Features

- **Multi-platform**: Builds for `linux/amd64` and `linux/arm64`
- **Build Cache**: Uses GitHub Actions cache for faster builds
- **Attestation**: Generates build provenance for security
- **Metadata**: Includes OCI-compliant labels and annotations

#### Permissions Required

The workflow requires these permissions:
- `contents: read` - To checkout the repository
- `packages: write` - To publish to GHCR

#### Secrets Used

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

## Using Published Images

### Pull Latest Release

```bash
docker pull ghcr.io/opendataensemble/synkronus:latest
```

### Pull Specific Version

```bash
docker pull ghcr.io/opendataensemble/synkronus:v1.0.0
```

### Pull Development Build

```bash
docker pull ghcr.io/opendataensemble/synkronus:dev
```

### Pull Feature Branch Build

```bash
docker pull ghcr.io/opendataensemble/synkronus:feature-xyz
```

## Manual Release Process

To create a versioned release:

1. Go to **Actions** → **Synkronus Docker Build & Publish**
2. Click **Run workflow**
3. Select the `main` branch
4. Enter version (e.g., `v1.0.0`)
5. Click **Run workflow**

This will create:
- `ghcr.io/opendataensemble/synkronus:latest`
- `ghcr.io/opendataensemble/synkronus:v1.0.0`
- `ghcr.io/opendataensemble/synkronus:v1.0`

## Image Visibility

By default, GHCR packages inherit the repository's visibility:
- **Public repositories** → Public images (no authentication needed)
- **Private repositories** → Private images (authentication required)

### Authenticating with GHCR

For private images:

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

## Monitoring Builds

### View Workflow Runs

1. Go to the **Actions** tab in GitHub
2. Select **Synkronus Docker Build & Publish**
3. View recent runs and their status

### View Published Images

1. Go to the repository main page
2. Click **Packages** in the right sidebar
3. Select **synkronus**
4. View all published tags and their details

## Code Formatting & Linting

All workflows enforce formatting and linting checks before builds. Ensure your code is properly formatted before pushing to avoid CI failures.

### Go Projects (synkronus, synkronus-cli)

#### Format Go Code

Format all Go files in a project:

```bash
# For synkronus
cd synkronus
go fmt ./...

# Or using gofmt directly
gofmt -s -w .

# For synkronus-cli
cd synkronus-cli
go fmt ./...
```

#### Check Go Formatting (without modifying files)

```bash
# Check if files are formatted
gofmt -s -l .

# View what would change
gofmt -s -d .
```

#### Run Linting

```bash
# Install golangci-lint (if not already installed)
# macOS: brew install golangci-lint
# Linux: curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(go env GOPATH)/bin v1.54.2

# Run linting for synkronus
cd synkronus
golangci-lint run

# Run linting for synkronus-cli
cd synkronus-cli
golangci-lint run
```

### TypeScript/JavaScript Projects

#### Synkronus Portal

```bash
cd synkronus-portal

# Format code
npm run format

# Check formatting (no writes)
npm run format:check

# Run linting
npm run lint
```

#### Formulus (React Native)

```bash
cd formulus

# Format code
npm run format

# Check formatting (no writes)
npm run format:check

# Run linting
npm run lint

# Run linting with auto-fix
npm run lint:fix
```

#### Formulus Formplayer (React Web)

```bash
cd formulus-formplayer

# Format code
npm run format

# Check formatting (no writes)
npm run format:check

# Run linting
npm run lint

# Run linting with auto-fix
npm run lint:fix
```

### What CI Enforces

#### Go Projects

- **gofmt**: All Go files must be formatted. CI will fail if any files are unformatted.
- **golangci-lint**: Runs comprehensive linting checks using the `.golangci.yml` configuration.

#### TypeScript/JavaScript Projects

- **Prettier**: All source files must be formatted according to Prettier rules.
- **ESLint**: Code must pass ESLint checks with no errors.

### Pre-commit Checklist

Before pushing your code, run these commands:

```bash
# For Go projects
cd synkronus  # or synkronus-cli
go fmt ./...
golangci-lint run

# For TypeScript/JavaScript projects
cd synkronus-portal  # or formulus, or formulus-formplayer
npm run format:check
npm run lint
```

### Auto-formatting with Git Hooks (Optional)

You can set up a pre-commit hook to automatically format code:

```bash
# Create .git/hooks/pre-commit
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Format Go files
find . -name "*.go" -not -path "./vendor/*" -exec gofmt -s -w {} \;
# Format TypeScript/JavaScript files
cd synkronus-portal && npm run format
cd ../formulus && npm run format
cd ../formulus-formplayer && npm run format
EOF

chmod +x .git/hooks/pre-commit
```

## Troubleshooting

### Build Fails on Push

1. Check the **Actions** tab for error logs
2. Common issues:
   - Dockerfile syntax errors
   - Missing dependencies in build context
   - Network issues during dependency download

### Image Not Published

1. Verify the branch name matches the workflow triggers
2. Check that the workflow has `packages: write` permission
3. Ensure the push event (not PR) triggered the workflow

### Cannot Pull Image

1. Verify the image tag exists in GHCR
2. For private repos, ensure you're authenticated
3. Check image name spelling: `ghcr.io/opendataensemble/synkronus`

## Best Practices

### For Developers

1. **Test locally first**: Build and test Docker images locally before pushing
2. **Use feature branches**: Create feature branches for experimental changes
3. **Review build logs**: Check Actions logs even for successful builds
4. **Tag releases properly**: Use semantic versioning for releases

### For Deployments

1. **Pin versions in production**: Use specific version tags, not `latest`
2. **Test pre-releases**: Use `dev` tag for staging environments
3. **Monitor image sizes**: Keep images lean for faster deployments
4. **Use health checks**: Always configure health checks in deployments

## Future Enhancements

Potential improvements to the CI/CD pipeline:

- [ ] Add automated testing before build
- [ ] Implement security scanning (Trivy, Snyk)
- [ ] Add deployment to staging environment
- [ ] Create release notes automation
- [ ] Implement rollback mechanisms
- [ ] Add performance benchmarking

## Related Documentation

- [Root README](../README.md) - Monorepo overview
- [Synkronus DOCKER.md](../synkronus/DOCKER.md) - Docker quick start
- [Synkronus DEPLOYMENT.md](../synkronus/DEPLOYMENT.md) - Comprehensive deployment guide
