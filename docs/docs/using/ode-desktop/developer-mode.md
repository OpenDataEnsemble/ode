---
sidebar_position: 10
---

# Developer mode

Iterate on a **local custom app build** against real profile observations without replacing the bundle downloaded from Synkronus.

## Summary

When developer mode is on, ODE Desktop **mirrors** your selected folder into `bundles/dev-local/` in the profile workspace. The workbench then loads:

- **Custom app** from `bundles/dev-local/app/`
- **Form preview** from `bundles/dev-local/forms/` (when your folder includes a `forms/` directory)

Observations, attachments, and sync still use the profile database. The Synk-downloaded bundle in `bundles/active/` is **not** overwritten.

## Quick start

1. Open **Workbench → [Bundles](./workbench-bundles)**.
2. Turn **Developer mode** **On**.
3. Click **Browse…** and select the folder that contains `index.html` (typically your `dist/` output).
4. After each rebuild, click **Refresh app**.

## Full guide

For prerequisites, folder layout, refresh behavior, limitations, and platform comparison with Formulus, see the complete guide:

**[ODE Desktop developer mode](/docs/guides/ode-desktop-developer-mode)**

## See also

- [Custom app (Workbench)](./workbench-custom-app)
- [Form preview (Workbench)](./workbench-form-preview)
- [Bundles (Workbench)](./workbench-bundles)
