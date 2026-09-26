---
sidebar_position: 3
---

# Observations

Inspect, edit, and resolve **observations** in the active profile's local repository.

Open **Data management → Observations** (`#/data/observations`).

## Search and filter

1. Use the **search** field to filter by observation ID or form type.
2. Apply client-side **filters**:

   | Filter | Shows |
   |--------|-------|
   | **All** | All loaded observations |
   | **Dirty** | Local changes not yet pushed |
   | **Conflicts** | Observations with sync conflicts |
   | **Recently modified** | Recently changed rows |

:::note Result limit

Search returns up to **250** observations per query. Filters apply to that loaded set only. Full-repository counts (pending push, conflicts) appear on **Sync**.

:::

## View and edit an observation

1. Select an observation from the list.
2. Review metadata: ID, form type, timestamps, sync status, and dirty/conflict flags.
3. Edit the **JSON payload** in the editor.
4. Click **Save** to persist changes locally.

Unsaved edits are marked as **dirty** until you push from **Sync**.

## Restore backup

If you need to undo local edits to the selected observation, use **Restore backup** to revert to the last backed-up version stored locally.

## Create a new observation

Click **New observation** to create a blank local observation. You will need to set the form type and data before pushing.

## Open in Form preview

From an observation, you can open **Form preview** in the Workbench to edit the observation through the formplayer UI instead of raw JSON. This navigates to **Workbench → Form preview** with the observation pre-loaded.

## Resolve conflicts

Observations with **conflict** status need attention before push:

1. Filter by **Conflicts** to find affected rows.
2. Edit the JSON to reconcile with server expectations.
3. Save locally, then **Push** from [Sync](./sync).

## What this screen does not do

- **Bulk JSON import** — use [Import](./import)
- **Synkronus pull/push** — use [Sync](./sync)
- **Profile configuration** — use [Profiles](./profiles)

## Next steps

- [Sync](./sync) — push dirty observations to Synkronus
- [Form preview](./workbench-form-preview) — edit through the form UI
