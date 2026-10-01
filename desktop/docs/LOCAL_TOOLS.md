# Local tools (`ode` CLI)

`ode` is a headless command-line tool that ships with ODE Desktop. It lets AI assistants, editors (VS Code, Positron), and scripts work with ODE Desktop profiles: discover forms, export data, validate form edits, and author and publish custom apps.

ODE Desktop owns the configuration, and `ode` mostly reads it. It writes Desktop's `config.json` in only two narrow ways:

- creating a profile (`ode profiles create`);
- changing the developer-mode fields (`ode app dev`, `ode app checkout`).

Writes are atomic. Desktop merges them into its own state (on window focus, and before it saves), so it never overwrites them. It is safe to run `ode` while Desktop is open.

## Permissions

Each profile has a **Local tools** section on the Profiles page:

| Setting                                                | Default | Grants (capability)                                                                             |
| ------------------------------------------------------ | ------: | ----------------------------------------------------------------------------------------------- |
| Available to local tools                               |      On | Profile listing, form definitions (`form_metadata`)                                             |
| Allow agent access to data and attachments             |     Off | Observation data and attachments (`data`)                                                       |
| Allow agents to manage the app bundle (developer mode) |     Off | `app status` paths, `app checkout`, `app dev`, `app validate`, `app push` dry run (`authoring`) |
| Allow agents to push the app bundle to Synkronus       |     Off | `app push --yes` (`push`). Requires `authoring`.                                                |

- Profiles with local tools turned off are invisible: they are not listed, and requests for them return `profile_not_found`.
- Profiles created by `ode profiles create` start with `authoring` on and `push` off. They have no server, credentials, or data.
- Passwords and tokens are never returned. Server URLs and source folder paths appear only in `app` command output, and only with `authoring`. Other commands never return server URLs, usernames, or workspace paths.
- No flag or environment variable overrides these settings.

## Running

During development (from `desktop/src-tauri/`):

```bash
cargo run -q --bin ode -- profiles list
```

Global option: `--config <path>` to read a different `config.json`. By default, `ode` reads `<OS config dir>/org.opendataensemble.custodian/config.json`.

## Commands

`--profile` accepts a profile id, or a label (case-insensitive) if it matches exactly one profile. Responses always contain the canonical `profileId`.

All output is JSON on stdout and includes `"schemaVersion": 1`. The exit code is `0` on success and `1` on error. Invalid arguments print usage text to stderr and exit with code `2`.

### `ode profiles list`

```json
{
  "schemaVersion": 1,
  "profiles": [
    {
      "id": "…",
      "label": "Study A",
      "active": true,
      "capabilities": ["form_metadata"]
    }
  ]
}
```

### `ode forms list --profile <id>`

`bundle` is `active` for the Synkronus-downloaded bundle, or `dev-local` when the profile has Workbench developer mode on. Developer-mode forms are first-class, including on profiles without a server.

```json
{
  "schemaVersion": 1,
  "profileId": "…",
  "bundle": "active",
  "forms": [{ "formType": "household" }]
}
```

### `ode forms show <form-type> --profile <id> [--raw]`

Returns the form's `title`, `version`, translated `locales`, and `fields`: the questions in UI order, with their labels, choices, skip logic, and placement. The raw `schema` (`schema.json`) and `uiSchema` (`ui.json`) are only included with `--raw` (MCP: `include_raw: true`). They're large and rarely needed.

```json
{
  "schemaVersion": 1,
  "profileId": "…",
  "bundle": "active",
  "formType": "household",
  "title": "Household",
  "version": "2",
  "locales": ["pt"],
  "fields": [
    {
      "path": "head.age",
      "type": "integer",
      "title": "Age",
      "format": null,
      "attachment": false
    },
    {
      "path": "consent",
      "type": "string",
      "title": "Consent",
      "format": null,
      "attachment": false,
      "choices": [
        { "value": "1", "label": "Yes" },
        { "value": "2", "label": "No" }
      ],
      "required": true,
      "labels": { "default": "Consent?", "pt": "Consentimento?" },
      "page": 1
    },
    {
      "path": "nets",
      "type": "integer",
      "title": "Nets",
      "format": null,
      "attachment": false,
      "rules": [
        { "effect": "SHOW", "when": "consent == \"1\"", "on": "Household" },
        { "effect": "SHOW", "when": "has_net == \"1\"" }
      ],
      "page": 2,
      "group": "Household"
    },
    {
      "path": "rooms",
      "type": "array",
      "title": "Rooms",
      "format": "sub-observation",
      "attachment": false,
      "linkedForm": "room"
    }
  ]
}
```

How `fields` is built:

- **Order:** fields appear in the order they are laid out in `ui.json`. Fields that the UI doesn't reference come last, alphabetically.
- **Nesting:** nested objects are flattened to dot-separated paths. Attachment fields (`photo`, `audio`, `video`, `signature`, `select_file`) and arrays are reported as single leaves.
- **`choices`** (when present) lists the coded values from `enum`, or the `const`/`title` entries of `oneOf`/`anyOf`. Local `$ref`s such as `#/$defs/yes_no` are followed. For arrays (multi-select), choices are taken from `items`.
- **`linkedForm`** (when present) is the form type of a sub-observation field. Use it to join exported child tables to their parent table.
- **`rules`:** the skip logic that affects the question. A rule with `on` sits on the enclosing page or group (named by its label, or `page N`). `when` is readable text built from the condition: `==`, `in`, `>=`, `is not empty`, `and`, `or`, and `not`. Conditions it can't express are shown as `<path> matches <schema>`.
- **`labels`:** from `ui.json`. `default` is the base `label`, plus one entry per `translations` locale. If a question has no UI label, use `title`.
- **`required`:** the field is in the top-level `required` list. Requirements in `if`/`then` aren't reflected.
- **`page` / `group`:** the 1-based page in a `SwipeLayout` root, and the nearest labelled layout.

The export manifest's `fields` contain the same information.

### `ode data export --profile <id> --form <form-type> --destination <dir>`

Requires **Allow agent access to data and attachments**. Exports the observations of the given forms from the profile's local database to `<dir>/<YYYYMMDD>/`. `<dir>` must already exist.

- `--form` is required and can be repeated.
- `--include-pending` adds observations that are not yet synced.
- `--include-attachments` copies referenced files into `attachments/`.
- `--overwrite` replaces an existing folder for today.
- `--no-progress` silences the progress lines on stderr.
- The database is opened read-only, so the command is safe to run while Desktop is open.

```json
{
  "schemaVersion": 1,
  "profileId": "…",
  "exportDir": "C:\\analysis\\20261001",
  "manifest": "C:\\analysis\\20261001\\export_manifest.json",
  "parquetFiles": { "household": "C:\\analysis\\20261001\\household.parquet" },
  "formTypeCounts": { "household": 120 },
  "totalRows": 120,
  "includePending": false,
  "includeAttachments": false,
  "attachmentsCopied": 0,
  "attachmentsMissing": 0,
  "formsWithoutRows": []
}
```

- Unknown form types (in neither the bundle nor the data) fail with `form_not_found`.
- Forms that exist but have no exportable observations are listed in `formsWithoutRows`.

#### Export folder

Exports written by the CLI and by the Desktop Export page have the same layout:

- `<form_type>.parquet`: envelope columns plus a `data_<field>` column for each top-level field.
- `export_manifest.json`: see below.
- `snippets/`: load scripts for R, Python, Stata, and Julia, each starting with the agent hint.
- `attachments/`: only present with `--include-attachments`.

`export_manifest.json` (`schemaVersion: 1`) is portable. Its paths are relative to the export folder, and it contains no workspace, database, or server details:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-10-01T10:00:00+00:00",
  "exporterVersion": "1.3.3",
  "includePending": false,
  "includeAttachments": false,
  "profileId": "…",
  "profileLabel": "Study A",
  "formTypeCounts": { "household": 120 },
  "totalRows": 120,
  "attachmentsCopied": 0,
  "attachmentsMissing": 0,
  "attachmentsDir": null,
  "forms": [
    {
      "formType": "household",
      "rows": 120,
      "parquet": "household.parquet",
      "fields": [
        {
          "path": "consent",
          "type": "string",
          "title": "Consent",
          "format": null,
          "attachment": false,
          "choices": [{ "value": "1", "label": "Yes" }],
          "column": "data_consent"
        }
      ]
    }
  ],
  "notice": "This export may contain sensitive personal data. …"
}
```

- `fields` has the same shape as in `forms show`, plus `column`, the Parquet column that holds the value.
- Nested fields such as `head.age` live inside the JSON string in `data_head`.
- `fields` is empty for forms that are no longer in the bundle.

### `ode forms validate <path>`

Checks form files on disk before previewing or publishing them. `<path>` is either one form folder (containing `schema.json` and `ui.json`) or a folder of form folders, in which case every form in it is validated.

- This command needs no profile and no permission.
- Linked forms (`linkedForm`) count as present when a sibling folder of that name exists.
- The exit code is `1` when any form has an error. Warnings don't fail validation.

```json
{
  "schemaVersion": 1,
  "valid": false,
  "forms": [
    {
      "formType": "household",
      "dir": "forms/household",
      "valid": false,
      "diagnostics": [
        {
          "severity": "error",
          "code": "invalid_scope",
          "file": "ui.json",
          "path": "/elements/0/elements/1/scope",
          "message": "Scope \"#/properties/lbl_agregado_familar\" does not match a property in schema.json."
        }
      ]
    }
  ]
}
```

`path` is a JSON pointer into `file`.

| Code                                                                  | Severity | Meaning                                                                                                                     |
| --------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `missing_file`, `invalid_json`                                        | error    | `schema.json` / `ui.json` is missing or not JSON                                                                            |
| `invalid_schema`                                                      | error    | `schema.json` doesn't compile as a JSON Schema (draft 7)                                                                    |
| `unknown_required`                                                    | error    | `required` lists a property that doesn't exist                                                                              |
| `missing_linked_form`                                                 | error    | A sub-observation `linkedForm` isn't in the forms folder                                                                    |
| `missing_type`, `missing_scope`                                       | error    | A UI element has no `type`, or a Control has no `scope`                                                                     |
| `invalid_scope`                                                       | error    | A Control scope doesn't resolve to a schema property. `$ref`, `allOf`/`anyOf`/`oneOf`, and `if`/`then`/`else` are followed. |
| `invalid_rule_effect`                                                 | error    | A rule effect isn't `SHOW`, `HIDE`, `ENABLE`, or `DISABLE`                                                                  |
| `missing_rule_condition`, `missing_rule_schema`, `invalid_rule_scope` | error    | A rule condition is incomplete or points to an unknown field. Composite `conditions` are checked recursively.               |
| `rule_value_not_a_choice`                                             | warning  | A condition's `const`/`enum` isn't one of the field's coded choices (e.g. `1` vs `"1"`)                                     |
| `missing_version`, `version_mismatch`, `version_not_string`           | warning  | Add a string `version` and bump it on every change. If both `schemaVersion` and `version` are set, `schemaVersion` wins.    |
| `root_not_swipe_layout`                                               | warning  | ODE forms should use `SwipeLayout` as the root                                                                              |

Not checked yet: custom question types and renderers, extension functions, and translations. Some of these need the whole app bundle and are planned for `ode app validate`.

### `ode profiles create --label <name> [--source <dir>]`

Creates a local profile like Desktop's **Add profile**, with no server. It doesn't make the profile active. With `--source` (a folder containing `index.html`), developer mode is turned on for that folder, and Desktop's copy is refreshed. Labels must be unique.

### `ode app ...` (custom app authoring)

Agents edit the profile's **source folder** (`sourceFolder`). Forms live in `<source>/forms/<form_type>/`. Never edit Desktop's `bundles/active/` or `bundles/dev-local/`.

| Command                                           | Does                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app status --profile <id> [--check-server]`      | Shows capabilities, developer mode, the last downloaded bundle version (`activeBundle`), and whether a server and saved credentials exist. With `authoring` it adds the source folder (flagged when it looks like build output), plus `hints`. `--check-server` logs in and adds `serverVersion`.                                                     |
| `app checkout --profile <id> --dest <dir>`        | Copies the downloaded bundle into an empty folder, then turns developer mode on for it.                                                                                                                                                                                                                                                               |
| `app dev on\|off --profile <id> [--source <dir>]` | `on` refreshes Desktop's copy of the source folder. In Desktop, press **Refresh app** to see the changes.                                                                                                                                                                                                                                             |
| `app validate --profile <id>`                     | Checks that `index.html` exists, then runs `forms validate` on `<source>/forms`. The exit code is `1` on errors.                                                                                                                                                                                                                                      |
| `app push --profile <id> [--yes]`                 | Refreshes, validates, and diffs the forms against the last downloaded bundle (`changes`, and `warnings` for un-bumped versions and removed forms). Without `--yes` it is a dry run. With `--yes` (`push`) it logs in with the profile's username and saved password, publishes, and activates the bundle. The exit code is `1` when validation fails. |

Publishing needs a server URL, username, and saved password on the profile; otherwise it returns `auth_required`. The `x-ode-version` header is the CLI's version. Agents must get the user's explicit confirmation before `--yes`.

### `ode skills list | show <name> | install --dest <dir> [--force]`

Step-by-step guides as Agent Skills (`SKILL.md`), versioned with the CLI. The sources are in `src-tauri/src/local_api/skills/`.

- `ode-edit-form`: change forms and skip logic, validate, preview, then publish after confirmation.
- `ode-new-project`: start from the `custom_app` GitHub template and create a profile in developer mode. This needs the runnable template (Phase 5 of `TMP_AI_PROTOTYPE.md`).

`show` prints Markdown. `install` writes `<dest>/<name>/SKILL.md`, for example into `.agents/skills`, and skips files that were edited unless `--force` is passed.

### `ode mcp` (Model Context Protocol server)

Runs the same operations as an MCP server over stdio: newline-delimited JSON-RPC 2.0, MCP protocol revisions 2024-11-05 to 2025-11-25.

- **Tools:**
  - `ode_list_profiles`, `ode_list_forms`, `ode_show_form`, `ode_validate_forms`;
  - `ode_export_data`;
  - `ode_app_status`, `ode_app_checkout`, `ode_app_dev`, `ode_app_validate`, `ode_app_push` (`publish: true` publishes);
  - `ode_create_profile`, `ode_list_skills`, `ode_get_skill`.
- **Same rules as the CLI:** permissions, JSON shapes (in `structuredContent`), and errors (`isError: true` plus `error`) are identical to the CLI.
- **Discovery:** every tool is always listed, and calls that aren't allowed return `permission_denied`. Desktop's config is re-read on every call, so permission changes apply without restarting the client.
- **Annotations:** tools are marked read-only or destructive (`ode_app_push`). The server `instructions` tell the client to publish only after the user's explicit confirmation.

The server is hand-rolled (`local_api/mcp.rs`) rather than built on the `rmcp` SDK, because it needs only `initialize`, `ping`, `tools/list`, and `tools/call`.

Client configuration. **Copy MCP server config** on the Profiles page copies this with the real path:

```json
{ "mcpServers": { "ode": { "command": "<path to ode>", "args": ["mcp"] } } }
```

This format works for Claude Desktop, Cursor, and similar clients. Zed uses the same `command`/`args` under `context_servers` in its settings, and VS Code uses them under `servers` in `.vscode/mcp.json`.

## Errors

```json
{
  "schemaVersion": 1,
  "error": {
    "code": "permission_denied",
    "message": "…",
    "capability": "data",
    "profileId": "…"
  }
}
```

Possible error codes:

- `config_not_found`
- `config_invalid`
- `profile_not_found`
- `workspace_not_found`
- `form_not_found`
- `permission_denied`
- `invalid_argument`
- `auth_required`
- `network`
- `io`

## Discoverability for agents

- **Initial prompt:** under Profiles → Local tools, **Copy initial prompt for AI assistant** copies a prompt the user can paste into an assistant. It contains the CLI path, the profile id and label, and the profile's data-access rules.
- **Export snippets:** when the profile is available to local tools, load snippets start with a comment that points to `ode forms list` / `ode forms show`. This applies to the snippet shown on the Export page and to the `snippets/` files written into the export, in R, Python, Stata, and Julia. An agent that opens an analysis script therefore finds the CLI without any prompt.
- **CLI path:** Desktop looks for `ode` / `ode.exe` next to its own executable (Tauri command `get_local_tools_cli_path`). If it isn't found, the prompt and snippets fall back to plain `ode`.

Keep the hint text in sync in two places: Rust `local_api::hint_lines` (snippet files) and TS `localToolsHintLines` in `src/lib/localTools.ts` (Export page).

## Code

- `desktop/src-tauri/src/local_api/`: shared operations and policy (`config`, `policy`, `profiles`, `forms`). Tauri commands such as `list_active_bundle_forms` and `read_bundle_form_spec` delegate to this module.
- `desktop/src-tauri/src/bin/ode.rs`: CLI adapter (`clap`).
- `desktop/src/components/LocalToolsPanel.tsx`: profile settings UI.

Plan and later phases (data export, form validation, `ode mcp`): see `TMP_AI_PROTOTYPE.md` at the repository root.
