---
sidebar_position: 3
---

# Installing ODE Desktop

Complete guide for installing **ODE Desktop** on Windows, macOS, and Linux.

:::info ODE v1.3.2

ODE Desktop is part of the **ODE v1.3.2** release. Use the [Downloads](/downloads) page for direct, platform-matched installers or browse [GitHub Releases](https://github.com/OpenDataEnsemble/ode/releases).

:::

## Overview

ODE Desktop is a native desktop application (Tauri) for:

- **Data management** — inspect, edit, import, and sync observations with Synkronus
- **Forms / app workbench** — download app bundles, preview forms, and test custom apps

Choose the installation method that fits your role:

| Method | Best for |
|--------|----------|
| **GitHub Release** | Data stewards and app authors who want a ready-to-run installer |
| **Build from source** | Contributors and early adopters working from the ODE monorepo |

## System requirements

| Platform | Requirements |
|----------|--------------|
| **Windows** | Windows 10 or 11; [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed) |
| **macOS** | Recent macOS; Xcode command-line tools for source builds |
| **Linux** | WebKitGTK and related packages per [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) |

## Method 1: GitHub Releases (recommended)

1. Open [Downloads](/downloads) to download the installer matched to your platform, or open [OpenDataEnsemble/ode releases](https://github.com/OpenDataEnsemble/ode/releases).
2. Select the **v1.3.2** release (or the latest stable tag).
3. Download the artifact for your platform:

   | Platform | Typical artifact |
   |----------|------------------|
   | Windows | `.msi` installer |
   | macOS | `.dmg` or `.app` bundle |
   | Linux | AppImage, `.deb`, or similar |

4. Run the installer or extract the bundle and launch **ODE Desktop**.

:::note Installer script

A curl-style installer script (`scripts/install-ode-desktop.sh`) exists in the monorepo as a placeholder for future one-line installs. Until it is wired to release asset URLs, use GitHub Releases directly.

:::

## Method 2: Build from source

For development or when no pre-built artifact is available for your platform:

### Prerequisites

- **Node.js** 20+ and **pnpm** 10+
- **Rust** toolchain ([rustup](https://rustup.rs/))
- Platform build tools (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

### Build steps

```bash
git clone https://github.com/OpenDataEnsemble/ode.git
cd ode/desktop
pnpm install
pnpm tauri build
```

`pnpm tauri build` runs the full pipeline: Formplayer assets are prepared, the frontend is built, and Tauri packages the native app. Installers or bundles appear under `desktop/src-tauri/target/release/bundle/`.

### Development run

To run with hot reload during development:

```bash
cd ode/desktop
pnpm install
pnpm tauri dev
```

:::warning Use the Tauri window

`pnpm tauri dev` opens the **Tauri desktop window**. Do not use a regular browser at `http://localhost:1420` — IPC commands such as `invoke` only work inside the Tauri shell.

:::

## First launch

1. Open **ODE Desktop**.
2. Switch to **Data management** mode (if not already selected).
3. On **Profiles**, add or select a profile with your Synkronus server URL.
4. **Authenticate** with your Synkronus credentials.
5. On **Sync**, run **Pull** to download observations, or **Download & apply** an app bundle from **Workbench → Bundles**.

## Next steps

- [ODE Desktop user guide](/docs/using/ode-desktop/) — screen-by-screen usage
- [ODE Desktop reference](/docs/reference/ode-desktop) — architecture and workspace layout
- [ODE Desktop developer mode](/docs/guides/ode-desktop-developer-mode) — test a local custom app build
- [ODE Desktop development](/docs/development/ode-desktop-development) — contributor setup

## Troubleshooting

| Issue | Suggestion |
|-------|------------|
| App won't start on Linux | Install WebKitGTK and dependencies from Tauri docs |
| WebView2 missing on Windows | Install the [WebView2 runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |
| Build fails on `pnpm tauri build` | Ensure Rust and platform prerequisites are installed; run `pnpm build:formplayer` first if Formplayer assets are missing |
| Sync authentication fails | Verify server URL and credentials on **Profiles**; check server reachability on **Sync** |

For more help, see [Getting Help](/docs/community/getting-help) or the [forum](https://forum.opendataensemble.org).
