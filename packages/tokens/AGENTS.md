# @ode/tokens — AI & developer guide

**When to use this doc:** You are changing **design tokens** (colors, spacing, typography) built with **Style Dictionary**, or fixing build issues for downstream packages.

**See also:** [../../AGENTS.md](../../AGENTS.md). **Consumers:** [formulus-formplayer](../../formulus-formplayer/AGENTS.md), [components](../components/README.md).

**User-facing docs:** [Components](https://opendataensemble.org/docs/reference/components) (tokens usage appears in the broader UI system).

---

## What this package is

- **`@ode/tokens`** outputs token artifacts used by **formulus-formplayer** (theme) and **@ode/components** (shared UI).

---

## Build

- From `packages/tokens/`: `npm install`, then `npm run build` (or the `prepare` script as invoked by npm).
- **Order:** Other packages **depend on tokens built** — install tokens before formplayer/components when setting up a fresh clone (see formplayer AGENTS).

---

## Changing tokens

- Edit tokens in `src/` (see [README.md](README.md) for structure), rebuild, then verify consumers (formplayer theme, components) for visual regressions.
