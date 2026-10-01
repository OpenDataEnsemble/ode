# Local tools (`ode` CLI)

`ode` is a headless command-line tool that ships with ODE Desktop. It lets AI assistants, editors (VS Code, Positron), and scripts discover ODE Desktop profiles and form definitions.

ODE Desktop owns the configuration. `ode` only **reads** Desktop's `config.json` and never writes it, so it is safe to run while Desktop is open.

## Permissions

Each profile has a **Local tools** section on the Profiles page:

| Setting                                    | Default | Grants (capability)                                 |
| ------------------------------------------ | ------: | --------------------------------------------------- |
| Available to local tools                   |      On | Profile listing, form definitions (`form_metadata`) |
| Allow agent access to data and attachments |     Off | Observation data and attachments (`data`)           |

- Profiles with local tools turned off are invisible: they are not listed, and requests for them return `profile_not_found`.
- Credentials, server URLs, usernames, and filesystem paths are never returned.
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

### `ode forms show <form-type> --profile <id>`

Returns the raw `schema` (`schema.json`), `uiSchema` (`ui.json`), and `fields`, a flattened list of leaf fields derived only from the schema.

```json
{
  "schemaVersion": 1,
  "profileId": "…",
  "bundle": "active",
  "formType": "household",
  "schema": {},
  "uiSchema": {},
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
      ]
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
