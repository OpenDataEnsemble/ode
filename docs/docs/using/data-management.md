---
sidebar_position: 4
---

# Data Management

This guide covers viewing, editing, and managing observations in ODE.

## Viewing Observations

Observations can be viewed in the Formulus app:

1. Navigate to the observations list
2. Filter observations by form type, date, or sync status
3. Select an observation to view details
4. Review the form data and metadata

## Editing Observations

To edit an observation:

1. Open the observation from the list
2. Select the edit option
3. Modify the form fields as needed
4. Save your changes

Edited observations are marked for synchronization and will be updated on the server during the next sync operation.

## Deleting Observations

Observations can be deleted:

1. Open the observation
2. Select the delete option
3. Confirm the deletion

Deleted observations are marked as deleted locally and synchronized to the server. The server maintains a record of deleted observations for audit purposes.

## Filtering and Searching

The observations list supports filtering by:

- Form type
- Date range
- Sync status (synced, pending, error)
- Custom criteria based on form data

## Exporting Data

### ODE Desktop (local workspace)

**ODE Desktop** exports from the **active profile’s local SQLite workspace** (offline-friendly; no Synkronus round-trip):

1. Open **Data → Export**.
2. Optionally enable **Include pending observations** and/or **Include attachments**.
3. Choose a parent folder. Desktop creates a dated leaf folder **`YYYYMMDD`** (asks before overwriting).
4. Result layout:

| Path | Contents |
|------|----------|
| `<form_type>.parquet` | One Parquet file per form type (envelope columns + top-level `data_*` fields, plus a `pending` flag) |
| `export_manifest.json` | Export metadata (options, counts, attachment path hints) |
| `snippets/` | Ready-to-run load scripts (`load_r.R`, `load_python.py`, `load_stata.do`, `load_julia.jl`) with variables named after each form type |
| `attachments/` | Present when **Include attachments** is on — flat copies of referenced files |

Attachment fields in observation JSON store **basenames**. Use the workspace attachments path shown on the Export / Profiles pages as a prefix for live workspace files, or the export folder’s `attachments/` path for a self-contained handoff.

Study-specific transforms and pipelines belong in analyst tools (R, Python, etc.), not in Desktop. Desktop’s role is extract.

### Synkronus server (Portal / CLI)

For a full **server-side** dump (all non-deleted observations on Synkronus), use Portal or the CLI. These download a **ZIP**:

**CLI**

```bash
# Parquet ZIP (default) — one <form_type>.parquet per form type inside the archive
synk data export observations.zip

# Nested JSON ZIP
synk data export observations.zip --format json

# Attachments ZIP
synk data export attachments.zip --format attachments
```

**curl**

```bash
curl -X GET http://your-server:8080/api/dataexport/parquet \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-ode-version: YOUR_ODE_VERSION" \
  -o observations.zip
```

**Portal**

1. Open Synkronus Portal (admin).
2. Open the **Data Export** section.
3. Download Parquet, raw JSON, or attachments.

There is **no CSV** export endpoint today; use Parquet (or JSON) and convert in your analysis toolchain if needed.

## Data Synchronization

Observations are synchronized between devices and the server automatically. See [Synchronization](/using/synchronization) for details on how synchronization works.

## Next Steps

- Learn about [synchronization](/using/synchronization) in detail
- Review the [API Reference](/reference/api/endpoints) for programmatic access
- Use ODE Desktop **Export** for local Parquet; use Portal/CLI for server ZIP dumps
