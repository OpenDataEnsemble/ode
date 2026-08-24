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
| `scripts/generateInjectionScript.ts` | Generates injection / loader script from the interface definition.                                                                                                                                                                                                                                         |
| `src/screens/`, `src/navigation/`    | App screens and routing.                                                                                                                                                                                                                                                                                   |
| Android / iOS                        | Native projects; **formplayer** static assets: `android/app/src/main/assets/formplayer_dist/`, `ios/formplayer_dist/` (see formplayer AGENTS for `build:copy`).                                                                                                                                            |

---

## Custom apps and formplayer

- **Custom apps** are HTML/JS/CSS bundles loaded from Synkronus; they receive the **Formulus** injected API (see interface definition). Authors do not need this monorepo — public docs and [custom_app](https://github.com/OpenDataEnsemble/custom_app) describe usage.
- **Formplayer** is a sibling package; after changing `FormulusInterfaceDefinition.ts`, run **`pnpm run sync-interface`** (or build) in **formulus-formplayer** so its copy stays aligned.

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

| Package | Pinned to | Why | When to relax |
| ------- | --------- | --- | ------------- |
| `axios` | `^1.16.1` (direct dep) | OpenAPI-generated Synkronus client imports it; under pnpm it was only transitive via `@openapitools/openapi-generator-cli`, so release Metro bundling (`createBundleReleaseJsAndAssets`) failed while PR `assembleDebug` could pass. | Keep as direct dep while using the `typescript-axios` generator. |
| `react-native-screens` | `4.25.2` (no `^`) | `4.26+` needs RN **0.84+** and uses `React.ComponentRef` in Fabric commands; codegen **0.83** only accepts `React.ElementRef`, so Android fails at `:react-native-screens:generateCodegenSchemaFromJavaScript`. | After upgrading RN to **≥ 0.84** (ideally **0.87**): restore a caret range (e.g. `^4.27.0`) and confirm Android codegen + screens still build. |
| `@nozbe/sqlite` / `@nozbe/simdjson` | `3.46.0` / `3.9.4` (direct deps) | WatermelonDB JSI `CMakeLists.txt` resolves `node_modules/@nozbe/{sqlite,simdjson}` from a relative path; pnpm does not hoist those transitive packages there, so CMake gets `No SOURCES given to target: watermelondb-jsi`. | Keep as direct deps aligned with `@nozbe/watermelondb`'s versions. |
| `@nozbe/watermelondb` | patched (`patches/@nozbe__watermelondb@0.28.0.patch`) | Same CMake file uses `../../../../../../../react-native`. Under pnpm the package is symlinked into `.pnpm/…`; on Linux `..` follows the real path into the package store (sqlite/simdjson present, **react-native not**), so `#include <jsi/jsi.h>` fails. Patch walks up until `jsi.h` is found. | Drop the patch when upstream CMake is pnpm-safe, or after switching away from WatermelonDB JSI. |
| `@react-native/gradle-plugin` | `0.83.1` (direct devDependency) | pnpm does not hoist the transitive copy; `android/settings.gradle` expects `node_modules/@react-native/gradle-plugin`. | Keep as a direct dep aligned with `react-native`; bump the version in lockstep with RN. |
| `@react-native/codegen` | `0.83.1` (direct devDependency) | Same hoist issue for the default `codegenDir` path. | Same — bump with RN. |

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
