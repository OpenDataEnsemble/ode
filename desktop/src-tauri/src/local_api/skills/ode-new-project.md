---
name: ode-new-project
description: Start a new ODE project from scratch for a user who has ODE Desktop but no custom app yet. Creates the user's own copy of the official custom_app template, builds it, and creates an ODE Desktop profile in developer mode pointing at it. Use when the user wants to start a new data collection app or project.
---

# Start a new ODE project

Before running any command, explain what you are about to do, and ask before installing anything.

## 1. Ask for the basics

1. **Project name**, e.g. "Malaria survey 2027". Derive a slug from it, e.g. `malaria-survey-2027`.
2. **Folder.** Propose `~/ODE/<slug>/` and let the user change it. The folder must not exist yet, or must be empty.
3. **Repository visibility.** Propose **private** (the default), or public.

## 2. Check the tools

```sh
gh --version
git --version
```

```sh
node --version
```

The template needs Node.js 22.12+ (or 20.19+) with npm. If Node is missing or too old, ask the user to install the LTS version from https://nodejs.org (`winget install OpenJS.NodeJS.LTS` on Windows, `brew install node` on macOS).

## 3. Create the user's own copy of the template

The template is https://github.com/OpenDataEnsemble/custom_app.

- **`gh` available:** if `gh auth status` says the user is not logged in, ask them to run `gh auth login` first. Then:
  ```sh
  gh repo create <slug> --template OpenDataEnsemble/custom_app --private --clone
  ```
  Run it inside the parent folder (use `--public` if the user chose public), then move or rename the result to the chosen folder if needed.
- **Only `git`:**
  ```sh
  git clone https://github.com/OpenDataEnsemble/custom_app <folder>
  git -C <folder> remote remove origin
  ```
  Tell the user this is a local copy. They can create their own GitHub repository for it later.
- **Neither:** ask the user to install one:
  - GitHub CLI: https://cli.github.com (`winget install GitHub.cli` on Windows, `brew install gh` on macOS).
  - Git: https://git-scm.com.

  Or they can open https://github.com/OpenDataEnsemble/custom_app, click **Use this template**, and clone their new repository into exactly `<folder>`. Alternatively they can download the ZIP and extract it into exactly `<folder>`. Wait until they confirm it is done.

## 4. Build

```sh
npm install
npm run build
```

Run these in `<folder>`. The complete app is written to `<folder>/dist/`. `<folder>/README.md` and `<folder>/AGENTS.md` describe the layout: edit `forms/` and `src/`, never `dist/`.

## 5. Create the ODE Desktop profile

```sh
ode profiles create --label "<project name>" --source <folder>/dist
ode forms validate <folder>/dist/forms
```

The new profile has developer mode on and lets agents manage the app bundle. It can't publish yet: it has no server, and the push permission is off.

## 6. Hand over

Ask the user to:

1. Open ODE Desktop (or switch to it) and select the new profile on the Profiles page.
2. Open Workbench → Custom app and Form preview to try the example app and form.

Then explain the next steps:

- **Changing forms:** use the `ode-edit-form` skill. Edit `<folder>/forms/`, then run `npm run build` and `ode app dev on --profile <id>` after each change.
- **Version control:** commit the changes to the user's repository regularly, if they want that.
- **Publishing:** to publish to devices, the user adds a Synkronus server URL, username, and password to the profile in ODE Desktop, and enables "Allow agents to push the app bundle" if you should publish for them.
