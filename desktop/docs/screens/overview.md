# Overview

## Purpose

Single place to see repository health, server reachability, and light maintenance for the active profile.

## User question it answers

“What is the state of my local repository and connection to Synkronus right now?”

## What to include

- Active profile name and server URL
- Metrics: total observations, pending changes (dirty), conflicts
- Paths: workspace, repository file
- Timestamps: last save, pull, push
- Server reachability and version (when URL is set)
- Global notices (`syncMessage`, errors)
- Repair / reindex maintenance action

## What to exclude

- Per-observation editing (Observations)
- Import file UI (Import)
- Login and pull/push actions (Sync)
- Profile CRUD and path pickers beyond what’s needed for this summary (Profiles)

## Key actions

- Run **Repair / Reindex**
- Navigate to other areas via sidebar (implicit)

## Data dependencies

- Store: `health` (`get_app_health` / `AppHealth`), `syncMessage`, `error`, `loadHealth`, `loadWorkspace`, `loadObservations`, `repairRepository`
- Active profile: `selectActiveProfileState`
- Server poll: `useSynkServerStatus` (HTTP `GET {serverUrl}/health`)
