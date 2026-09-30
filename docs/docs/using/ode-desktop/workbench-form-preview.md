---
sidebar_position: 8
---

# Form preview (Workbench)

Open and test **forms from the active bundle** using the embedded formplayer — the same rendering engine used inside Formulus.

Open **Workbench → Form preview** (`#/workbench/form-preview`).

## Prerequisites

- An app bundle applied on [Bundles](./workbench-bundles), **or**
- [Developer mode](./developer-mode) with a mirrored `forms/` directory

Authenticate on [Profiles](../profiles) so observation reads and writes use the profile database.

## Select a form

1. Choose a **form type** from the dropdown (loaded from `bundles/active/forms/` or `bundles/dev-local/forms/` when developer mode is on).
2. Optionally edit **initialization JSON** — parameters passed to the form session (for example prefill values).
3. Optionally edit **saved data JSON** — existing observation payload when simulating an edit.
4. Click **Open preview** to load the form in the embedded formplayer.

## Edit an existing observation

From [Observations](../observations), open an observation in Form preview. ODE Desktop navigates here with the observation ID and data pre-loaded. Saving through the form flow updates the local observation on **Finalize**.

## Nested sub-observations

Forms that call `openFormplayer` for sub-observations (for example repeat groups implemented as linked forms) open a **stacked** preview session. Each child session validates its own schema. See [Custom Extensions — nested sessions](/docs/guides/custom-extensions#nested-sessions-and-custom-validators).

## Limitations

In ODE Desktop form preview, **device APIs are stubbed**:

- Camera, GPS, QR scanning, audio, and video do not call real hardware
- Observations and attachment URIs use the profile SQLite store and Tauri file APIs where applicable

Behavior should match Formulus for the same bundle, except for native device features.

## Developer mode

When developer mode is on, form specs load from the mirrored `bundles/dev-local/forms/` tree. After editing forms locally, use **Refresh app** on [Bundles](./workbench-bundles) before re-opening preview.

## Related documentation

- [Formplayer reference](/docs/reference/formplayer)
- [Form design guide](/docs/guides/form-design)
- [Custom app (Workbench)](./workbench-custom-app)
