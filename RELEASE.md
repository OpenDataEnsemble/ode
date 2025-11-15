# Release Process

This document describes how to create **pre-releases** and **full releases** for the ODE monorepo, aligning all artefacts:

- Synkronus Docker images
- Synkronus CLI binaries
- Formulus Android APK

All releases use **semantic versioning**.

---

## Quick Summary

We use **SemVer** with a `v` prefix for git tags:

- Stable: `v1.2.0`
- Pre-release: `v1.2.0-rc.1`, `v1.2.0-alpha.2`, etc.

Avoid tags like `v.1.2.0` (extra dot after `v`), which are not semver-style and may confuse tooling.

### Pre‑release (e.g. `v1.2.0-rc.1`)

1. Ensure the desired code is merged to `main`.
2. Create and push the tag from the repo root:
   ```bash
   git checkout main
   git pull
   git tag v1.2.0-rc.1
   git push origin v1.2.0-rc.1
   ```
3. In GitHub, create a **new release**:
   - Tag: `v1.2.0-rc.1`
   - Mark as **pre-release**
   - Publish
4. GitHub Actions will:
   - Build and publish **Synkronus Docker** image(s) for that tag
   - Build **Synkronus CLI** binaries and attach them to the release
   - Build **Formulus Android** signed APK and attach it to the release
5. Use this GitHub pre-release for staging/QA and early adopters.

### Full Release (e.g. `v1.2.0`)

1. Ensure `main` has the final code (including all fixes from pre-releases).
2. Create and push the final tag:
   ```bash
   git checkout main
   git pull
   git tag v1.2.0
   git push origin v1.2.0
   ```
3. In GitHub, create a **new release**:
   - Tag: `v1.2.0`
   - Do **not** mark as pre-release
   - Add release notes
   - Publish
4. GitHub Actions will:
   - Build and publish **Synkronus Docker** images tagged `v1.2.0` (and additional tags like `v1.2`, `latest` as configured)
   - Build **Synkronus CLI** binaries and attach them to the release
   - Build **Formulus Android** signed APK and attach it to the release
5. Use this GitHub release as the **single source of truth** for production.

---

## Detailed Release Model

The ODE monorepo contains multiple artefacts that must stay in sync:

- **Synkronus** backend Docker image
- **Synkronus CLI** (multi-platform binaries)
- **Formulus** React Native Android app (signed APK)

All share the same **semantic version tag**:

- Stable releases: `vX.Y.Z` (e.g. `v1.2.0`)
- Pre-releases: `vX.Y.Z-rc.1`, `vX.Y.Z-beta.1`, etc.

These tags are used consistently by the GitHub Actions workflows to:

- Build and tag Docker images in GHCR
- Attach CLI binaries to GitHub Releases
- Attach signed Android APKs to GitHub Releases


## Pre‑release Flow

Use a pre-release when you want a candidate build that includes **all artefacts**, but is not yet considered final.

### 1. Prepare `main`

- Ensure all features and fixes intended for the pre-release are merged to `main`.
- Run tests locally or via CI as needed.

### 2. Create and push a pre‑release tag

From the repo root (`ODE`):

```bash
git checkout main
git pull
git tag v1.2.0-rc.1
git push origin v1.2.0-rc.1
```

Use semantic versioning with a pre-release suffix (e.g. `v1.2.0-rc.1`, `v1.2.0-beta.1`).

### 3. Create a GitHub pre‑release

1. Go to **GitHub → Releases → Draft a new release**
2. Select the tag (e.g. `v1.2.0-rc.1`)
3. Title: `v1.2.0-rc.1`
4. Check **“This is a pre-release”**
5. Add any notes and click **Publish release**

### 4. What CI does on a pre‑release

When the release is published, the following workflows are triggered by the `release: published` event:

- **Synkronus Docker (`synkronus-docker.yml`)**
  - Builds Docker images for the Synkronus backend
  - Tags images using the release tag (e.g. `v1.2.0-rc.1`)
  - Publishes them to **GitHub Container Registry (GHCR)** under `ghcr.io/opendataensemble/synkronus`

- **Synkronus CLI (`synkronus-cli.yml`)**
  - Builds CLI binaries for:
    - Linux, Windows, macOS
    - amd64 and arm64
  - Attaches all binaries to the GitHub Release as assets

- **Formulus Android (`formulus-android.yml`)**
  - Uses the configured keystore (via GitHub secrets) to build a signed **release** APK
  - Attaches the APK to the GitHub Release as an asset

### 5. Usage of a pre‑release

- The pre-release is ideal for staging environments, QA, and early adopters.
- All artefacts for that version are discoverable on a single GitHub Release page.
- Docker users can pull using the semver pre-release tag (e.g. `v1.2.0-rc.1`).


## Full Release Flow

Use a full release when you are ready to make a **stable** version available for general use.

### 1. Prepare `main`

- Ensure all required changes (including any fixes discovered during pre-release testing) are merged into `main`.
- Confirm that CI is green on `main`.

### 2. Create and push a final tag

From the repo root:

```bash
git checkout main
git pull
git tag v1.2.0
git push origin v1.2.0
```

Use a clean semver tag without pre-release suffix (e.g. `v1.2.0`).

### 3. Create a GitHub Release

1. Go to **GitHub → Releases → Draft a new release**
2. Select tag `v1.2.0`
3. Title: `v1.2.0`
4. Do **not** mark as pre-release
5. Add detailed release notes (changes, breaking changes, upgrade notes)
6. Publish

### 4. What CI does on a full release

Triggered by the `release: published` event:

- **Synkronus Docker (`synkronus-docker.yml`)**
  - Builds Docker images for Synkronus
  - Tags may include:
    - `v1.2.0`
    - `v1.2`
    - `latest` (depending on current configuration)
  - Publishes images to GHCR

- **Synkronus CLI (`synkronus-cli.yml`)**
  - Builds all CLI binaries (Linux/Windows/macOS, amd64/arm64)
  - Attaches them to the `v1.2.0` GitHub Release

- **Formulus Android (`formulus-android.yml`)**
  - Builds a **signed release APK**
  - Attaches it to the `v1.2.0` GitHub Release

### 5. Usage of a full release

- This GitHub Release is the **single source of truth** for:
  - Docker image versions
  - CLI downloads
  - Android APK distribution
- Production deployments should generally use the stable semver tag (`v1.2.0`) or the corresponding major/minor tags (`v1.2`), not `latest`, unless documented otherwise.


## Main and Develop Branch Behavior (without tags)

Even without creating releases, your workflows provide helpful CI builds:

- **Push to `develop`**
  - Synkronus Docker builds images tagged as `develop` (and `develop-{sha}`) for staging
  - CLI and Android workflows run CI builds (validation), but do not create release assets

- **Push to `main`**
  - Synkronus Docker builds images tagged as `latest` and `main-{sha}`
  - CLI and Android workflows run CI builds and upload artifacts for inspection
  - No GitHub Release is created unless you also create a tag and publish a release

This separation lets you:

- Use `develop` for integration and staging
- Use `main` for production candidates
- Use **tags + releases** (`vX.Y.Z-rc.N`, `vX.Y.Z`) to capture official versions with all artefacts aligned.
