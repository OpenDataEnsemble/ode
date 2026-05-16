# ODE Desktop — AI and developer guide

**ODE Desktop** (`desktop/`) is the Tauri + React + Rust app for **Data management** (observations, sync, import) and the **Forms / app workbench** (bundles, form preview, custom app embed). User-facing overview: [desktop/README.md](README.md).

Published docs: [ODE Desktop developer mode](https://opendataensemble.org/docs/guides/ode-desktop-developer-mode) (local custom app iteration).

---

## Layout

| Area | Path | Notes |
|------|------|--------|
| Frontend | `src/` | React, Zustand (`useCustodianStore`), workbench pages |
| Backend | `src-tauri/src/lib.rs` | Workspace, bundles, SQLite, sync, dev mirror |
| Formplayer assets | `public/formplayer_dist/` | Copy from `formulus-formplayer` (`pnpm build:formplayer`) |
| Bridge | `public/formulus-injection.js`, `src/lib/formPreviewBridge.ts` | Same contract as Formulus WebView |

**Profiles** are server-scoped settings in Tauri config: workspace path, Synk credentials, and workbench options. Switching profile switches workspace + DB.

---

## Workbench developer mode

Lets authors iterate on a **local build** of a custom app (e.g. `dist/`) against a profile’s real observations **without** overwriting the Synk-downloaded bundle in `bundles/active/`.

### Profile fields

| Field | Type | Purpose |
|-------|------|---------|
| `customAppDeveloperMode` | `boolean` | When true, workbench app + forms use dev mirror |
| `customAppLocalFolder` | `string \| null` | Absolute path to folder containing `index.html` |

Persisted per profile via `upsertProfileRemote` / Rust `ServerProfile`.

### Workspace paths

| Mode | Custom app | Forms |
|------|------------|-------|
| Off | `bundles/active/app/` | `bundles/active/forms/` |
| On | `bundles/dev-local/app/` (mirror) | `bundles/dev-local/forms/` (mirror if `<folder>/forms` exists) |

Synk downloads and **Refresh from server** on the Bundles page only touch `bundles/active/`. The source folder on disk is **never** modified.

### UI

- **Configure:** Workbench → **Bundles** → `DeveloperModePanel` (`variant="full"`): Off/On toggle, folder picker, Browse, Refresh app.
- **Banner:** When on, `DeveloperModePanel` (`variant="banner"`) in `App.tsx` `Shell` on all `/workbench/*` routes, **above** activity/sync banners (path + Refresh app).
- **Consumers:** `WorkbenchCustomAppPage` (embed only), `FormPreviewPage`, `formPreviewBridge` (`getCustomAppUri`, `getFormSpecsUri` via Rust dev-aware roots).

### Mirror command

`refresh_custom_app_dev_mirror` (TS: `tauriClient.refreshCustomAppDevMirror()`):

1. Validates `index.html` at source root.
2. Copies source tree → `bundles/dev-local/app/`.
3. If `source/forms/` exists, copies → `bundles/dev-local/forms/`.

On success, Zustand bumps `devMirrorGeneration` so embeds and form lists reload.

### Key TypeScript

- `src/hooks/useDeveloperMode.ts` — profile read/write, refresh, generation counter from store.
- `src/components/DeveloperModePanel.tsx` — full vs banner UI; auto-mirror `useEffect` only on `variant="full"`.
- `src/lib/bundleLayout.ts` — `bundleSegment()`, `bundleFormsRel()`.
- `src/store/useCustodianStore.ts` — `devMirrorGeneration`, `devBusy`, `devError`, `refreshDevMirror`.

### Key Rust

- `profile_developer_mode`, `bundle_segment`, `bundle_form_roots_for_ctx`
- Dev-aware: `list_active_bundle_forms`, `read_bundle_form_spec`, `get_active_bundle_forms_file_base_url`, `scan_bundle_custom_question_types`, `bundle_app_config_path`
- Tests: `validate_custom_app_dev_source_requires_index_html`, `mirror_custom_app_dev_folder_copies_tree`

### Errors

Developer mode on with missing/invalid folder → blocking error in UI; no silent fallback to `bundles/active/` for custom app load.

---

## Bridge and bundles

- **Contract source of truth:** [`formulus/src/webview/FormulusInterfaceDefinition.ts`](../formulus/src/webview/FormulusInterfaceDefinition.ts).
- **Form preview:** `formPreviewBridge.ts` handles injection `postMessage` types; device APIs stubbed; observations/attachments use Tauri.
- **Extensions:** `bundleExtensionLoader.ts` merges `forms/ext.json` like Formulus `ExtensionService`; pass `developerMode` for path prefix.

---

## Commands

```bash
cd desktop
pnpm dev          # Vite
pnpm tauri dev    # Full app
pnpm test         # Vitest
pnpm typecheck
cd src-tauri && cargo test
```

Conventional Commits; see root [AGENTS.md](../AGENTS.md) and [.github/CICD.md](../.github/CICD.md).
