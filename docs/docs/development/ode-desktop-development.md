---
sidebar_position: 7
---

# ODE Desktop Development

Complete guide for developing **ODE Desktop** from the ODE monorepo.

## Prerequisites

- **Node.js** 20+ and **pnpm** 10+
- **Rust** toolchain ([rustup](https://rustup.rs/))
- Platform build tools per [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

Install shared design tokens before the desktop package:

```bash
cd packages/tokens && pnpm install && pnpm run build && cd ../..
```

## Local development setup

```bash
cd desktop
pnpm install
pnpm tauri dev
```

:::warning Use the Tauri window

`pnpm tauri dev` opens the **Tauri desktop window** with the Rust backend. Do not use a regular browser at `http://localhost:1420` — IPC commands such as `invoke` only work inside the Tauri shell.

:::

For frontend-only work without Tauri IPC:

```bash
pnpm dev
```

This starts the Vite dev server only; most Data management and Workbench features require `pnpm tauri dev`.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Vite dev server (frontend only) |
| `pnpm build` | Typecheck + Vite production build |
| `pnpm build:formplayer` | Build `formulus-formplayer` and copy into `public/formplayer_dist/` |
| `pnpm build:tauri` | Prepare Formplayer assets, then build the desktop frontend |
| `pnpm tauri build` | Full desktop bundle (runs `build:tauri` first) |
| `pnpm tauri dev` | Development with hot reload in the Tauri shell |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test` | Vitest unit and component tests |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm copy:formplayer` | Copy existing `formulus-formplayer/build/` into `public/formplayer_dist/` |

From `formulus-formplayer/`, `pnpm run build:copy` builds formplayer and copies assets to Formulus and ODE Desktop in one step.

### Rust backend

```bash
cd desktop/src-tauri
cargo test
cargo fmt
cargo clippy
```

## Formplayer integration

ODE Desktop embeds the same formplayer bundle as Formulus. Production builds copy formplayer into `public/formplayer_dist/`.

After changing formplayer or the Formulus bridge contract:

1. Update `formulus/src/webview/FormulusInterfaceDefinition.ts` (source of truth).
2. Run `pnpm run sync-interface` in `formulus-formplayer`.
3. Rebuild and copy: `pnpm run build:copy` from `formulus-formplayer/`, or `pnpm build:formplayer` from `desktop/`.

## OpenAPI client

The desktop app regenerates a TypeScript Synkronus client from `synkronus/openapi/synkronus.yaml`:

```bash
cd desktop
pnpm codegen:synk-client
```

CI fails if the generated client does not match the OpenAPI spec.

## Developer mode (user-facing)

To test a local custom app build against a profile workspace, use **Workbench developer mode**. See:

- [ODE Desktop developer mode](/docs/guides/ode-desktop-developer-mode) — user guide
- [ODE Desktop reference](/docs/reference/ode-desktop) — `bundles/dev-local/` paths and bridge behavior

## Project layout

| Path | Role |
|------|------|
| `desktop/src/` | React UI (pages, components, store) |
| `desktop/src-tauri/` | Rust backend (SQLite, sync, bundle apply, dev mirror) |
| `desktop/public/formplayer_dist/` | Embedded formplayer bundle |
| `desktop/public/formulus-injection.js` | Bridge injection for custom app and form preview |

## Contributing

- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Run `pnpm lint`, `pnpm format:check`, and `pnpm test` before pushing
- PRs touching `desktop/**` trigger the ODE Desktop GitHub Actions workflow

## Related documentation

- [ODE Desktop reference](/docs/reference/ode-desktop) — component overview
- [Installing ODE Desktop](/docs/getting-started/installation/installing-ode-desktop)
- [Formplayer development](/development/formplayer-development)
- [Building and testing](/development/building-testing)
