# ODE Desktop

**ODE Desktop** is the Open Data Ensemble **desktop application** (Tauri + React + Rust). It provides two modes:

| Mode                      | Purpose                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Data management**       | Pull, inspect, correct, and sync **observations**; import/export; conflicts and local workspace state.                                  |
| **Forms / app workbench** | Develop and test **app bundles**, embedded **formplayer**, and **custom apps** — aligned with Formulus and the shared WebView contract. |

The internal Rust crate may still be named `custodian`; user-facing strings use **ODE Desktop**.

## Who it is for

- **Field and data staff** managing observations and sync (Data management).
- **Form and app authors** testing bundles and custom apps against Synkronus before mobile deploy (Workbench).

Relationship to other ODE components: **Synkronus** (API), **Formulus** + **formplayer** (runtime parity), **Portal** and **CLI** (same public API — no privileged desktop channel). Long-form prose here is intended to be **copy-friendly** for [opendataensemble.org](https://opendataensemble.org/) documentation; keep user-facing sections free of repo-only trivia (put contributor notes under **Development**).

## Install

Official builds are produced with **`pnpm tauri build`** (artifacts vary by OS: `.msi`, `.dmg`, `.app`, AppImage, `.deb`, etc.). When releases are published, attach those bundles to **GitHub Releases** and link them from project docs.

**Prerequisites**

- **Windows**: WebView2 (usually present on current Windows 10/11).
- **Linux**: WebKitGTK and related packages as required by [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).
- **macOS**: Xcode command-line tools for development builds.

A placeholder **curl-style** installer script is at `scripts/install-ode-desktop.sh` (to be wired to real release asset URLs). For early testing, run from source (below).

## Quick start (development)

From the monorepo root:

```bash
cd desktop
pnpm install
pnpm dev
```

In another terminal:

```bash
cd desktop
pnpm tauri dev
```

## Scripts

| Script                              | Purpose                                                                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | Vite dev server (frontend).                                                                                                                                    |
| `pnpm build`                        | Typecheck + Vite production build.                                                                                                                             |
| `pnpm build:formplayer`             | Build `../formulus-formplayer` and copy output into `public/formplayer_dist/`.                                                                                 |
| `pnpm build:tauri`                  | Prepare Formplayer assets (`build:formplayer`) and then run the desktop frontend build.                                                                        |
| `pnpm tauri build`                  | Full desktop bundle; automatically runs `pnpm build:tauri` first, so the packaged app includes `formplayer_dist`.                                              |
| `pnpm lint` / `pnpm lint:fix`       | ESLint.                                                                                                                                                        |
| `pnpm format` / `pnpm format:check` | Prettier.                                                                                                                                                      |
| `pnpm test`                         | Vitest (unit / component tests).                                                                                                                               |
| `pnpm typecheck`                    | `tsc --noEmit`.                                                                                                                                                |
| `pnpm codegen:synk-client`          | Regenerate TypeScript client from Synkronus OpenAPI.                                                                                                           |
| `pnpm copy:formplayer`              | Copy `../formulus-formplayer/build/` → `public/formplayer_dist/`. Prefer from `formulus-formplayer/`: `npm run build:ode-desktop` (build + RN + desktop copy). |

### Rust (backend)

```bash
cd src-tauri
cargo test
cargo fmt
cargo clippy
```

## OpenAPI client

Configuration is in `openapi.client.config.json` (paths relative to `desktop/`):

- Default spec: `../synkronus/openapi/synkronus.yaml`
- Output: `src/generated/synkronus-client`

Override at generation time:

- `OPENAPI_SPEC_RELATIVE_PATH`
- `OPENAPI_OUTPUT_RELATIVE_PATH`

CI regenerates the client and **fails** if the repo does not match (`ode-desktop` workflow).

## Architecture pointers

- **Bridge contract**: [`formulus/src/webview/FormulusInterfaceDefinition.ts`](../formulus/src/webview/FormulusInterfaceDefinition.ts) — source of truth for `formulusAPI` / postMessage. After changes, run **`sync-interface`** in `formulus-formplayer` and mirror behavior in the desktop WebView host.
- **Form preview host** (Workbench → Form preview): `public/formulus-injection.js` + iframe shim; parent handles `postMessage` in **`src/lib/formPreviewBridge.ts`** (explicit matrix per `FormulusInjectionScript` request `type`; device APIs stubbed, observations + URIs use Tauri where applicable). Nested **sub-observation** flows (`openFormplayer` + `options.subObservationMode`) open a stacked Form preview iframe and resolve the parent promise with `FormCompletionResult` without persisting the child as a top-level observation.
- **Bundle extensions**: merge rules for `forms/ext.json` and `forms/{form}/ext.json` follow Formulus `ExtensionService`; see `src/lib/bundleResolution.ts`.
- **Embedded formplayer**: production build copied into `public/formplayer_dist/`; load in a WebView with the same **`FormInitData`** expectations as mobile (see `src/lib/formplayerHost.ts` for placeholder types).

## Application icon (Linux)

Bundled icons live under `src-tauri/icons/` and are referenced from `src-tauri/tauri.conf.json` **`bundle.icon`**. Misplaced **iOS-style** asset folders are not used for Tauri Linux bundles and have been removed to avoid confusion. For deb/AppImage installs, verify the packaged **`.desktop`** file **`Icon=`** entry resolves on Ubuntu/GNOME (dash, dock, Alt+Tab).

## Contributing

Conventional Commits; run `pnpm lint`, `pnpm format:check`, and `pnpm test` before pushing. PRs touching `desktop/**` trigger the **ODE Desktop** GitHub Actions workflow (see `.github/CICD.md`).
