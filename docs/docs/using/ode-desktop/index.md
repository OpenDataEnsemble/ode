---
sidebar_position: 1
---

# ODE Desktop

User guide for **ODE Desktop** — the Open Data Ensemble desktop application for data stewardship and app development.

:::info New in ODE v1.1.0

ODE Desktop joined the ensemble in **v1.1.0**. [Install ODE Desktop](/docs/getting-started/installation/installing-ode-desktop) to get started.

:::

## Two modes

ODE Desktop provides two modes in one application. Use the mode switcher in the top bar:

| Mode | Who it's for | What you do |
|------|--------------|-------------|
| **Data management** | Field and data staff | Profiles, observations, import, sync |
| **Forms / app workbench** | Form and app authors | Bundles, form preview, custom app testing |

Both modes share the **active profile** — the same Synkronus server, workspace, and local observation database.

## Navigation

### Data management

| Screen | Purpose |
|--------|---------|
| [Profiles](./profiles) | Server connection, workspace, authentication |
| [Observations](./observations) | Search, edit, and resolve observations |
| [Import](./import) | Import JSON observation files |
| [Sync](./sync) | Pull, push, and workspace maintenance |
| [About](./about) | Support links and license |

### Workbench

| Screen | Purpose |
|--------|---------|
| [Bundles](./workbench-bundles) | Download app bundles from Synkronus |
| [Form preview](./workbench-form-preview) | Open and test forms from the bundle |
| [Custom app](./workbench-custom-app) | Run the custom app WebView |
| [Developer mode](./developer-mode) | Iterate on a local custom app build |

## Typical workflows

### Data steward

1. [Create a profile](./profiles) with your Synkronus server URL.
2. **Authenticate** on Profiles.
3. On [Sync](./sync), run **Pull** to download observations.
4. Inspect and edit on [Observations](./observations).
5. **Push** local changes back to Synkronus.

### App author

1. Set up a profile and authenticate (as above).
2. On [Bundles](./workbench-bundles), **Download & apply** the active app bundle.
3. Test forms on [Form preview](./workbench-form-preview) or the full app on [Custom app](./workbench-custom-app).
4. For local iteration before publishing, enable [Developer mode](./developer-mode).

## Related documentation

- [ODE Desktop reference](/docs/reference/ode-desktop) — architecture and workspace layout
- [Installing ODE Desktop](/docs/getting-started/installation/installing-ode-desktop)
- [Understanding app bundles](/docs/using/app-bundles)
- [ODE Desktop developer mode](/docs/guides/ode-desktop-developer-mode) — full developer mode guide
