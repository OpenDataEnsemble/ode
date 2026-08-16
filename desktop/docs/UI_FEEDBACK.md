# ODE Desktop — UI feedback patterns

Single source of truth for how the shell surfaces status, errors, and confirmations.

## Progress banner (full-width)

**Use for:** long-running sync, import, **export**, and **app bundle download/apply** jobs.

- Renders below the mode switch / dev bar in `Shell`.
- Shows spinner + status text; optional determinate progress bar when `bundleActivity.total > 0`.
- Dismissible but reappears on next activity.
- Bundle apply: Rust emits `bundle/apply-progress` and `bundle/index-rebuild`; `bundleActivity` in `useCustodianStore` drives the banner.
- Do not use for quick actions (save, auth, dev mirror refresh).

## Toasts (bottom-right stack)

**Use for:** ephemeral success, info, and non-blocking warnings.

- Max 3 visible; newest on top.
- Success/info: auto-dismiss after ~5s.
- Error/warn toasts: auto-dismiss after ~8s or manual dismiss.
- API: `pushToast({ message, variant })` from `useToastStore`.

**Examples:** saved observation, authenticated, dev mirror refreshed, tab limit warning.

## Inline notices (`.notice` on page)

**Use for:** page-scoped errors that need surrounding context (form validation summary, bundle download failure on Bundles page).

- Stay on the page until the condition clears or user dismisses (if applicable).
- Do not duplicate the same message in a toast.

## Native confirm (Tauri)

**Use for:** destructive actions, import-with-issues, skip already-synced import rows, closing unsaved observation tabs.

- `confirmDestructiveAction()` for destructive flows (clear, profile-scoped wording).
- `confirm()` from `@tauri-apps/plugin-dialog` for save-anyway / import-anyway / tab discard (Save / Don't save / Cancel via separate flows).

## Retired patterns

- `window.alert` — replace with toast or inline notice.
- `window.confirm` — replace with Tauri `confirm`.
- Duplicate sync success in both banner and toast — prefer toast for short messages; keep banner only for multi-line sync summaries.

## Dev mode bar

Always visible on Workbench routes. Full-bleed across the main column (outside page padding). Muted when off; accent when on. Not a toast or progress banner.

## Layout spacing

Avoid stacked controls and panels touching — use `var(--space-md)` / `var(--space-lg)` between button rows, drop zones, and panels.

## Flush embed panels

When a panel contains only a webview (Form preview, Custom app), use `.panel-embed-flush`: no inner card padding and no iframe border — the outer panel edge is enough.
