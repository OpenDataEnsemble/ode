# Formulus — AI & developer guide

**When to use this doc:** You are changing the **React Native** mobile app: navigation, screens, WebViews, native modules, or the JavaScript bridge injected into custom apps and the formplayer.

**See also:** [../AGENTS.md](../AGENTS.md) (monorepo overview), [../formulus-formplayer/AGENTS.md](../formulus-formplayer/AGENTS.md) (form UI bundle and WebView constraints).

**User-facing docs:** [Formulus](https://opendataensemble.org/docs/reference/formulus) on [opendataensemble.org](https://opendataensemble.org/).

**Release version bumps:** see [../AGENTS.md#release-version-bump-checklist](../AGENTS.md#release-version-bump-checklist) (Formulus `package.json`, Android `versionCode`, iOS, `pnpm run sync:version`).

---

## What this package is

- **Formulus** is the **offline-first** mobile client for ODE: it renders **JSON Forms** via the embedded **formplayer** WebView, runs **custom application** bundles in separate WebViews, and synchronizes with **Synkronus**.
- It is **not** the admin console (that is **Portal**) and not the sync server (that is **Synkronus**).

---

## Layout (where to look)

| Area                                 | Purpose                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/webview/`                       | **Bridge contract** — [`FormulusInterfaceDefinition.ts`](src/webview/FormulusInterfaceDefinition.ts) (source of truth for `window.formulus` / injected API). [`FormulusMessageHandlers.ts`](src/webview/FormulusMessageHandlers.ts), [`FormulusWebViewHandler.ts`](src/webview/FormulusWebViewHandler.ts). |
| `src/sync/`                          | Adaptive pull/push unit sizes, retries, chunking. Knobs: [`networkProfile.ts`](src/sync/networkProfile.ts).                                                                                                                                                                                                |
| `scripts/generateInjectionScript.ts` | Generates injection / loader script from the interface definition.                                                                                                                                                                                                                                         |
| `src/screens/`, `src/navigation/`    | App screens and routing.                                                                                                                                                                                                                                                                                   |
| Android / iOS                        | Native projects; **formplayer** static assets: `android/app/src/main/assets/formplayer_dist/`, `ios/formplayer_dist/` (see formplayer AGENTS for `build:copy`).                                                                                                                                            |

---

## Custom apps and formplayer

- **Custom apps** are HTML/JS/CSS bundles loaded from Synkronus; they receive the **Formulus** injected API (see interface definition). Authors do not need this monorepo — public docs and [custom_app](https://github.com/OpenDataEnsemble/custom_app) describe usage.
- **Formplayer** is a sibling package; after changing `FormulusInterfaceDefinition.ts`, run **`pnpm run sync-interface`** (or build) in **formulus-formplayer** so its copy stays aligned.

## Adaptive sync (low connectivity)

There is **no enumerator-facing network preset**. Every device starts small and AIMDs toward the API max on a good link. Knobs live in [`src/sync/networkProfile.ts`](src/sync/networkProfile.ts); AIMD in [`src/sync/adaptivePageSize.ts`](src/sync/adaptivePageSize.ts).

| Unit       | Floor | Start (fresh device) | Ceiling                             |
| ---------- | ----- | -------------------- | ----------------------------------- |
| Pull page  | 1     | 32                   | 500 (OpenAPI max)                   |
| Push batch | 1     | 4                    | 100 (uplink is worse than downlink) |

- **Grow** if the last HTTP unit finished in **&lt; 8s**: additive `max(25, floor(current/4))`.
- **Shrink** if it took **≥ 15s**: halve.
- After retries, a failed **pull** halves the page and retries the same cursor; a failed **push** splits the batch and requeues (down to 1).
- Prefetch the next pull page only once `pullPageSize >= 250`.
- Attachment downloads stay **serial** (concurrency 1). Observation JSON can succeed while photos remain pending.
- Axios JSON timeout is **10 minutes**. Health probes stay 10s.
- Sizes persist in AsyncStorage (`@ode/adaptivePullPageSize`, `@ode/adaptivePushBatchSize`).

The floor of 1 is for truly poor radio. The minimum grow step is still +25, so a device that just crawled at size 1 jumps back to 26 on the next fast unit.

Server-side timeouts that used to kill long transfers live in Synkronus (`ReadHeaderTimeout` 25s; no global `ReadTimeout`/`WriteTimeout`; nginx `proxy_*_timeout` 600s). See [synkronus/AGENTS.md](../synkronus/AGENTS.md).

---

## UI language (i18n)

- **Settings → Language** (`SettingsScreen`): Auto / `en` / `pt` / `fr`; stored in AsyncStorage (`@ode/uiLocale`) via [`LocaleSettingsService`](src/services/LocaleSettingsService.ts).
- Resolution: [`src/lib/locale.ts`](src/lib/locale.ts) — preference → device → `app.config.json` `defaultLocale` → `en`.
- Shell strings: `react-i18next` + [`src/locales/`](src/locales/).
- Formplayer receives resolved locale as `params.locale` from [`FormplayerModal`](src/components/FormplayerModal.tsx).

---

## Changing the bridge

1. Edit [`FormulusInterfaceDefinition.ts`](src/webview/FormulusInterfaceDefinition.ts).
2. Implement **native** handling in the WebView message pipeline (`FormulusMessageHandlers.ts`, `FormplayerModal.tsx`, `App.tsx` stack for `openFormplayer`).
3. **Sync** the formplayer copy and update any consumers (see [formulus-formplayer/AGENTS.md](../formulus-formplayer/AGENTS.md)).

**Custom app APIs (contract highlights):** `openFormplayer` options include `subObservationMode`, `skipFinalize` (omit Finalize page; child still validates on Done), and `skipDraftSelection` (bypass draft picker on orchestrated root sessions). `persistObservation` writes observations without opening Formplayer. Nested sub-observation authoring: [Custom Extensions — nested sessions](https://opendataensemble.org/docs/guides/custom-extensions#nested-sessions-and-custom-validators). Regenerate `assets/webview/FormulusInjectionScript.js` after interface changes (`scripts/generateInjectionScript.ts`).

---

## Build and run

See [README.md](README.md): Metro, `pnpm run android` / `ios`, Android **Notifee** vendor step, iOS **Pods**. For CI and formatting, see root [README.md](../README.md) and [.github/CICD.md](../.github/CICD.md).

## Dependency pins (check on every React Native upgrade)

Exact versions in `package.json` that exist only to keep Android / codegen / Metro working with the **current** RN line. Revisit them when bumping `react-native`.

pnpm does not hoist transitive packages to the package root. Anything **imported from app code** (`src/`, generated API clients) or **referenced by native build scripts** (Gradle `settings.gradle`, CMake `node_modules/…` paths) must be a **direct** entry in `dependencies` (or `devDependencies` when dev-only).

| Package                             | Pinned to                                             | Why                                                                                                                                                                                                                                                                                               | When to relax                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `axios`                             | `^1.16.1` (direct dep)                                | OpenAPI-generated Synkronus client imports it; under pnpm it was only transitive via `@openapitools/openapi-generator-cli`, so release Metro bundling (`createBundleReleaseJsAndAssets`) failed while PR `assembleDebug` could pass.                                                              | Keep as direct dep while using the `typescript-axios` generator.                                                                               |
| `buffer`                            | `^6.0.3` (direct dep)                                 | `FRMLSHelpers.ts` imports `Buffer` from `buffer`; under pnpm it was not hoisted, so release Metro bundling failed the same way as `axios`.                                                                                                                                                        | Keep while app code imports the polyfill.                                                                                                      |
| `hermes-compiler`                   | `0.14.0` (direct dep, match RN)                       | RN 0.83 moved `hermesc` into this package; under pnpm Gradle still looks under `react-native/sdks/hermesc` and fails release bundling. Also set `react.hermesCommand` in `android/app/build.gradle`.                                                                                              | Revisit after RN ≥ 0.85 pnpm hermes fixes; bump in lockstep with `react-native`.                                                               |
| `react-native-screens`              | `4.25.2` (no `^`)                                     | `4.26+` needs RN **0.84+** and uses `React.ComponentRef` in Fabric commands; codegen **0.83** only accepts `React.ElementRef`, so Android fails at `:react-native-screens:generateCodegenSchemaFromJavaScript`.                                                                                   | After upgrading RN to **≥ 0.84** (ideally **0.87**): restore a caret range (e.g. `^4.27.0`) and confirm Android codegen + screens still build. |
| `@nozbe/sqlite` / `@nozbe/simdjson` | `3.46.0` / `3.9.4` (direct deps)                      | WatermelonDB JSI `CMakeLists.txt` resolves `node_modules/@nozbe/{sqlite,simdjson}` from a relative path; pnpm does not hoist those transitive packages there, so CMake gets `No SOURCES given to target: watermelondb-jsi`.                                                                       | Keep as direct deps aligned with `@nozbe/watermelondb`'s versions.                                                                             |
| `@nozbe/watermelondb`               | patched (`patches/@nozbe__watermelondb@0.28.0.patch`) | Same CMake file uses `../../../../../../../react-native`. Under pnpm the package is symlinked into `.pnpm/…`; on Linux `..` follows the real path into the package store (sqlite/simdjson present, **react-native not**), so `#include <jsi/jsi.h>` fails. Patch walks up until `jsi.h` is found. | Drop the patch when upstream CMake is pnpm-safe, or after switching away from WatermelonDB JSI.                                                |
| `react-native-fs`                   | patched (`patches/react-native-fs@2.20.0.patch`)      | Android download/IO failures call `promise.reject(null, …)`. RN’s Kotlin `PromiseImpl.reject` requires a non-null `code`, so a failed attachment download (or other RNFS error) becomes a process-killing NPE instead of a JS rejection. Patch rejects with `"EUNSPECIFIED"`.                     | Drop when upstream RNFS (or a maintained fork) passes a non-null reject code.                                                                  |
| `@react-native/gradle-plugin`       | `0.83.1` (direct devDependency)                       | pnpm does not hoist the transitive copy; `android/settings.gradle` expects `node_modules/@react-native/gradle-plugin`.                                                                                                                                                                            | Keep as a direct dep aligned with `react-native`; bump the version in lockstep with RN.                                                        |
| `@react-native/codegen`             | `0.83.1` (direct devDependency)                       | Same hoist issue for the default `codegenDir` path.                                                                                                                                                                                                                                               | Same — bump with RN.                                                                                                                           |

Screens compat table: [react-native-screens README](https://github.com/software-mansion/react-native-screens#support-for-fabric).

## Pre-flight before a PR

From **`formulus/`**:

```bash
pnpm run lint
pnpm run format
pnpm run format:check
pnpm run test --ci --watchAll=false
```

Lint allows warnings (`--max-warnings 9999`) but **errors** fail CI — e.g. unused imports (`@typescript-eslint/no-unused-vars`). If the PR touches formplayer too, run its pre-flight in [formulus-formplayer/AGENTS.md](../formulus-formplayer/AGENTS.md#pre-flight-before-a-pr).
