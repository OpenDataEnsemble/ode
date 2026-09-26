# ODE Website

This is the website for ODE. It is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Documentation versioning

The version selector in the navbar (e.g. **ODE 1.1.2**, **Next (unreleased)**) refers to **ODE product versions**, not the version of the docs site itself.

- **ODE 1.1.2, 1.1.0, 1.0** — Frozen snapshots of the docs as they were when that version of ODE was released. Content lives in `versioned_docs/version-1.1.2/` etc.
- **Next (unreleased)** — The current docs you edit in the `docs/` folder. This is what you see when working locally; it becomes the next ODE release docs when you run the versioning command.

When you change files in `docs/`, switch the dropdown to **Next (unreleased)** to see your updates. The default “latest” on the site can be set to the current ODE release (e.g. ODE 1.1.2) so most visitors see stable docs.

To freeze the current `docs/` for a new release (e.g. ODE 1.1.3), run:

```bash
npm run docusaurus docs:version 1.1.3
```

Then update `versions.json` and the config if you want that version to become the default.

## Local Development

```bash
npm install
npm start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Testing

**Always test your changes before pushing to avoid broken links and deployment failures.**

### Quick Validation (Recommended)

Run fast validation tests that catch most issues in seconds:

```bash
npm run test
```

This validates:
- All `docId` references in `docusaurus.config.ts` point to existing files
- Internal markdown links are valid
- Configuration paths are correct

### Full Validation

For complete validation, run the full build:

```bash
npm run build
```

Or run both tests and build:

```bash
npm run validate
```

### Pre-Push Hook

A pre-push hook automatically runs validation tests before you push. If tests fail, the push will be blocked. This helps catch issues early.

To skip the hook (not recommended):

```bash
git push --no-verify
```

⚠️ **Note:** Even if you skip the hook, CI will still validate your changes and block deployment if validation fails.

## Deployment

The website is deployed automatically using GitHub Actions when changes are pushed to the `main` branch. The deployment process:

1. Runs fast validation tests
2. Runs full Docusaurus build
3. Deploys to GitHub Pages (only if all checks pass)

Broken links or validation errors will prevent deployment.
