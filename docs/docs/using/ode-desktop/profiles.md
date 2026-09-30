---
sidebar_position: 2
---

# Profiles

Configure **which Synkronus server and workspace** ODE Desktop uses.

Open **Data management → Profiles** (`#/data/profiles`). This is the home screen when you launch ODE Desktop.

## What profiles are for

Each profile is an independent unit of custody:

- Synkronus **server URL** and **credentials**
- A dedicated **workspace folder** on disk (SQLite database, attachments, bundle cache)
- Its own sync state and authentication session

Switch profiles from the dropdown at the top of the Profiles screen.

## Add or switch a profile

1. Use the **profile dropdown** to select an existing profile, or click **Add profile** to create one.
2. Enter a **display name**, **server URL**, and **username**.
3. Enter a **password** (stored in the OS keyring when available).
4. Choose a **workspace folder** with **Browse…** — ODE Desktop stores the database and attachments under this path.
5. Click **Save profile**.

:::tip Workspace layout

Under the workspace folder, ODE Desktop creates:

- `repository.sqlite` — local observation database
- `attachments/` — binary attachment files
- `bundles/` — downloaded and dev-mirrored app bundles

The **Database** and **Attachments** paths are shown read-only after you pick a workspace.

:::

## Authenticate

After saving server credentials:

1. Click **Authenticate** on the Profiles screen.
2. When successful, the button shows **Authenticated** and sync operations are enabled.

If you are not authenticated, **Sync** shows a warning with a link back to Profiles.

:::note Password storage

On platforms without a working secret service, profile fields still save but the password is **not persisted** on disk. Enter your password when authenticating each session, or use **Sync** after saving credentials in memory.

:::

## Workspace actions

| Action | Purpose |
|--------|---------|
| **Open** | Open the workspace folder in your file manager |
| **Move workspace…** | Relocate all workspace data to a new folder and update the profile |
| **Backup workspace…** | Export the workspace to a timestamped `.zip` archive |
| **Clear saved password** | Remove the password from secure storage |

## Delete a profile

Click **Delete profile** to remove the profile from ODE Desktop. Local files on disk are **not** automatically deleted — you can remove the workspace folder manually if needed.

:::warning External SQL tools

If you open `repository.sqlite` with external tools, **quit ODE Desktop first**. Direct database edits can break sync and conflict detection.

:::

## Next steps

- [Sync](./sync) — pull and push observations
- [Observations](./observations) — browse and edit local data
- [Bundles](./workbench-bundles) — download an app bundle for the workbench
