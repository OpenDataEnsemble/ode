# Android release: Google Play and F-Droid

Formulus ships from one FOSS codebase. Play Store and F-Droid use the same dependency patches and build steps; only packaging and version-code handling differ.

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

## Google Play

- **Artifact:** Android App Bundle (AAB) — `./gradlew bundleRelease` in `formulus/android/`.
- **CI:** GitHub Actions builds `bundleRelease` on `main`, `dev`, and GitHub Releases; uploads the AAB artifact and attaches it to releases.
- **versionCode:** Uses `defaultConfig.versionCode` in the AAB (single code per release).
- **Signing:** See [SIGNING_CONFIG.md](./SIGNING_CONFIG.md). CI uses repository secrets; local builds use `android/local.properties`.

Optional split APKs for sideloading or GitHub Release assets:

```sh
./gradlew assembleRelease
```

Split APKs use per-ABI version codes: `baseVersionCode + abiOffset` (2–5 when base is 2).

## F-Droid

- **Artifact:** One APK per ABI, built from source by F-Droid.
- **Metadata:** `fdroiddata/metadata/org.opendataensemble.formulus.yml` — four builds with `abiFilters` and explicit `versionCode` per ABI.
- **Gradle:** Pass `-PabiFilters=<abi>`; F-Droid prebuild strips custom APK naming and sets `versionCode = $$VERCODE$$`.
- **Init steps:** Same as shared prep above (`vendor:notifee`, `patch:android-foss`, `generate`).

After tagging, update the metadata commit SHA and version fields, then open/update the fdroiddata merge request.

## Version codes

| Channel | versionCode |
|---------|-------------|
| Play AAB | `defaultConfig.versionCode` |
| Play / local split APKs | base + ABI offset (armeabi-v7a +0, arm64-v8a +1, x86 +2, x86_64 +3) |
| F-Droid per-ABI build | Set in metadata prebuild (`$$VERCODE$$`) |

When bumping a release, increase `defaultConfig.versionCode` and update F-Droid build entries (and `CurrentVersionCode`) to match the highest per-ABI code.
