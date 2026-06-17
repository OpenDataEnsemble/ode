# @ode/components — AI & developer guide

**When to use this doc:** You are changing **shared React UI** consumed by Portal or other ODE frontends.

**See also:** [../../AGENTS.md](../../AGENTS.md). **Tokens:** [../tokens/AGENTS.md](../tokens/AGENTS.md).

**User-facing docs:** [Components](https://opendataensemble.org/docs/reference/components) on [opendataensemble.org](https://opendataensemble.org/).

---

## What this package is

- **`@ode/components`** is shared UI built on **React** and **@ode/tokens** (and related styling patterns). Prefer **tokens** over hard-coded colors/spacing where a token exists.

---

## Scope

- **Change here** when the component is **reusable** across apps (Portal, future web UIs).
- **Change in Portal only** when the UI is **Portal-specific** (single-app layout, admin-only flows).

---

## Build / dev

See [README.md](README.md): `pnpm install`, Storybook or dev commands as documented. Keep **lint/format** consistent with the rest of the monorepo (see root [README.md](../../README.md)).
