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
