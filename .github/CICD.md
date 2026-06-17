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

Image tags are computed by `docker/metadata-action`. The highest-priority tag per event is also used as the primary tag in manifest verification.

| Event | Tags produced | Published? |
|-------|--------------|------------|
| Release published, **not** prerelease | `v{X.Y.Z}`, `v{X.Y}`, `v{X}`, `latest` | Yes |
| Release published, **is** prerelease | `v{X.Y.Z}-{pre}`, `latest-pre-release` | Yes |
| Push → `main` | `main`, `sha-{short}` | Yes |
| Push → `dev` | `dev`, `sha-{short}` | Yes |
| Push → other branch | `{branch-name}`, `sha-{short}` | Yes |
| `workflow_dispatch` | `sha-{short}` | Yes |
| Pull request | `pr-{number}` | No (build only) |

Moving pointer tags:

- **`latest`** — always points to the most recent **non-prerelease** GitHub Release. Never moved by branch pushes.
- **`latest-pre-release`** — always points to the most recent **prerelease** GitHub Release (e.g. `-alpha.N`, `-rc.N`).
- **`main`** / **`dev`** — track the tip of the respective branch.

`workflow_dispatch` intentionally produces only `sha-{short}` so that manual runs cannot accidentally reassign `latest`, `main`, `dev`, or any other pointer tag.

#### Build Features

- **Multi-platform**: Builds for `linux/amd64` and `linux/arm64` using Buildah
- **Attestation**: Generates SLSA build provenance and pushes it to GHCR
- **Metadata**: Includes OCI-compliant labels (title, description, vendor, source, revision)
- **Verification**: After push, the manifest list and per-arch layers are pulled to confirm correctness

#### Permissions Required

The workflow requires these permissions:
- `contents: read` - To checkout the repository
- `packages: write` - To publish to GHCR
- `id-token: write` - For OIDC-based build provenance attestation
- `attestations: write` - To push attestation records to GHCR

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
   - Builds Formplayer assets using `pnpm run build:copy` in `formulus-formplayer`
   - Uploads the built assets from `formulus/android/app/src/main/assets/formplayer_dist/` as a GitHub Actions artifact

2. **`build-android` job** (depends on assets job):
   - Downloads the Formplayer assets artifact into `formulus/android/app/src/main/assets/formplayer_dist/`
   - Runs `pnpm run vendor:notifee` in `formulus/` to clone the pinned [invertase/notifee](https://github.com/invertase/notifee) commit into `third_party/notifee` (gitignored; required for Gradle `:notifee_core`)
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

### SBOM (CycloneDX) on releases

**Workflow**: `.github/workflows/sbom-release.yml`

- Runs when a **GitHub Release is published** and uploads `*.cdx.json` files to that release (alongside other assets such as the Formulus APK from `formulus-android.yml`).
- **Manual test**: Actions → *SBOM (CycloneDX)* → *Run workflow*; download the `cyclonedx-sbom` artifact.

**Local generation** (requires Node + Go):

```bash
node scripts/sbom/generate-sboms.mjs --out sbom-dist
```

## Using Published Images

### Pull Latest Stable Release

Points to the most recent non-prerelease GitHub Release.

```bash
docker pull ghcr.io/opendataensemble/synkronus:latest
```

### Pull Latest Pre-release

Points to the most recent prerelease GitHub Release (e.g. `-alpha.N`, `-rc.N`).

```bash
docker pull ghcr.io/opendataensemble/synkronus:latest-pre-release
```

### Pull Specific Version

```bash
docker pull ghcr.io/opendataensemble/synkronus:v1.0.0
```

### Pull Development Build

Tracks the tip of the `dev` branch (rebuilt on every push to `dev`).

```bash
docker pull ghcr.io/opendataensemble/synkronus:dev
```

### Pull Main Branch Build

Tracks the tip of the `main` branch between releases.

```bash
docker pull ghcr.io/opendataensemble/synkronus:main
```

### Pull Feature Branch Build

```bash
docker pull ghcr.io/opendataensemble/synkronus:feature-xyz
```

## Release Process

Versioned images are produced by publishing a **GitHub Release** (the workflow listens for `release: [published]`).

1. Go to **Releases** → **Draft a new release**
2. Create a new tag following semver, prefixed with `v`:
   - Stable release: `v1.0.0`
   - Pre-release: `v1.0.0-rc.1`, `v1.0.1-alpha.7`, etc.
3. Select the target commit (typically tip of `main` for stable, tip of `dev` for pre-release)
4. Tick **Set as a pre-release** for alpha/beta/rc tags
5. Click **Publish release**

This will create:

| Release kind | Tags produced |
|-------|--------------|
| Stable (`v1.0.0`) | `v1.0.0`, `v1.0`, `v1`, `latest` |
| Pre-release (`v1.0.0-rc.1`) | `v1.0.0-rc.1`, `latest-pre-release` |

> Note: `workflow_dispatch` is available for manual runs but intentionally **does not** create any pointer tags (only `sha-{short}`) — it is for debugging the build pipeline, not for publishing releases.

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

1. **Pin versions in production**: Use specific version tags (`v{X.Y.Z}`), not `latest`
2. **Staging/QA upcoming releases**: Use `latest-pre-release` to track the most recent prerelease (alpha/rc)
3. **Bleeding-edge integration**: Use `dev` for builds from the tip of the `dev` branch
4. **Monitor image sizes**: Keep images lean for faster deployments
5. **Use health checks**: Always configure health checks in deployments

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
pnpm run build:copy
```

This will:
1. Build the formplayer web app
2. Clean existing formplayer asset folders in Formulus and copy new assets to Android and iOS paths
3. Copy the same bundle to `desktop/public/formplayer_dist/` for ODE Desktop

The `copy-to-rn` step run inside `build:copy` handles cleaning targets before copy, so no need to run `clean-rn-assets` separately for a normal refresh.

## ODE Desktop (Tauri)

**Workflow file**: `.github/workflows/ode-desktop.yml`

### Triggers

- **Pull requests** and **pushes** to `main` / `dev` when relevant paths change (see below), or **manual dispatch**.
- **`release: published`**: packages installers and attaches them to the GitHub Release (same pattern as [`Synkronus CLI`](workflows/synkronus-cli.yml); no path filter).

### Path filters

For pull requests / pushes (`main`, `dev`), the workflow runs when any of these change:

- `desktop/**`
- `formulus-formplayer/**`
- `packages/tokens/**`, `packages/components/**` (formplayer build inputs)
- `formulus/src/webview/FormulusInterfaceDefinition.ts` (formplayer `sync-interface` source)
- `.github/workflows/ode-desktop.yml`

### What it runs

**Job `desktop` (not on release)**

From `desktop/`: `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm typecheck`, `pnpm codegen:synk-client`, then **fails** if `desktop/src/generated` drifts from the regenerated OpenAPI client. From `desktop/src-tauri/`: `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`.

**Job `desktop-formplayer-dist`** (bundling and release flows)

Ubuntu job: installs and builds `@ode/tokens`, runs `pnpm install --frozen-lockfile` / `pnpm run build` in `formulus-formplayer`, stages `build/` → `desktop/public/formplayer_dist/`, uploads artifact `desktop-formplayer-dist` (short retention for CI).

**Jobs `build-desktop-bundles` (CI) and `release-desktop-bundles` (release)**

Matrix build (mirrors CLI OS/arch coverage): **linux** amd64 + arm64, **windows** amd64 + arm64, **darwin** amd64 (`macos-15-intel`) + arm64 (`macos-latest`). Each runner installs Node + pnpm, restores formplayer artifact, installs Linux WebKitGTK packages where needed, runs `pnpm exec tauri build --target …` with a merged config so `beforeBuildCommand` runs **`pnpm build` only** (frontend + Vite output; embedded formplayer is already present). Builds use `Swatinem/rust-cache` scoped per platform.

**CI artifacts**

Each matrix cell uploads installers under artifact name `ode-desktop-<platform>` (files renamed with prefix `ode-desktop-<platform>-<original-name>`).

**Release assets**

On `release`, `softprops/action-gh-release` attaches those installers for each platform to the published release alongside other assets (CLI, APK, SBOMs, etc.).

### Formplayer embed

Production bundles must include embedded formplayer: locally, `pnpm tauri build` uses `pnpm build:tauri` (`beforeBuildCommand` in `tauri.conf.json`). In CI/Rust release jobs, formplayer is built once on Ubuntu and copied into `desktop/public/formplayer_dist/` before each OS build. Copied assets are gitignored locally (see `desktop/README.md`).

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
