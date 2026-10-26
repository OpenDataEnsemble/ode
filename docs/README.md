# ODE Documentation Site

The ODE documentation site, built with [Docusaurus](https://docusaurus.io/) and published at [opendataensemble.org](https://opendataensemble.org/).

This site lives in the [`OpenDataEnsemble/ode`](https://github.com/OpenDataEnsemble/ode) monorepo under `docs/`. Like the other JavaScript projects in the monorepo, it uses **pnpm**. Run the commands below from this directory.

## Layout

| Path | Purpose |
|------|---------|
| `docs/docs/` | Documentation content (Markdown/MDX). One folder per section: `getting-started/`, `guides/`, `using/`, `reference/`, `community/`, … |
| `docs/static/` | Assets copied verbatim to the site root (`img/`, `fonts/`, `diagrams/`), plus `CNAME` and `.nojekyll` |
| `docusaurus.config.ts` | Site config: navbar, footer, routing, plugins |
| `sidebars.ts` | Sidebar structure (persona-based: For Data Collectors / For Implementers / For Developers) |
| `plugins/` | Remark/rehype link fixups |
| `scripts/validate-docs.ts` | Fast validation run by `pnpm run test` |
| `src/` | Custom React components, theme overrides, and the `/downloads` page |

## Local development

```bash
pnpm install
pnpm start
```

Starts a dev server with hot reload. The site is served at `/`, documentation under `/docs`.

## Validation

Run these before opening a PR — the CI workflow runs the same commands.

```bash
pnpm run test      # fast: docId references, internal links, config paths
pnpm run build     # full: compiles every page, fails on broken links
pnpm run validate  # both of the above
```

`pnpm run build` is the real gate: the site is configured with `onBrokenLinks: 'throw'`, so a broken internal link fails the build rather than shipping.

## Deployment

[`docs.yml`](../.github/workflows/docs.yml) publishes the site to GitHub Pages:

| Trigger | Result |
|---------|--------|
| Pull request to `main` or `dev` touching `docs/**` | Validate and build only |
| Push to `dev` touching `docs/**` | Validate, build, and deploy |
| Manual (`workflow_dispatch`) | Validate and build |

The deployed branch is **`dev`**, so the site reflects the latest merged work rather than the last release. Deploys run with `actions/deploy-pages` and require no secrets.

:::note Versioning
Docusaurus versioning is currently **disabled** (`disableVersioning: true` in `docusaurus.config.ts`, and `versions.json` is empty). There is no version dropdown: every visitor sees the current docs.
:::
