# Formulus Formplayer — AI & Developer Guide

This file gives AI assistants and developers enough context to work effectively in this repo. For user-facing docs, see [README.md](./README.md).

## What this project is

- **Formulus Formplayer** is a web app that **renders and submits forms** using the [JSON Forms](https://jsonforms.io/) spec. It is **not** a standalone site: it runs inside a **WebView** in the **Formulus** React Native app.
- The RN app (sibling repo `../formulus`) loads the formplayer bundle from **file://** (e.g. `file:///android_asset/formplayer_dist/` on Android). The formplayer is the “form UI”; the RN app handles sync (Synkronus), storage, and native capabilities (camera, GPS, etc.).
- The formplayer exposes a **JavaScript API** (`window.formulus.formplayer`) that the host and custom apps use to **add** or **edit** observations. The formplayer is **initialized and configured by the Formulus app** (renderers, cells, formSpecs, etc.); custom apps only call the API.

## Monorepo and dependencies

- **Parent repo**: `formulus-formplayer` lives under a monorepo (e.g. `ODE`). Sibling projects include:
  - **`formulus`** — React Native app that hosts the formplayer WebView and provides the native bridge.
  - **`packages/tokens`** — `@ode/tokens` (design tokens; Style Dictionary).
  - **`packages/components`** — `@ode/components` (shared UI; may use `@ode/tokens`).
- **Install order** (from repo root):  
  `cd packages/tokens && npm install` then `cd formulus-formplayer && npm install && npm start`.  
  Installing only in formulus-formplayer can break the tokens `prepare` script.

## Build and deploy (RN)

- **Scripts** (from `formulus-formplayer/`):
  - `npm run build` — `sync-interface` → `tsc` → `vite build` (output: `build/`).
  - `npm run build:rn` — build then **copy** `build/` into the Formulus app:
    - Android: `../formulus/android/app/src/main/assets/formplayer_dist/`
    - iOS: `../formulus/ios/formplayer_dist/`
- **Interface sync**: `scripts/sync-interface.js` copies **one** shared TypeScript file from the Formulus app into the formplayer:  
  `formulus/src/webview/FormulusInterfaceDefinition.ts` → `formulus-formplayer/src/types/FormulusInterfaceDefinition.ts`.  
  So the **single source of truth** for the bridge contract is in **formulus**; formplayer consumes a copy. Run `npm run sync-interface` (or `npm run build`) when that file changes.
- **Vite**: `vite.config.ts` is tuned for WebView:
  - `base: './'` so assets resolve under file://.
  - **Single bundle** (`inlineDynamicImports: true`) so the WebView doesn’t fail loading multiple chunks.
  - **No `crossorigin`** on script/link so file:// loading works.
  - Source maps enabled for debugging.

## Source layout (high level)

| Area | Purpose |
|------|--------|
| `src/App.tsx` | Main app: JsonForms setup, renderer/cell registration, theme, init from `FormInitData`. |
| `src/index.tsx` | Entry: mounts React app; exposes `React` and `MaterialUI` on `window` for custom question type renderers. |
| `src/renderers/*` | JSON Forms **renderers** (e.g. signature, photo, file, GPS, swipe layout, finalize). Each has a **tester** (when to use) and a **component**. |
| `src/theme/` | MUI theme from `@ode/tokens` via `tokens-adapter.ts`; material wrappers for consistent look. |
| `src/services/` | `FormulusInterface.ts` (bridge client), `DraftService`, `ExtensionsLoader`, custom question type/validator loaders and registries. |
| `src/types/` | `FormulusInterfaceDefinition.ts` (synced from formulus), `CustomQuestionTypeContract.ts`, etc. |
| `src/components/` | Shared UI (e.g. `QuestionShell`, `FormLayout`, `DraftSelector`). |
| `src/builtinExtensions.ts` | Built-in extension functions (e.g. `getDynamicChoiceList`) used in forms. |
| `src/mocks/` | `webview-mock.ts` and `DevTestbed` for local dev without RN. |
| `scripts/` | `sync-interface.js`, `copy-to-rn.js`, `clean-rn-assets.js`. |

## Key technical constraints

1. **WebView environment**: No real `window.ReactNativeWebView` in browser dev; use the mock. Assume **file://** and **single JS bundle** when changing Vite/build.
2. **Bridge**: Communication with RN is via **postMessage** and the contract in `FormulusInterfaceDefinition.ts`. The formplayer uses `FormulusClient` (singleton) in `FormulusInterface.ts` to call native (camera, signature, submit, etc.).
3. **Custom question types**: Loaded from a **manifest** (source strings) from the RN app, evaluated in a sandbox with `React` and `MaterialUI` on `window`. They use **format** in the schema (e.g. `"format": "signature"`), not only `type`. Contract: `src/types/CustomQuestionTypeContract.ts`.
4. **Design tokens**: Use `@ode/tokens` via `src/theme/tokens-adapter.ts` and the theme in `src/theme/theme.ts`; avoid hardcoding colors/spacing that exist in tokens.

## Adding or changing behavior

- **New question type (built-in)**  
  Add a renderer in `src/renderers/` with a **tester** (e.g. `formatIs('myFormat')`) and component; register it in `App.tsx` (renderers array). If it needs a new AJV format, register it where other formats are registered in `App.tsx`.
- **New question type (custom / from Synkronus)**  
  Custom types are loaded by `CustomQuestionTypeLoader` from the manifest; they must comply with `CustomQuestionTypeContract.ts` and export a default component. No change in formplayer code needed for new custom types that follow the contract.
- **New native capability (e.g. new “requestX” from RN)**  
  1) Extend the contract in **formulus** (`FormulusInterfaceDefinition.ts`).  
  2) Run `npm run sync-interface` in formulus-formplayer.  
  3) Implement the client side in `FormulusInterface.ts` and use it in the relevant renderer or service.
- **Build / bundle issues**  
  Keep **one** main bundle; avoid dynamic imports that create extra chunks unless you’ve verified loading under file:// in the RN WebView. Keep `base: './'` and the no-crossorigin plugin.

## Development

- `npm start` — Vite dev server; uses `webview-mock` and (optionally) `DevTestbed` so you can test without the RN app.
- Tests: `npm test` (Vitest). Lint/format: `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`.

## Commit and pull request workflow

- **Commit messages** must follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat(scope): add X`, `fix(scope): resolve Y`).
- **Before opening a PR**, run `npm run format` so Prettier has formatted the files.
- **PRs** should use the following template:

---

# Pull Request Title

<!-- PR Title must follow Conventional Commits format: <type>(<scope>): <subject> -->

## Description

<!-- Provide a clear description of what changed and why -->

## Type of Change

- [ ] Bug Fix
- [ ] New Feature / Enhancement
- [ ] Refactor / Code Cleanup
- [ ] Documentation Update
- [ ] Maintenance / Chore
- [ ] Other (please specify):

---

## Component(s) Affected

- [ ] **formulus** (React Native mobile app)
- [ ] **formulus-formplayer** (React web app)
- [ ] **synkronus** (Go backend server)
- [ ] **synkronus-cli** (Command-line utility)
- [ ] **Documentation**
- [ ] **DevOps / CI/CD**
- [ ] **Other:** <!-- Please specify -->

---

## Related Issue(s)

<!-- Use keywords: Closes #123, Fixes #456, Resolves #789 -->

**Closes/Fixes/Resolves:** <!-- e.g., Closes #123 -->

---

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manually tested
- [ ] Tested on multiple platforms (if applicable)
- [ ] Not applicable

---

## Breaking Changes

- [ ] This PR introduces breaking changes
- [ ] This PR does NOT introduce breaking changes

**If breaking changes, please describe migration steps:**

---

## Documentation Updates

- [ ] Documentation has been updated
- [ ] Documentation update is not required

---

## Checklist

- [ ] Code follows project style guidelines
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] PR title follows Conventional Commits format

---

**Thank you for contributing to Open Data Ensemble (ODE)!**

---

## Quick reference

- **Form init**: RN sends `FormInitData` (e.g. via `onFormInit`); see `FormulusInterfaceDefinition.ts`.
- **Submit**: Use `FormulusClient.submitObservationWithContext(formInitData, finalData)` so create vs update is correct.
- **Renderers**: Use `QuestionShell` for consistent layout and use the theme/tokens (e.g. `tokens` from `theme/tokens-adapter`) for spacing and colors where applicable.

Using this file, an AI or new developer can reason about the formplayer’s role in the monorepo, where to change code for new features, and what not to break (single bundle, file://, bridge contract, tokens).
