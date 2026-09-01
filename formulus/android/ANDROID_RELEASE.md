# Android release: Google Play and F-Droid

Formulus ships from one FOSS codebase. Play Store, GitHub sideloads, and F-Droid use the same dependency patches and build steps; packaging and version-code handling differ by channel.

## Shared release prep

1. Set `versionCode` in `app/build.gradle` to the next four-code block (`40`, `44`, `48`, …), and set both iOS `CURRENT_PROJECT_VERSION` values to the same number. `pnpm run sync:version` updates the Android `versionName` from `package.json`; it does not choose a build number.
2. From `formulus/`:
   ```sh
   pnpm install --frozen-lockfile
   pnpm run vendor:notifee
   pnpm run patch:android-foss
   pnpm run generate
   ```
3. Tag the release commit on the upstream repo, e.g. `v1.0.2` (F-Droid update checks use stable tags matching `v[\d.]+$`).
4. For a release that touches Android packaging, verify both outputs locally or in CI:
   - ARM-universal (`armeabi-v7a` + `arm64-v8a`) release APK and AAB for GitHub/Play
   - single-ABI APK path via `-PabiFilters=<abi>` for all four F-Droid ABIs

## Google Play

- **Artifact:** Android App Bundle (AAB) — `./gradlew bundleRelease` in `formulus/android/`.
- **ABIs:** `armeabi-v7a` and `arm64-v8a`, covering 32-bit and 64-bit ARM physical devices. x86/x86_64 are omitted from Play distribution.
- **CI:** GitHub Actions builds `bundleRelease` on `main`, `dev`, and GitHub Releases; uploads the AAB artifact and attaches it to releases.
- **versionCode:** Uses `defaultConfig.versionCode` in the AAB (single code per release).
- **Signing:** See [SIGNING_CONFIG.md](./SIGNING_CONFIG.md). CI uses repository secrets; local builds use `android/local.properties`.

## GitHub Releases / direct sideloads

- **Artifact:** One signed **ARM-universal APK** containing `armeabi-v7a` and `arm64-v8a` for manual installs and updaters such as Obtainium.
- **Gradle:** `assembleRelease` emits the ARM-universal APK for normal/release builds; x86/x86_64 are omitted to avoid carrying emulator-focused native libraries in direct downloads.
- **Why:** A single sideload artifact avoids wrong-ABI selection and cross-ABI `versionCode` downgrade/update failures.
- **versionCode:** Uses `defaultConfig.versionCode` unchanged.

## F-Droid

- **Artifact:** One APK per ABI, built from source by F-Droid. F-Droid retains `armeabi-v7a`, `arm64-v8a`, `x86`, and `x86_64` even though normal GitHub/Play builds use only ARM.
- **Metadata:** `fdroiddata/metadata/org.opendataensemble.formulus.yml` — four builds with `abiFilters`. `VercodeOperation` derives their codes as source `versionCode + 0`, `+1`, `+2`, and `+3`.
- **Gradle:** F-Droid passes `-PabiFilters=<abi>` and replaces the source `versionCode` with the derived code for each single-ABI build. This path keeps ABI-specific outputs only for F-Droid.
- **Init steps:** Same as shared prep above (`vendor:notifee`, `patch:android-foss`, `generate`).

After tagging, update the metadata commit SHA and version fields, then open/update the fdroiddata merge request.

## Version codes

| Channel | versionCode when the upstream base is `40` |
|---------|--------------------------------------------|
| Play AAB | `40` |
| GitHub universal APK | `40` |
| iOS build number (`CURRENT_PROJECT_VERSION`) | `40` |
| F-Droid `armeabi-v7a` / `arm64-v8a` / `x86` / `x86_64` | `40` / `41` / `42` / `43` |

### Four-code block policy

Use upstream base codes `40`, `44`, `48`, `52`, and so on. Each distinct APK/AAB shipped on a GitHub Release or uploaded to Play advances to the next block; ordinary branch CI artifacts do not consume a block. F-Droid can then safely consume the release base and the following three codes for a stable release.

- After base `40` (F-Droid block `40`–`43`), the next distinct APK/AAB uses base `44`.
- A stable release may retain its pre-release base only when it promotes the exact same app build rather than uploading a newly built Play artifact.
- Before releasing, verify that the chosen base is greater than every code already uploaded to Google Play and greater than the previous F-Droid block. If an external channel is unexpectedly ahead, choose the next multiple of four above its highest code.
- Keep both iOS `CURRENT_PROJECT_VERSION` values equal to the Android base. iOS build numbers need not be consecutive, so advancing by four is valid.
- Do **not** apply per-ABI `versionCodeOverride` to the normal GitHub universal build.
- Run `pnpm run validate:native-versions`; CI runs the same check and rejects a base that is not divisible by four or Android/iOS version drift.

### Migration from the old split APKs

The `1.3.0` F-Droid builds used codes `35`–`38`, while old `1.3.1` GitHub split APKs could use codes `36`–`39`. Base `40` is therefore the first code that upgrades every old GitHub split and starts a non-overlapping F-Droid block. The already-tagged `v1.3.1` source remains unsuitable for a new F-Droid build at base `36`; F-Droid should resume from the next stable tag containing this corrected base.
