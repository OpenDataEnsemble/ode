---
sidebar_position: 5
---

# Sync

Authenticate with Synkronus and **exchange data** with the server: pull remote changes, push local edits, and maintain workspace health.

Open **Data management → Sync** (`#/data/sync`).

## Status panel

The Sync screen shows:

| Field | Meaning |
|-------|---------|
| **Server** | Synkronus URL from the active profile |
| **Status** | Reachability (and server version when available) |
| **Pending push** | Count of locally dirty observations |
| **Conflicts** | Count of observations with sync conflicts |
| **Last pull / Last push** | Timestamps of recent sync operations |

If you are not authenticated, a warning links to [Profiles](./profiles).

## Sync actions

| Button | Action |
|--------|--------|
| **Sync (Pull + Push)** | Pull from server, then push local changes (with push confirmation) |
| **Pull** | Download remote changes into the local repository |
| **Push** | Upload local dirty observations to Synkronus |

Push asks for confirmation when there are pending changes. If observations reference **missing attachment files**, a dialog lets you cancel or force push without those attachments.

While a sync job is running, you can **Pause**, **Resume**, or **Cancel** the in-flight operation. If the sync engine left a paused job, use **Resume job** or **Discard job**.

:::tip Conflicts

Resolve conflicts on [Observations](./observations) before pushing. The conflict count on Sync updates as you edit.

:::

## Danger zone

Advanced maintenance actions appear at the bottom of the Sync screen:

| Action | Effect |
|--------|--------|
| **Reset local data** | Remove all observations and attachment files from this device and reset sync offsets |
| **Re-create index** | Rebuild the observation index from `app.config.json` (needed after index declaration changes or bulk imports) |
| **Reset server repository and pull** | Delete all observations and attachment manifest data **on Synkronus**, then pull so this device archives its workspace and starts fresh |

All danger-zone actions require explicit confirmation. Use them only when you understand the data loss implications.

The panel also shows **index generation** and **last rebuild** time.

## Observation indexes

Custom apps declare `observationIndexes` in `app.config.json` for fast `getObservationsByQuery`. ODE Desktop maintains a local index table — it is never synced to Synkronus.

After changing index declarations in a bundle or bulk-importing observations, click **Re-create index**. See [Observation queries](/docs/guides/observation-queries) for index design.

## What this screen does not do

- **Per-observation JSON editing** — use [Observations](./observations)
- **Profile and workspace setup** — use [Profiles](./profiles)

## Next steps

- [Observations](./observations) — review pulled or conflicting data
- [Profiles](./profiles) — update credentials if authentication fails
