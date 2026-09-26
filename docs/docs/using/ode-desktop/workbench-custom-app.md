---
sidebar_position: 9
---

# Custom app (Workbench)

Run the **custom application** from the active app bundle in an embedded WebView — the same integration model as Formulus.

Open **Workbench → Custom app** (`#/workbench/custom-app`).

## Prerequisites

| Mode | Requirement |
|------|-------------|
| **Normal** | Download an app bundle on [Bundles](./workbench-bundles) |
| **Developer mode** | Enable [Developer mode](./developer-mode) and mirror a folder with `index.html` |

Authenticate on [Profiles](../profiles) so the custom app can read and write observations through the Formulus bridge.

## Normal mode

When developer mode is off:

1. **Download & apply** a bundle on Bundles.
2. Open **Custom app** — ODE Desktop loads `index.html` from `bundles/active/app/`.
3. Use **Reload app** to remount the WebView after bundle updates.

The status line shows the active bundle version and hash.

## Developer mode

When developer mode is on:

- The embed loads from `bundles/dev-local/app/` (your mirrored local build).
- The downloaded bundle in `bundles/active/` remains on disk for sync and server refresh.
- After each local build, click **Refresh app** on Bundles or in the Workbench banner.

If the folder is missing or has no `index.html`, a blocking warning appears — ODE Desktop does not silently fall back to `bundles/active/`.

## Bridge behavior

The custom app receives the same **Formulus JavaScript API** as on mobile (`window.formulus`). ODE Desktop handles `postMessage` bridge calls for:

- Observations (`getObservations`, `getObservationsByQuery`, `persistObservation`, etc.)
- Opening nested form sessions (navigates to [Form preview](./workbench-form-preview))
- Attachment URIs where applicable

Device APIs (camera, GPS, QR, etc.) are **stubbed** in the desktop WebView.

## Finalize flow

When the custom app submits a form through the bridge, ODE Desktop may show a **Finalize** dialog (same concept as Formulus) before persisting the observation locally.

## Related documentation

- [Custom applications](/docs/using/custom-applications)
- [ODE Desktop developer mode](/docs/guides/ode-desktop-developer-mode)
- [Observation queries](/docs/guides/observation-queries)
