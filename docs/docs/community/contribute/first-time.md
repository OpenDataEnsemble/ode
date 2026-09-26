---
sidebar_position: 2
---

# First Time Contributors

Guide for first-time contributors to ODE.

## Overview

Welcome! We're excited to have you contribute to the OpenDataEnsemble (ODE) project. Whether you want to report bugs, submit features, improve documentation, or contribute code, there's a place for you in our community.

ODE is an open source data collection platform built for offline-first mobile applications. Our codebase is written in TypeScript, Go, and React, and we welcome contributors at all skill levels. You don't need to be an expert—we're here to help new contributors learn and grow.

## Getting Started

### 1. Fork and Clone the Repository

Start by creating your own fork of the ODE repository on GitHub:

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/OpenDataEnsemble.git
cd OpenDataEnsemble

# Add upstream remote
git remote add upstream https://github.com/OpenDataEnsemble/OpenDataEnsemble.git
```

### 2. Set Up Your Development Environment

Depending on which component you want to contribute to.

ODE JavaScript packages use **pnpm** (not npm). Enable the pinned version once per machine:

```bash
corepack enable
corepack prepare pnpm@10.33.2 --activate
```

Build `@ode/tokens` before Formulus or Formplayer. See [Development Setup](/docs/development/setup#package-manager-pnpm).

**For mobile app (Formulus):**
```bash
cd packages/tokens && pnpm install && pnpm run build && cd ../..
cd formulus
pnpm install
pnpm start
```

**For web app (Formplayer):**
```bash
cd packages/tokens && pnpm install && pnpm run build && cd ../..
cd formulus-formplayer
pnpm install
pnpm start
```

**For backend server (Synkronus):**
```bash
cd synkronus
go mod download
go run ./cmd/synkronus
```

For detailed setup instructions, see the relevant component's development guide:
- [Formulus Development](/docs/development/formulus-development)
- [Formplayer Development](/docs/development/formplayer-development)
- [Synkronus Development](/docs/development/synkronus-development)

### 3. Pick an Issue to Work On

Start by browsing our [GitHub Issues](https://github.com/OpenDataEnsemble/OpenDataEnsemble/issues). Look for issues labeled:
- `good-first-issue` - Perfect for newcomers
- `help-wanted` - We're explicitly looking for community help
- `documentation` - Great for improving docs

Comment on the issue to let maintainers know you'd like to work on it. This helps prevent duplicate efforts.

### 4. Create a Feature Branch

```bash
# Update your local main branch
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b fix/bug-description
# or
git checkout -b feature/my-feature-name
```

Use descriptive branch names that clearly indicate what you're working on.

### 5. Make Your Changes

Make your code changes, following these guidelines:

**Code Style:**
- TypeScript/JavaScript: Follow ESLint configuration in the project
- Go: Use `gofmt` and `golint`
- React: Follow component patterns in existing code

**Commits:**
```bash
# Make logical commits with clear messages
git commit -m "fix: resolve issue with sync conflict detection"
git commit -m "docs: add example for dynamic choice lists"
```

Use conventional commit format:
- `fix:` for bug fixes
- `feat:` for new features
- `docs:` for documentation changes
- `refactor:` for code restructuring
- `test:` for adding/updating tests

### 6. Write or Update Tests

If your change affects functionality, write tests:

```bash
# Run tests for your component (from repo root)
cd formulus && pnpm run test --ci --coverage --watchAll=false
cd formulus-formplayer && pnpm run test run
cd synkronus && go test ./...
```

Aim for ~80% code coverage on new code.

### 7. Update Documentation

If you're adding a feature:
- Update relevant docs in `/docs`
- Add code examples if applicable
- Update API documentation if you changed endpoints

See [Form Design Guide](/docs/guides/form-design) if adding form features, or [API Reference](/docs/reference/rest-api/overview) if adding endpoints.

### 8. Submit a Pull Request

```bash
# Push your branch to your fork
git push origin fix/bug-description
```

Go to GitHub and create a Pull Request with:

**Title:** Clear, descriptive title
- Example: "fix: prevent sync conflicts when offline changes diverge"

**Description:** Include:
- What problem does this solve?
- How does your solution work?
- Any relevant issue numbers (e.g., "Closes #123")
- Screenshots or examples if applicable

**Template:**
```markdown
## Description
Briefly describe your changes

## Related Issue
Closes #<issue_number>

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Breaking change

## Testing
How did you test this?

## Checklist
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No breaking changes
```

### 9. Respond to Feedback

Maintainers will review your PR. They may:
- Ask clarifying questions
- Request changes
- Suggest improvements

This is normal and helpful! Push new commits to your branch to update the PR:

```bash
# Make requested changes
git add .
git commit -m "refactor: address review feedback"
git push origin fix/bug-description
```

### 10. Celebrate!

Once your PR is approved and merged, you're officially a contributor! Your code will be included in the next release.

## Next Steps

### After Your First Contribution

**Now that you've contributed:**

1. **Join our community** - Post in our [GitHub Discussions](https://github.com/OpenDataEnsemble/OpenDataEnsemble/discussions) to connect with other contributors
2. **Take on more issues** - Look for the next `good-first-issue` or a `help-wanted` item
3. **Consider becoming a reviewer** - Help review other contributors' PRs
4. **Contribute to discussions** - Help shape the future of ODE by participating in design discussions

### Learning Resources

**Understanding ODE Architecture:**
- [Architecture Overview](/docs/getting-started/architecture-overview)
- [Key Concepts](/docs/getting-started/key-concepts)
- [Data Synchronization](/docs/using/synchronization)

**Technology-Specific Guides:**
- [TypeScript/React Development](/docs/development/contributing)
- [Go Backend Development](/docs/development/synkronus-development)
- [Mobile Development](/docs/development/formulus-development)

**Contributing to Documentation:**
- Documentation lives in the separate [docs](https://github.com/OpenDataEnsemble/docs) repository (Markdown + Docusaurus)
- That site still uses **npm** for its own tooling (`npm install`, `npm start` in the docs repo)
- ODE application code in this monorepo uses **pnpm** (see above)
- Follow the same PR process for doc changes

### Common Tasks for First-Time Contributors

**Documentation:**
- Fix typos and grammar
- Add missing examples
- Clarify unclear sections
- Add FAQ entries

**Code:**
- Fix `good-first-issue` bugs
- Add unit tests for untested code
- Improve error messages
- Optimize performance

**Community:**
- Help answer questions in Discussions
- Improve setup guides
- Create how-to guides for common tasks
- Test release candidates

## Getting Help

**Stuck? Here's how to get help:**

1. **Check existing documentation** - Many answers are in our docs
2. **Search GitHub Issues** - Your question might already be answered
3. **Ask in Discussions** - Post in [GitHub Discussions](https://github.com/OpenDataEnsemble/OpenDataEnsemble/discussions#category_choices)
4. **Ask in your PR** - Comment on your PR with questions
5. **Reach out to maintainers** - We're here to help!

**Please be patient:** Maintainers volunteer their time. We'll respond as soon as we can, but it may take a few days.

## Code of Conduct

All contributors are expected to follow our [Code of Conduct](/docs/community/contribute/code-of-conduct). We're committed to providing a welcoming and respectful environment for everyone.

## Related Content

- [About Contributions](/docs/community/contribute/about)
- [Code of Conduct](/docs/community/contribute/code-of-conduct)

