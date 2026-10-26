---
name: ode-edit-form
description: Change an ODE form (questions, choices, skip logic, translations) or custom app in an ODE Desktop profile, validate it, let the user preview it, and publish it to Synkronus after confirmation. Use when the user asks to add, change, or remove questions or skip logic in an ODE form.
---

# Edit an ODE form or custom app

You edit files with your own tools. The `ode` CLI tells you where the files are, checks them, and publishes them. All `ode` output is JSON. Run `ode --help` for every command.

Run `ode` commands one at a time, never in parallel. For example, `app dev on` rewrites Desktop's copy, which a `forms show` running at the same time would read half-updated.

## 1. Find the source folder

```sh
ode profiles list
ode app status --profile <id>
```

- **`sourceFolder`:** the folder you edit. Forms live in `<sourceFolder>/forms/<form_type>/schema.json` and `ui.json`.
- **No `sourceFolder`:** with a downloaded bundle (`activeBundle`), run `ode app checkout --profile <id> --dest <empty folder>`. Without one, use the `ode-new-project` skill.
- **`developerMode: false`:** run `ode app dev on --profile <id>`.
- **`sourceLooksLikeBuildOutput: true`:** the folder is generated, for example `dist/`. Edit the project sources one level up instead: in the ODE template, that's `forms/` and `src/`. Rebuild after each change with the project's documented build command (`npm run build` in the template), then validate `dist/forms`.
- **`permission_denied`:** you may still edit files and run `ode forms validate <folder>`. Tell the user which permission is missing, as named in the message.
- **Never edit these:** anything under ODE Desktop's workspace (`bundles/active`, `bundles/dev-local`).

## 2. Understand the form

```sh
ode forms list --profile <id>
ode forms show <form_type> --profile <id>
```

`fields` lists each question in UI order, with its labels per locale, type, `choices`, `rules` (skip logic), `page`/`group`, and `linkedForm`. To edit, read and change the files in the source folder itself. `--raw` also returns the raw schemas, which is rarely needed.

## 3. Make the change

- **Bump the form version** on every change. Set a top-level `"version"` string in `schema.json`, e.g. `"1"` → `"2"`. If there is none yet, add `"version": "2"`.
- **Never rename or delete fields that may have data**, and never reuse a choice code with a new meaning. Add a new field or a new code instead. Existing exports and analyses depend on these names and codes.
- **Skip logic** goes on the UI element in `ui.json`:
  ```json
  "rule": { "effect": "SHOW", "condition": { "scope": "#/properties/consent", "schema": { "const": "1" } } }
  ```
  - `effect` is one of `SHOW`, `HIDE`, `ENABLE`, `DISABLE`.
  - The condition value must match the field's choice _type_ exactly: `"1"` and `1` are different values.
  - Combine conditions with `{ "type": "AND" | "OR", "conditions": [ ... ] }`.
- **Hiding clears the value.** Never put `SHOW`/`HIDE` on fields whose value must be kept, such as values passed in by the custom app.
- **Conditional questions must not be in the top-level `required`.** If one must be answered whenever it is shown, use `allOf` / `if` / `then` with `required` in `schema.json`.
- **Translations:** when you change a label, update `translations` for every locale already in the form (see https://opendataensemble.org/docs/guides/form-translations).
- **Sub-forms:** a field with `"format": "sub-observation"` needs its `linkedForm` folder to exist in `forms/`.
- **Layout:** keep `SwipeLayout` as the root of `ui.json`. Each page is a layout element inside it.

## 4. Validate

```sh
ode app validate --profile <id>                 # whole app (needs the authoring permission)
ode forms validate <sourceFolder>/forms/<form>  # one form, no permission needed
```

Fix every `error`. Fix `rule_value_not_a_choice` and `missing_version` warnings too.

## 5. Preview

Run `ode app dev on --profile <id>` to refresh Desktop's copy. Then ask the user to open ODE Desktop, select the profile, press **Refresh app**, and try the form in Workbench → Form preview. Wait for their feedback.

## 6. Publish (only with explicit confirmation)

```sh
ode app push --profile <id>          # dry run: validation + list of added/changed/removed forms
ode app push --profile <id> --yes    # publishes and activates on Synkronus
```

1. Show the user the dry-run `changes`, `warnings`, and `serverUrl`.
2. Run `--yes` only after the user explicitly confirms. A push reaches every device on its next sync.
3. If push is not permitted, tell the user how to enable it, or how to publish from ODE Desktop → Workbench → Custom app. Follow the `nextStep` in the output.
4. On `auth_required`, ask the user to save the server URL, username, and password in ODE Desktop → Profiles.

Keep changes small and summarize them in plain language before publishing.
