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

### Formulus Android Build

**Workflow File**: `.github/workflows/formulus-android.yml`

#### Purpose

Builds Android APK for the Formulus React Native application, and builds/consumes Formplayer assets in a single, two‑job workflow.

#### Triggers

- **Push to `main`/`dev`** (formulus or formulus-formplayer changes): Builds Formplayer assets and then a release APK using those assets
- **Pull Requests** (formulus or formulus-formplayer changes): Builds Formplayer assets and then a debug APK for validation
- **Release**: Publishes APK to GitHub Release

#### Path Filters

The workflow runs when files in these paths change:
- `formulus/**` - Any file in the formulus project
- `formulus-formplayer/**` - Any file in the formulus-formplayer project
- `packages/tokens/**` - Shared design tokens and build inputs
- `.github/workflows/formulus-android.yml` - The workflow itself

#### Asset Handling

The workflow intelligently handles formplayer assets using two jobs:

1. **`build-formplayer-assets` job**:
   - Builds `@ode/tokens`
   - Builds Formplayer assets using `npm run build:rn` in `formulus-formplayer`
   - Uploads the built assets from `formulus/android/app/src/main/assets/formplayer_dist/` as a GitHub Actions artifact

2. **`build-android` job** (depends on assets job):
   - Downloads the Formplayer assets artifact into `formulus/android/app/src/main/assets/formplayer_dist/`
   - Builds the Android APK (debug for PRs, release for main/dev/release events)

Formplayer assets are **not committed to git** and are ignored via `.gitignore`. CI builds always use the assets artifact produced in the same workflow run, ensuring a single, consistent source of truth for each build.

#### Build Types

- **Pull Requests**: Debug APK (unsigned)
- **Push to main/dev**: Release APK (signed with secrets)
- **Release**: Release APK published to GitHub Release

#### Secrets Required

- `FORMULUS_RELEASE_KEYSTORE_B64` - Base64 encoded keystore file
- `FORMULUS_RELEASE_STORE_PASSWORD` - Keystore password
- `FORMULUS_RELEASE_KEY_ALIAS` - Key alias
- `FORMULUS_RELEASE_KEY_PASSWORD` - Key password

#### Workflow Integration

Formplayer asset building and Android APK building are now handled within the same workflow:

```
Formplayer or Formulus Changes → build-formplayer-assets job → build-android job (consumes artifact) → APK artifact / Release upload
```

This ensures:
- No duplicate cross-workflow wiring
- A single workflow owns both asset and APK builds
- Each APK is built against the exact assets produced in the same run
- Formplayer build outputs do not pollute git history

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

## Formplayer Asset Synchronization

### How It Works

The automated asset build process ensures Formulus Android builds always have matching Formplayer assets:

1. **Developer makes changes** to `formulus-formplayer`
2. **Opens/updates PR** (or pushes to `main`/`dev`) → the Formulus Android workflow:
   - Runs the `build-formplayer-assets` job to build Formplayer assets and upload them as an artifact
   - Runs the `build-android` job, which downloads the artifact and builds the APK

### Benefits

- **No manual work**: Assets are automatically built and passed between jobs via artifacts
- **No conflicts**: Assets are not committed to git, avoiding noisy diffs and merge issues
- **Always consistent**: Each Android build uses the assets built in that same workflow run
- **Clean repository**: Built assets live only in CI artifacts and local workspaces, not in version control

### Local Development

For local development, you can manually build and copy assets:

```bash
cd formulus-formplayer
npm run build:rn
```

This will:
1. Build the formplayer web app
2. Clean existing assets in formulus
3. Copy new assets to `formulus/android/app/src/main/assets/formplayer_dist/`

The `build:rn` script automatically handles cleaning, so no need to run `clean-rn-assets` separately.

## Future Enhancements

Potential improvements to the CI/CD pipeline:

- [x] Automated formplayer asset synchronization
- [ ] Add automated testing before build
- [ ] Implement security scanning (Trivy, Snyk)
- [ ] Add deployment to staging environment
- [ ] Create release notes automation
- [ ] Add Slack/Discord notifications
- [ ] Implement rollback mechanisms
- [ ] Add performance benchmarking

## Related Documentation

- [Root README](../README.md) - Monorepo overview
- [Synkronus DOCKER.md](../synkronus/DOCKER.md) - Docker quick start
- [Synkronus DEPLOYMENT.md](../synkronus/DEPLOYMENT.md) - Comprehensive deployment guide
