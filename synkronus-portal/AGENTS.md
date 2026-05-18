# Synkronus Portal — AI & developer guide

**When to use this doc:** You are changing the **React + TypeScript + Vite** web UI that administers Synkronus (users, bundles, exports, observations).

**See also:** [../AGENTS.md](../AGENTS.md) (monorepo map). **Backend:** [../synkronus/AGENTS.md](../synkronus/AGENTS.md).

**User-facing docs:** [Synkronus Portal](https://opendataensemble.org/docs/reference/synkronus-portal) on [opendataensemble.org](https://opendataensemble.org/).

---

## What this package is

- **Portal** is a **standard API client** of Synkronus — same REST surface as the CLI; no special server-side shortcuts.
- **Dev:** Vite dev server with hot reload; **prod:** static build served (often via Docker/nginx in this repo’s compose setup).

---

## Operational details

- **Setup, Docker vs dockerless, ports, troubleshooting:** See [README.md](README.md) — it is the canonical long-form guide (this file avoids duplicating it).
- **API proxy:** Dev typically proxies `/api` to the Go backend (see `vite.config.ts`).

---

## Quick commands

From `synkronus-portal/`: `pnpm install`, `pnpm run dev`, `pnpm run lint`, `pnpm run format` — align with root [README.md](../README.md) and CI.
