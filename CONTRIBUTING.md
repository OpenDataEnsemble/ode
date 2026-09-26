# Contributing to ODE

Thanks for wanting to help out. ODE is a young project and the community keeps it moving, so whether you're here to write code, fix docs, test the platform, or just share how you use it, you're welcome.

This guide covers the practical stuff: how to report problems, how to set up a local environment, and what we expect from pull requests. If you haven't already, read the [README](README.md) for an overview of the project and what the ensemble (formulus, formplayer, synkronus, and friends) actually is.

## What you can help with

There is more than one way to contribute:

- **Code** - fix bugs, build features, or start with the [issue tracker](https://github.com/OpenDataEnsemble/ode/issues) and look for `good first issue` or `help wanted` labels.
- **Documentation** - the docs always need polish, both here and on [opendataensemble.org](https://opendataensemble.org/). If a section is confusing or outdated, improve it.
- **Testing and feedback** - run the apps, sync data, and report what breaks or what feels rough.
- **Community** - help other users on the [forum](https://forum.opendataensemble.org/), answer questions, and share how ODE works in your own way.

## Before you start

- **Questions go to the forum, not issues.** If you're trying to understand how something works or how to set it up, ask on the [community forum](https://forum.opendataensemble.org/). Issues are for bugs and concrete change requests.
- **Talk first for anything significant.** If you want to build a new feature, do a big refactor, or change behavior, open an issue first and describe your idea before writing code. A short conversation up front saves you from building the wrong thing.
- **Be patient with people.** ODE welcomes contributors of all skill levels. Be kind, explain things, and assume good intent.

## Setting up a development environment

This is a monorepo, so the setup depends on the project you're touching. The full instructions live in each project's README and `AGENTS.md`; here's the short version.

### Prerequisites

- [git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) with [Corepack](https://nodejs.org/api/corepack.html) enabled (we use `pnpm`)
- [Go](https://go.dev/) for the Synkronus backend and CLI
- [Rust](https://www.rust-lang.org/) if you're working on ODE Desktop

### Get the code

1. [Fork the ode monorepo on GitHub](https://github.com/OpenDataEnsemble/ode/fork).
2. Clone your fork and add the upstream remote:

   ```bash
   git clone https://github.com/<your-username>/ode.git
   cd ode
   git remote add upstream https://github.com/OpenDataEnsemble/ode.git
   ```

3. Create a branch for your work, based on the latest `dev` (the default branch):

   ```bash
   git fetch upstream
   git switch -c my-change upstream/dev
   ```

4. When ready, push the changes to your for and create a PR from GitHub

   ```bash
   git push -u origin my-change
   ``` 

### Per-project setup

**Tip:** in a fresh clone, install the design tokens first, then formplayer and the shared components because they depend on tokens being built.

- **formulus** - React Native mobile app. See `formulus/README.md` (and the `formulus/AGENTS.md` pre-flight checklist). Lint/format: `cd formulus && pnpm run lint`, `pnpm run format:check`.
- **formulus-formplayer** - form UI in a WebView (React). See `formulus-formplayer/README.md`. Run it with `cd formulus-formplayer && pnpm start`.
- **synkronus** - Go backend. See `synkronus/README.md` (Development Setup) and `synkronus/DOCKER.md`.
- **synkronus-cli** - Go command-line client. See `synkronus-cli/README.md`; pre-flight is `cd synkronus-cli && go build ./cmd/synkronus`.
- **synkronus-portal** - web admin UI (React). See `synkronus-portal/README.md` for both Docker and Dockerless setups.
- **desktop** - Tauri app. See `desktop/README.md` (Quick start).
- **docs** - public Docusaurus site under `docs/`. It is an independent **npm** project (`cd docs && npm install && npm start`); do not use pnpm there. See `docs/README.md`.
- **packages/tokens** and **packages/components** - see `packages/tokens/CONTRIBUTING.md` and `packages/components/CONTRIBUTING.md`.

The quickest cheat sheet for any package is its `AGENTS.md` file - it lists the day-to-day commands and exactly what to run before a pull request.

## Making changes

- **Keep a pull request focused.** One logical change per PR. If you notice something unrelated, open a separate issue instead of folding it in.
- **Follow the conventions of the project you're in.** Match the style of the surrounding code, use the existing helpers and libraries, and reach for shared tokens and components where they already exist.
- **Run the checks before you push.** Every package has lint, format, and test commands — run them locally so CI isn't the first to catch problems. Each package's `README.md` / `AGENTS.md` lists the exact commands.
- **Add or update tests** for new behavior, and update the docs if your change alters how something works.

### Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). Keep messages short and specific:

```
feat(formulus): add draft delete confirmation
fix(synkronus): handle missing user on refresh
docs(portal): clarify env var setup
```

The scope is usually the package or area you touched (`formulus`, `formplayer`, `synkronus`, `portal`, `tokens`, `docs`, and so on), and the message should say what changed and why.

## Opening a pull request

1. **Run the pre-flight checks** for every package you changed. The per-package `AGENTS.md` files document these (typically lint, format, format:check, and tests - sometimes typecheck or build too).
2. **Use the [pull request template](.github/pull_request_template.md).** The PR title must be a valid Conventional Commit, and the description should explain how the change works and why it's needed.
3. **Link the issue** you're working on with `Closes #123` so it closes automatically when the PR is merged.
4. **Open a draft PR** if the work is still in progress, then mark it ready for review when it's complete.
5. **Watch the CI status.** Check that the workflows for your change pass; a failing check is usually quick to fix.

After you open the PR, a maintainer will review it. Expect feedback and a round or two of changes - that's a normal part of the process, not a rejection. Stick around to answer questions and push updates to the same branch.

## Reporting bugs and security issues

### Bugs and feature requests

Search the [issue tracker](https://github.com/OpenDataEnsemble/ode/issues) for existing reports first, then use the [issue templates](.github/ISSUE_TEMPLATE/) — they describe exactly what to include. For a bug report that means what you did, what you expected, and what happened instead, plus which component and version.

### Security vulnerabilities

**Do not report security issues through public issues.** Follow [SECURITY.md](SECURITY.md) and email `security@opendataensemble.org` instead. Reporting privately means the problem isn't exposed publicly before a fix exists, and we respond quickly.

## License

The repository is [MIT](LICENSE) licensed, with one exception: `synkronus-cli` is currently **GPL-2.0-or-later** while it depends on a GPL-classified QR library - see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details. Contributions land under the license of the project they're in.

## Getting help

- [Community forum](https://forum.opendataensemble.org/) — questions, ideas, and general discussion.
- [opendataensemble.org](https://opendataensemble.org/) — project site and documentation.
- [Repository on GitHub](https://github.com/OpenDataEnsemble/ode) — issues, discussions, and releases.

Every contribution, big or small, is what keeps ODE moving. Thanks for joining the ensemble.
