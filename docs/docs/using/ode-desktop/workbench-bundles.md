---
sidebar_position: 7
---

# Bundles (Workbench)

Download and manage **app bundles** from Synkronus into the active profile workspace.

Open **Workbench → Bundles** (`#/workbench/bundles`).

## Prerequisites

1. Configure and **authenticate** a profile on [Profiles](../profiles).
2. Ensure the Synkronus server has an active app bundle published.

## Server bundle information

The **Server** panel shows:

- **Active version** — the bundle version currently active on Synkronus
- **Hash** — content hash of the active bundle
- **Download & apply** — fetch the bundle ZIP and install it into `bundles/active/`
- **Versions on server** — list of all published versions and whether each is archived locally

Click **Refresh from server** to reload the version list and manifest from Synkronus.

If the server bundle differs from what is installed locally, a warning appears: **Server bundle differs from local workspace.**

## Local workspace

The **Local workspace** panel shows the bundle currently applied on this device:

- **Version** and **hash**
- **Downloaded** timestamp

Downloaded bundles are stored under `bundles/active/` in the profile workspace (`app/`, `forms/`, etc.).

## Developer mode

The **Bundles** page is also where you configure [Developer mode](../developer-mode):

1. Turn **Developer mode** **On**.
2. **Browse…** to a folder containing `index.html` (your local custom app build).
3. Use **Refresh app** after each rebuild.

While developer mode is on, an orange **banner** on all Workbench pages shows the folder path and a **Refresh app** shortcut.

Developer mode mirrors your folder to `bundles/dev-local/` without overwriting `bundles/active/`. See the full guide: [ODE Desktop developer mode](/docs/guides/ode-desktop-developer-mode).

## Typical workflow

1. **Download & apply** the server bundle.
2. Open [Form preview](../workbench-form-preview) or [Custom app](../workbench-custom-app) to test.
3. For local iteration, enable developer mode and point at your `dist/` output.

## Related documentation

- [Understanding app bundles](/docs/using/app-bundles)
- [ODE Desktop developer mode](/docs/guides/ode-desktop-developer-mode)
