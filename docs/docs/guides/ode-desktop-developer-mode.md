# ODE Desktop developer mode

**Developer mode** in ODE Desktop lets you iterate on a **local custom app build** (for example `dist/` after your app’s build command, such as `npm run build` or `pnpm run build`) against a profile’s real observations and workspace, without replacing the bundle you downloaded from Synkronus. Building **ODE Desktop** itself uses **pnpm** — see [Development Setup](/docs/development/setup#package-manager-pnpm).

## What it is

When developer mode is on, ODE Desktop **mirrors** your selected folder into the profile workspace under `bundles/dev-local/`. The workbench then loads:

- **Custom app** from `bundles/dev-local/app/`
- **Form preview** from `bundles/dev-local/forms/` (when your folder includes a `forms/` directory)

Observations, attachments, and sync still use the profile database. The Synk-downloaded bundle in `bundles/active/` is **not** overwritten.

## Prerequisites

- ODE Desktop installed — see [Installing ODE Desktop](/docs/getting-started/installation/installing-ode-desktop).
- A **profile** with a configured workspace.
- A local folder whose root contains **`index.html`** (typical: your custom app `dist/` output).
- Optional: download an app bundle from Synkronus on the **Bundles** page so `bundles/active/` has forms and `app.config.json` when developer mode is off.

## Enable developer mode

1. Open **Workbench** → **Bundles**.
2. Turn **Developer mode** **On**.
3. Click **Browse…** and select the folder that contains `index.html`.
4. Wait for the first mirror to finish (or click **Refresh app**).

While developer mode is on, an orange **banner** appears on all Workbench pages with the folder path and a **Refresh app** shortcut.

## Folder layout

Your selected folder is the **app root** (same idea as the `app/` directory inside a published bundle):

```
my-custom-app/dist/
  index.html          ← required at root
  app.js
  assets/
  forms/              ← optional; mirrored for Form preview
    my_form/
      schema.json
      ui.json
```

- **Custom app entry:** `index.html` at the selected path (not a parent repo root unless that root is your built app).
- **Forms:** standard bundle layout under `forms/{formType}/schema.json` and `ui.json`, plus optional `forms/ext.json` and custom question types (same as Formulus bundles).

## Refresh app

After you rebuild the custom app or edit forms locally:

1. Click **Refresh app** on the Bundles page or in the Workbench banner.

This re-runs the mirror (`source` → `bundles/dev-local/app/` and `source/forms/` → `bundles/dev-local/forms/`). **Custom app** and **Form preview** pick up changes on the next load (the embed remounts automatically after a successful mirror).

**Refresh from server** on the Bundles page is separate: it updates `bundles/active/` from Synkronus only.

## What changes when developer mode is on

| Area | Behavior |
|------|----------|
| Custom app (Workbench) | Loads mirrored app under `bundles/dev-local/app/` |
| Form preview | Lists and loads specs from `bundles/dev-local/forms/` when mirrored |
| Observations / sync | Unchanged — profile SQLite |
| Downloaded bundle | Stays in `bundles/active/` for server reload and non-dev use |
| `getCustomAppUri` / `getFormSpecsUri` (in preview bridge) | Point at dev-local roots when mode is on |

## Workbench banner

When developer mode is on, every Workbench route shows a compact status strip **above** sync/activity messages: active folder path and **Refresh app**. Configure the folder and toggle on the **Bundles** page only.

## Limitations

- **Device APIs** (camera, GPS, QR, etc.) are stubbed in ODE Desktop form preview, same as before developer mode.
- The mirror is a **copy** — edit files in your source folder, then **Refresh app**; ODE Desktop does not watch the filesystem.
- Invalid or missing folder (no `index.html`) shows a **blocking error**; the custom app does not silently fall back to `bundles/active/`.
- Observation query indexes use `app.config.json` from the **mirrored** app when developer mode is on; rebuild indexes if you change index declarations (see [Observation queries](./observation-queries)).

## Platform comparison

| | Formulus (device) | ODE Desktop (developer mode) |
|--|-------------------|----------------------------|
| Custom app source | Downloaded bundle | Local folder → `bundles/dev-local/app/` |
| Forms | Bundle on device | Mirrored `forms/` or `bundles/active/forms/` when off |
| Observations | On-device DB | Profile workspace SQLite |
| Typical use | Field collection | Local iteration before publish |

## See also

- [Bundles (Workbench)](../using/ode-desktop/workbench-bundles) — download bundles and enable developer mode
- [Custom app (Workbench)](../using/ode-desktop/workbench-custom-app) — embedded custom app WebView
- [Form preview (Workbench)](../using/ode-desktop/workbench-form-preview) — formplayer preview
- [ODE Desktop reference](../reference/ode-desktop) — architecture and workspace layout
- [Understanding app bundles](../using/app-bundles) — Synk download to `bundles/active/`
- [Custom applications](../using/custom-applications) — custom app role in bundles
- [Observation queries](./observation-queries) — `getObservationsByQuery` and indexes
