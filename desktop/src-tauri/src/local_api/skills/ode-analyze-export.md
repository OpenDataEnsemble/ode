---
name: ode-analyze-export
description: Export ODE observation data to Parquet and analyze it in R, Python, Stata, or Julia, using export_manifest.json as the data dictionary. Use when the user wants to analyze, summarize, or load collected ODE data.
---

# Analyze exported ODE data

The data is collected from real people and is usually **sensitive personal data**:

- Only read what the task needs.
- Prefer aggregates over individual records.
- Never paste raw records, names, or attachments into a response, or send them to external services, unless the user explicitly asks.

## 1. Get an export

If the user already has an export folder (it contains `export_manifest.json`), use it. Otherwise:

```sh
ode profiles list                          # needs the "data" capability
ode data export --profile <id> --form <form_type> [--form <sub_form> ...] --destination <existing folder>
```

On `permission_denied`, ask the user to enable "Allow agent access to data and attachments" in ODE Desktop → Profiles → Local tools, or to export from ODE Desktop → Export. Add `--include-pending` only if the user wants unsynced records.

## 2. Read the data dictionary

`export_manifest.json` has the following:

- **`forms[]`:** each form's `parquet` file and its row count.
- **`fields[]`:** each field has:
  - `column`: the Parquet column;
  - `labels` / `title`: the question text;
  - `choices`: code → label;
  - `rules`: when the question was asked;
  - `linkedForm`: for sub-forms.

Use it to label variables and to decode coded answers. Codes are what's stored, so map them to labels for display.

## 3. Load

The `snippets/` folder has ready load scripts: `load_r.R`, `load_python.py`, `load_stata.do`, and `load_julia.jl`.

Columns:

- **Envelope:** `observation_id`, `form_version`, `created_at`, `updated_at`, `author`, `device_id`, `pending`, and more.
- **Answers:** `data_<field>`. Nested objects and arrays are JSON strings; parse them when needed.

## 4. Analysis tips

- **Missing ≠ unanswered:** questions hidden by skip logic are cleared. Check `rules` before treating missing values as non-response.
- **Versions:** `form_version` tells which version of the form produced a row. Questions added later are missing for older rows.
- **Sub-forms:** a field with `linkedForm` connects parent and child forms, each in its own Parquet file. Inspect both tables to confirm the join key (for example ids stored in the parent's sub-observation column) before joining. Don't assume.
- **Unit of analysis:** state it for every result (household, room, person).
