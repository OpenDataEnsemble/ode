---
sidebar_position: 4
---

# App Bundle Format

Technical specification for ODE app bundle format.

## Overview

App bundles are ZIP archives containing custom application files, form specifications, and configuration. They are uploaded to the Synkronus server and downloaded by mobile devices during synchronization.

## Bundle Structure

Synkronus validates bundles that use **top-level** folders **`app/`**, **`forms/`**, and optionally **`renderers/`**. The **`app`** directory (your HTML/JS/CSS) and the **`forms`** directory (JSON Forms) are **siblings** at the root of the ZIP—they are **not** nested inside each other in the default layout.

```
app-bundle.zip
├── manifest.json           # Bundle metadata (required)
├── app/                    # Web UI (required): sibling of forms/, not parent of it
│   ├── index.html          # Main entry point (required)
│   ├── assets/
│   │   ├── css/
│   │   ├── js/
│   │   │   ├── app.js
│   │   │   └── formulus-load.js
│   │   └── images/
│   └── public/             # Optional: e.g. app.config.json copied into build
├── forms/                  # Form specs (optional; see Form specifications)
│   ├── survey/             # Folder name = form type id
│   │   ├── schema.json
│   │   └── ui.json
│   └── health/
│       ├── schema.json
│       └── ui.json
├── forms/ext.json          # Optional: app-level extensions config
└── renderers/              # Optional: custom JSON Forms renderers
    └── myRenderer/
        └── renderer.jsx
```

**Alternate layout (nested forms):** Some projects put form folders under **`app/forms/<formType>/`** instead of top-level **`forms/<formType>/`**. In that case **`forms`** is a **subdirectory inside `app`** (path `app/forms/...`). That is **different** from having **`app/`** and **`forms/`** as **two separate top-level folders**. Synkronus accepts both; use one style consistently in a given bundle.

## Manifest Format

The `manifest.json` file defines bundle metadata:

```json
{
  "version": "20250114-123456",
  "name": "My Custom App",
  "description": "Description of the custom application",
  "entryPoint": "app/index.html",
  "createdAt": "2025-01-14T10:00:00Z"
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Version identifier (typically timestamp-based) |
| `name` | string | Yes | Application name |
| `description` | string | No | Application description |
| `entryPoint` | string | Yes | Path to main HTML file (relative to bundle root) |
| `createdAt` | string (ISO 8601) | No | Creation timestamp |

## Entry Point

Validated bundles include **`app/index.html`** (path from the **ZIP root**). The manifest **`entryPoint`** should reference that file (commonly `app/index.html`). The entry HTML should:

1. Include the Formulus load script
2. Initialize the application
3. Use the Formulus JavaScript interface

**Example** (paths below assume assets live under `app/assets/`):

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Custom App</title>
  <script src="assets/js/formulus-load.js"></script>
  <link rel="stylesheet" href="assets/css/styles.css">
</head>
<body>
  <h1>My Custom App</h1>
  <script src="assets/js/app.js"></script>
</body>
</html>
```

## Form Specifications

Use a **one-folder-per-form** layout. The **folder name** is the **form type** identifier (for example `survey`, `registration`). Synkronus validates that each form directory contains both required files.

**Folder structure:** **`forms/<formType>/`** at the **root** of the ZIP, as a **sibling** of **`app/`**.

### Required files per form

| File | Role |
|------|------|
| **`schema.json`** | **[JSON Schema](https://json-schema.org/)** (draft-07 in ODE) for the observation payload: properties, types, validation, and ODE-specific **`format`** values for question types. Defines *what* is collected. |
| **`ui.json`** | **[JSON Forms UI schema](https://jsonforms.io/docs/uischema/)** for layout: `VerticalLayout`, `Control` elements, `scope` pointers into the schema, rules, etc. Defines *how* the form is shown. ODE follows JSON Forms with additional rules documented in [Form specifications](/docs/reference/form-specifications). |

Upstream JSON Forms concepts and UI schema structure are described at **[jsonforms.io](https://jsonforms.io/)**. Always cross-check ODE-specific behavior in [Form specifications](/docs/reference/form-specifications)—not every JSON Forms feature is available in Formulus.

**Example paths (two files per form, not one combined JSON) — top-level `forms/` (sibling of `app/`):**

```
forms/
└── survey/
    ├── schema.json
    └── ui.json
```

**Same form type using nested `app/forms/` instead:**

```
app/
├── index.html
└── forms/
    └── survey/
        ├── schema.json
        └── ui.json
```

See [Form specifications](/docs/reference/form-specifications) and [Form design](/docs/guides/form-design) for complete examples of `schema.json` and `ui.json` pairs.

## Versioning

App bundles support versioning:

- Each upload creates a new version
- Versions are identified by timestamp (format: `YYYYMMDD-HHMMSS`)
- Only one version is active at a time
- Mobile devices download the active version during sync

### Version Management

Versions are managed through the API or CLI:

```bash
# List versions
synk app-bundle versions

# Switch active version
synk app-bundle switch 20250114-123456
```

## File Requirements

### Required Files

- `manifest.json`: Bundle metadata
- `app/index.html`: Main entry point (or path given by `entryPoint`)

### Optional Files

- `app/assets/` (or similar under `app/`): CSS, JavaScript, images, and other assets for the web UI
- `forms/<formType>/`: Form specifications at **ZIP root** (sibling of `app/`), **or** `app/forms/<formType>/` if you use the nested layout
- `forms/ext.json`: Optional extensions manifest
- `renderers/`: Optional custom JSON Forms renderers

## File Size Limits

| Component | Limit | Notes |
|-----------|-------|-------|
| **Total bundle size** | 100 MB | Maximum ZIP file size |
| **Individual file** | 50 MB | Maximum size per file |
| **Form specification** | 1 MB | Maximum size per form file (`schema.json` / `ui.json`) |

## Upload Process

### Using CLI

```bash
# Upload bundle
synk app-bundle upload bundle.zip --activate

# Upload with validation skipped (not recommended)
synk app-bundle upload bundle.zip --skip-validation
```

### Using API

```bash
curl -X POST http://your-server:8080/api/app-bundle/push \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "bundle=@bundle.zip" \
  -F "activate=true"
```

## Validation

Before activation, bundles are validated:

1. **Structure validation**: Verifies required files exist
2. **Manifest validation**: Validates manifest.json format
3. **Entry point validation**: Verifies entry point file exists
4. **Form validation**: Validates form specification files (if present)

## Download Process

Mobile devices download app bundles during synchronization:

1. Device requests app bundle manifest
2. Server returns current active version
3. Device checks if it has the active version
4. If not, device downloads bundle files
5. Bundle is extracted and cached locally

## Best Practices

1. **Keep bundles small**: Minimize file sizes for faster downloads
2. **Use relative paths**: All file references should be relative to bundle root
3. **Version consistently**: Use timestamp-based versioning
4. **Test before upload**: Test bundles locally before uploading
5. **Include formulus-load.js**: Always include the Formulus load script
6. **Optimize assets**: Compress images and minify JavaScript/CSS

## Related Documentation

- [Custom Applications Guide](/docs/guides/custom-applications)
- [API Reference](/docs/reference/rest-api/overview)
- [Form Design Guide](/docs/guides/form-design)
- [custom_app on GitHub](https://github.com/OpenDataEnsemble/custom_app) — AI/agent context (`AGENTS.md`, `CONTEXT_*.md`) and **scaffolding** recipes (`npm create vite@latest`, post-build checklist)
