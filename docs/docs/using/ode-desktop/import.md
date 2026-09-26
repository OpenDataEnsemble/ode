---
sidebar_position: 4
---

# Import

Bring external **JSON observation files** into the active profile's local repository.

Open **Data management → Import** (`#/data/import`).

## When to use import

Use Import when you have observation JSON files on disk (for example from an export, migration, or another tool) and want them in ODE Desktop's local SQLite store before sync or editing.

Import targets the **active profile's** workspace database.

## Import workflow

1. **Stage files** — drag and drop `.json` files onto the import area, or use the file picker to select one or more files.
2. **Review the summary** — ODE Desktop shows counts, detected form types, and any parse or normalization issues per file.
3. If there are non-fatal issues, confirm whether to **import with issues** or fix files first.
4. Click **Import** to write observations into the local repository.
5. Use **Clear** to reset the staging area.

After a successful import, refresh **Observations** and **Sync** health counts to see the new data.

## What gets imported

- Observation JSON payloads compatible with the local repository schema
- Attachment references may be noted in the summary; ensure attachment files exist under the workspace `attachments/` folder if needed

## What this screen does not do

- **Ongoing JSON editing** — use [Observations](./observations)
- **Synkronus sync** — use [Sync](./sync) after import
- **Profile switching** — change profile on [Profiles](./profiles) before importing

## Next steps

- [Observations](./observations) — verify imported rows
- [Sync](./sync) — push imported changes to Synkronus (if intended)
