# ODE Desktop changelog

## Unreleased (UX revamp)

### Shell & navigation

- Profiles is the default Data home; Overview removed
- New About screen (forum, website, GitHub, license)
- Toast notifications (bottom-right) + documented feedback patterns (`docs/UI_FEEDBACK.md`)
- CSS design tokens in `App.css`

### Observations

- Tabbed editor (List + per-observation tabs, unsaved `*`, close-all)
- Full-width list: form type primary, timestamps, Deleted tag
- Save validates against bundle schema (confirm to save anyway)
- Attachments row + open attachments folder
- Removed restore backup

### Import

- Fixed stuck busy state after import (throttled status timer cleanup)
- Restructured staging UI; validation accordion by severity
- Native confirm for import-with-issues

### Sync

- Silent auto-auth from keyring before pull/push
- Prominent Pull/Push with icons; danger zone (reset local data, index rebuild, server reset)

### Profiles

- Simplified layout; auth button with status icon

### UX second pass

- Profiles: form-table layout, profile toolbar (+), copyable DB path, removed environment tier and Reload
- Observations: section headings, form-table editor, delete shortcut, list filter bar, right-aligned timestamps
- Import: button icons, per-file remove, clear staging link, surfaced file-limit errors
- Sync: force-push dialog when attachments missing; always strict confirms
- About: larger logo
- Workbench: full-bleed dev bar, narrower form preview sidebar, flush embed panels
- Removed profile environment badge; destructive confirms always production-strict

### UX polish (round 2)

- Profiles: save/delete in top panel; wrapping paths; fixed action button layout; removed copy buttons
- Observations: fixed pager at bottom of list tab
- Sync: green **Sync (Pull + Push)** combined action
- Form preview: full-width form type select; stacked advanced JSON fields
- General: increased spacing between buttons and controls

### Workbench

- Always-visible developer mode bar (toggle + refresh)
- Simplified Bundles page
- Form preview: advanced params expander; auto-refresh form list on bundle apply
- Custom app: hide empty-bundle hint in developer mode

### Backend

- Pull preserves observation extras (`deleted`, tags, geolocation, etc.)
- Removed `restore_last_backup` command
