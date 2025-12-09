# Contributing Guide

Thank you for your interest in contributing to the Open Data Ensemble (ODE) project.  
This project follows clear standards for code quality, documentation, and version control.  
Please read the guidelines below before opening a Pull Request or Issue.


## Table of Contents


- [Getting Started](#getting-started)
  - [1. Fork the Repository](#1-fork-the-repository)
  - [2. Create a New Branch](#2-create-a-new-branch)
  - [3. Install Dependencies](#3-install-dependencies)
- [Issue Guidelines](#issue-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
  - [Before Opening a PR](#before-opening-a-pr)
  - [PR Requirements](#pr-requirements)
- [Branch Naming](#branch-naming)
- [Coding Standards](#coding-standards)
  - [Formatting & Style](#formatting--style)
  - [TypeScript / JavaScript](#typescript--javascript)
  - [Testing](#testing)
- [Commit Message Convention](#commit-message-convention)
  - [Format](#format)
  - [Examples](#examples)
  - [Allowed Types](#allowed-types)
  - [Scope (Optional)](#scope-optional)
  - [Rules](#rules)
    - [Subject Line](#subject-line)
    - [Body (Optional)](#body-optional)
    - [Footer (Optional)](#footer-optional)
    - [Breaking Changes](#breaking-changes)
  - [Complete Examples](#complete-examples)
  - [Pull Request Titles](#pull-request-titles)
  - [Benefits](#benefits)
  - [Validation](#validation)
  - [Resources](#resources)
- [Need Help?](#need-help)


---


## Getting Started


### 1. Fork the Repository


Create your own fork and clone it locally:


```bash
git clone git@github.com:OpenDataEnsemble/ode.git
```


or


```bash
git clone https://github.com/OpenDataEnsemble/ode.git
```


### 2. Create a New Branch


Always create a feature or fix branch:


```bash
git checkout -b feature/short-description
```


### 3. Install Dependencies


Follow project instructions (e.g., npm install, pnpm install, etc.).


## Issue Guidelines


Before creating a new issue:


- Search existing issues to avoid duplicates.
- Use the provided Issue Templates.
- Provide clear reproduction steps where relevant.
- Add screenshots or logs when helpful.


## Pull Request Guidelines


### Before Opening a PR


Ensure the following:


- Your PR addresses one logical change.
- Code follows the project structure and style.
- All tests pass locally.
- Documentation is updated if required.


### PR Requirements


All Pull Requests must follow the provided PR template and include:


- A clear description of the change.
- Related issue references (e.g., Closes #123).
- A descriptive title formatted using the [Conventional Commits](#commit-message-convention) rules.


## Branch Naming


Use this naming format:


- `feature/<summary>`
- `fix/<summary>`
- `chore/<summary>`
- `docs/<summary>`
- `refactor/<summary>`


## Coding Standards


### Formatting & Style


- Follow all provided linting rules.
- Run formatters before committing.


Example:


```bash
npm run lint
npm run format
```


### TypeScript / JavaScript


- Prefer functional components and hooks (if React).
- Ensure type safety across all exported modules.
- Keep functions small, testable, and predictable.


### Testing


Before opening a PR:


- Run all tests locally.
- Add tests for new features or bug fixes.
- Ensure no snapshot regressions (if applicable).


## Commit Message Convention


This project uses **Conventional Commits** with enforced structure. This convention ensures clean changelogs, automated versioning, and CI validation.


For more information, see the [Conventional Commits specification](https://www.conventionalcommits.org/).


---


### Format


```
<type>(<scope>): <subject>


[optional body]


[optional footer(s)]
```


**Basic structure:**


```
<type>(optional scope): <short and clear message>
```


### Examples


```
feat(auth): add login endpoint
fix(ui): correct button alignment in navbar
refactor(core): optimize form validation logic
docs: update README installation section
test: add coverage for user service
chore: update dependencies
```


**With body and footer:**


```
feat(api): add user authentication endpoint


Implement JWT-based authentication with refresh token support.
Add rate limiting to prevent brute force attacks.


Closes #123
Refs #456
```


---


### Allowed Types


| Type        | Purpose                                                                 |
|-------------|-------------------------------------------------------------------------|
| `feat`      | A new feature                                                           |
| `fix`       | A bug fix                                                               |
| `docs`      | Documentation only changes                                              |
| `style`     | Changes that do not affect the meaning of the code (formatting, missing semi-colons, etc.) |
| `refactor`  | A code change that neither fixes a bug nor adds a feature              |
| `perf`      | A code change that improves performance                                 |
| `test`      | Adding missing tests or correcting existing tests                      |
| `build`     | Changes that affect the build system or external dependencies          |
| `ci`        | Changes to CI configuration files and scripts                           |
| `chore`     | Other changes that don't modify src or test files                       |
| `revert`    | Reverts a previous commit                                               |


---


### Scope (Optional)


The scope should be a noun describing the section of the codebase affected. Common scopes include:


- `auth` - Authentication and authorization
- `api` - API endpoints and routes
- `ui` - User interface components
- `core` - Core functionality
- `db` - Database changes
- `config` - Configuration files
- `deps` - Dependencies
- `docs` - Documentation
- `test` - Testing infrastructure


**Examples:**


```
feat(auth): add OAuth2 support
fix(api): resolve timeout issue in user endpoint
refactor(ui): simplify component structure
```


---


### Rules


#### Subject Line


- **Use lowercase** for the type (e.g., `feat`, not `Feat` or `FEAT`)
- **Keep it short**: 50 characters or less recommended (72 maximum)
- **Use imperative mood**: Write as if completing the sentence "This commit will..."
  - ✅ "add feature"
  - ❌ "added feature" or "adds feature"
- **No period** at the end of the subject line
- **Capitalize** the first letter of the subject (after the colon)


#### Body (Optional)


- **Separate from subject** with a blank line
- **Wrap at 72 characters** for readability
- **Explain the what and why**, not the how
- **Use imperative mood** (same as subject)
- **Reference issues** using keywords (see below)


#### Footer (Optional)


- **Separate from body** with a blank line
- **Reference issues**: Use keywords like `Closes`, `Fixes`, `Refs`, `Relates to`
  - `Closes #123` - Closes the issue when merged
  - `Fixes #456` - Fixes the issue
  - `Refs #789` - References the issue
  - `Relates to #101` - Related to the issue


#### Breaking Changes


Indicate breaking changes in one of two ways:


1. **In the type**: Add `!` after the type
   ```
   feat(api)!: rename user endpoint
   ```


2. **In the footer**: Add `BREAKING CHANGE:` followed by a description
   ```
   feat(api): update authentication flow
   
   BREAKING CHANGE: The login endpoint now requires OAuth2 instead of basic auth.
   ```


---


### Complete Examples


#### Simple Feature


```
feat(ui): add dark mode toggle
```


#### Feature with Body


```
feat(ui): add dark mode toggle


Dark mode is now available under user settings.
Users can toggle between light and dark themes.


Closes #242
```


#### Bug Fix


```
fix(auth): resolve token expiration issue


Token expiration was not being checked correctly,
causing users to be logged out prematurely.


Fixes #189
```


#### Breaking Change


```
feat(api)!: rename user endpoint


BREAKING CHANGE: The `/api/user` endpoint has been renamed to `/api/users`.
All clients must update their API calls accordingly.


Closes #301
```


#### Documentation Update


```
docs: update installation instructions


Add troubleshooting section for common setup issues.
Include Docker deployment guide.


Refs #156
```


#### Refactoring


```
refactor(core): optimize form validation logic


Extract validation rules into separate utility functions
to improve code reusability and testability.


No functional changes.
```


---


### Pull Request Titles


**Every PR title must follow the same format** as commit messages:


```
feat(auth): implement OAuth2 login
fix(ui): resolve button alignment issue
docs: add deployment guide
```


This ensures consistency across commits and PRs, making it easier to generate changelogs and track changes.


---


### Benefits


Following this convention provides:


- ✅ **Automated changelog generation**
- ✅ **Semantic versioning** based on commit types
- ✅ **Clear project history** that's easy to navigate
- ✅ **CI/CD integration** for validation and automation
- ✅ **Better collaboration** through clear communication


---


### Validation


This project uses commit message validation in CI/CD. Commits that don't follow the convention will be rejected. Make sure to:


1. Review your commit message before pushing
2. Use `git commit --amend` if you need to fix a message
3. Check CI status if your commit is rejected


---


### Resources


- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Git Commit Message Best Practices](https://cbea.ms/git-commit/)


## Need Help?


Create a discussion or issue if you are unsure about any step.


Thank you for contributing and helping improve the project.







