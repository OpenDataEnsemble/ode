# Android release: Google Play and F-Droid

Formulus ships from one FOSS codebase. Play Store, GitHub sideloads, and F-Droid use the same dependency patches and build steps; packaging and version-code handling differ by channel.

## Shared release prep

1. Bump `versionName` / `versionCode` in `app/build.gradle` (or run `pnpm run sync:version` from `formulus/`).
2. From `formulus/`:
   ```sh
   pnpm install --frozen-lockfile
   pnpm run vendor:notifee
   pnpm run patch:android-foss
   pnpm run generate
   ```
3. Tag the release commit on the upstream repo, e.g. `v1.0.2` (F-Droid update checks use stable tags matching `v[\d.]+$`).
4. For a release that touches Android packaging, verify both outputs locally or in CI:
   - universal release APK for GitHub/direct installs
   - single-ABI APK path via `-PabiFilters=<abi>` for F-Droid

## Google Play

- **Artifact:** Android App Bundle (AAB) — `./gradlew bundleRelease` in `formulus/android/`.
- **CI:** GitHub Actions builds `bundleRelease` on `main`, `dev`, and GitHub Releases; uploads the AAB artifact and attaches it to releases.
- **versionCode:** Uses `defaultConfig.versionCode` in the AAB (single code per release).
- **Signing:** See [SIGNING_CONFIG.md](./SIGNING_CONFIG.md). CI uses repository secrets; local builds use `android/local.properties`.

## GitHub Releases / direct sideloads

- **Artifact:** One signed **universal APK** for manual installs and updaters such as Obtainium.
- **Gradle:** `assembleRelease` should emit a universal APK for normal/release builds.
- **Why:** A single sideload artifact avoids wrong-ABI selection and cross-ABI `versionCode` downgrade/update failures.
- **versionCode:** Uses `defaultConfig.versionCode` unchanged.

## F-Droid

- **Artifact:** One APK per ABI, built from source by F-Droid.
- **Metadata:** `fdroiddata/metadata/org.opendataensemble.formulus.yml` — four builds with `abiFilters` and explicit `versionCode` per ABI.
- **Gradle:** F-Droid passes `-PabiFilters=<abi>` to force a single ABI build from the same upstream tag/source. This path keeps ABI-specific outputs only for F-Droid.
- **Init steps:** Same as shared prep above (`vendor:notifee`, `patch:android-foss`, `generate`).

After tagging, update the metadata commit SHA and version fields, then open/update the fdroiddata merge request.

## Version codes

| Channel | versionCode |
|---------|-------------|
| Play AAB | `defaultConfig.versionCode` |
| GitHub universal APK | `defaultConfig.versionCode` |
| F-Droid per-ABI build | Set in metadata (for example `3601`–`3604` when upstream `defaultConfig.versionCode` is `36`) |

Rules:

- Upstream Gradle keeps a single monotonic `defaultConfig.versionCode` for Play and GitHub sideloads.
- Do **not** apply per-ABI `versionCodeOverride` to the normal GitHub release build.
- F-Droid-specific per-ABI version codes live in F-Droid metadata/build configuration, not in the default upstream release path.
