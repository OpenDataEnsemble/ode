---
sidebar_position: 2
---

# Custom Applications

Complete guide to building and deploying custom applications that integrate with ODE.

> **Getting started?** Start with our hands-on [Building Custom Apps](../guides/building-custom-apps.md) tutorial, which walks you through a complete example (Coffee Tracker) from scratch. This reference covers more advanced patterns.

## Overview

Custom applications are **web applications** (HTML, CSS, and JavaScript) that run inside the Formulus mobile app’s WebView.

:::note ODE monorepo vs your custom app
The **ODE repository** (Formulus, Formplayer, Synkronus Portal, design packages) uses **pnpm** — see [Development Setup](/docs/development/setup#package-manager-pnpm). **Your** custom app project can use **npm**, **pnpm**, or **yarn**; the examples below use common **npm** script names from the [custom_app](https://github.com/OpenDataEnsemble/custom_app) template.
::: You may author them with **any** stack—plain static files, **Vite**, **React**, **Vue**, **Svelte**, or another bundler—**as long as the build output** can be packaged as described in the [app bundle format](/docs/reference/app-bundle-format) (entry HTML, assets, and `forms/` layout). They provide specialized workflows, custom navigation, integration with the ODE form system, and interfaces tailored to your use case.

## Profile-aware browser storage

Formulus hosts each custom app for the active **profile**. Users add and switch profiles in the in-app **Profiles** screen; the host remounts the WebView when switching. The host scopes observations, attachments, bundle files, and Formplayer drafts to the active profile. Custom apps should use the synchronous profile-aware browser storage reference after the bridge is ready:

```javascript
const api = await getFormulus();
const profileId = api.getProfileId(); // stable for this WebView; not the display name
const storage = api.getLocalStorageRef();
storage.setItem('lastTab', 'home');
const lastTab = storage.getItem('lastTab');
storage.removeItem('lastTab');
// storage.clear() removes only this profile's custom-app keys.
```

The reference uses physical keys `ode:{profileId}:app:{key}`. Both helpers are synchronous, and storage errors propagate. Do **not** use raw `localStorage` for profile-specific state: custom apps and dependencies loaded under a shared `file://` origin may read or write raw storage outside the namespace. This is organizational/storage namespacing, **not a sandbox or confidentiality boundary**; deleting a profile cannot guarantee removal of unrelated third-party raw keys. Depending on WebView file-access settings and device behavior, code in a custom app or form extension may also read other profiles' data or attachments via file access. A connected Synkronus server can distribute app bundles containing code; not every server necessarily does so. Connect only to trusted servers and install only trusted bundles. Do not store secrets in browser storage. See the [Formulus bridge reference](../reference/formulus.md#getprofileid-and-getlocalstorageref).

## Scaffolding

ODE does **not** require a special installer: start from a **standard** project scaffold (for example **`npm create vite@latest`** with React, Svelte, or Solid templates) and then align the **folder layout** with the app bundle spec. Copy-paste commands, a **Vite `outDir` example**, and a post-scaffold checklist are maintained in the **[custom_app](https://github.com/OpenDataEnsemble/custom_app)** repository README on GitHub (AI and author context for the Formulus API and forms live in that repo as well).

## Application Structure

There is **no single mandatory** project layout. The tree below is **one** common pattern (React + Vite + optional `app.config.json` for theming). You can use a simpler folder tree if you prefer hand-written HTML/JS or a different framework, provided the **zip** you upload matches the [bundle format](/docs/reference/app-bundle-format).

```
my-app/
├── app.config.json          # Optional: app metadata and theme (if your template uses it)
├── forms/                   # Form definitions (see bundle format)
│   ├── survey/              # One folder per form type (form name)
│   │   ├── schema.json      # JSON Schema (draft-07)
│   │   └── ui.json          # JSON Forms UI schema (ODE rules)
│   └── forms-manifest.json  # Form registry (if used by your project)
├── src/                     # Optional: only if you use a bundler (e.g. React)
│   ├── components/
│   ├── screens/
│   ├── utils/
│   └── theme.js
├── scripts/
├── package.json             # Optional: if you use npm tooling
└── vite.config.js           # Optional: example bundler config
```

## Configuration System

### app.config.json

If your template uses **`app.config.json`** (common in React-based examples), it can hold application metadata and theme. Plain HTML apps may omit it and configure styling in CSS/JS instead. When present, it is typically the single place for those settings:

```json
{
  "name": "My Application",
  "version": "1.0.0",
  "navigation": {
    "tabs": ["Home", "Forms", "Sync", "More"]
  },
  "theme": {
    "light": {
      "primary": "#1976d2",
      "primaryLight": "#42a5f5",
      "primaryDark": "#1565c0",
      "onPrimary": "#ffffff",
      "background": "#fafafa",
      "surface": "#ffffff",
      "onBackground": "#212121",
      "onSurface": "#424242"
    },
    "dark": {
      "primary": "#42a5f5",
      "primaryLight": "#90caf9",
      "primaryDark": "#1976d2",
      "onPrimary": "#000000",
      "background": "#121212",
      "surface": "#1e1e1e",
      "onBackground": "#ffffff",
      "onSurface": "#e0e0e0"
    }
  },
  "observationIndexes": [
    { "key": "patient_id", "path": "$.patient_id" },
    { "key": "site_code", "path": "$.site_code", "formTypes": ["visit_*"] }
  ]
}
```

`observationIndexes` declares **local-only** SQLite indexes for fast `getObservationsByQuery` filters on `data.*` fields. They are maintained on the device and are **not synced**. See [Observation queries](./observation-queries.md).

### Theme Integration

Themes are automatically generated from your configuration:

```javascript
// src/theme.js
import { createTheme } from '@mui/material/styles';
import appConfig from '../public/app.config.json';

export function buildTheme(mode = 'light') {
  const colors = appConfig.theme[mode] ?? appConfig.theme.light;
  
  return createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary,
        light: colors.primaryLight,
        dark: colors.primaryDark,
        contrastText: colors.onPrimary,
      },
      background: {
        default: colors.background,
        paper: colors.surface,
      },
      // ... complete theme configuration
    },
  });
}
```

## Form Development

### Form Structure

Each form is a **directory** named with the **form type** (for example `survey/`). Inside it, two files are required:

1. **`schema.json`**: [JSON Schema](https://json-schema.org/) (draft-07) defining data shape, validation, and question types (including ODE `format` values). See [Form specifications](/docs/reference/form-specifications).
2. **`ui.json`**: [JSON Forms](https://jsonforms.io/) **UI schema** defining layout (`VerticalLayout`, `Control`, `scope`, rules). ODE follows JSON Forms with project-specific rules—see [Form specifications](/docs/reference/form-specifications). The [app bundle format](/docs/reference/app-bundle-format) describes how these files sit inside the zip.

Synkronus accepts **`forms/<formType>/schema.json`** and **`ui.json`** at the **bundle root** (with **`forms/`** as a **sibling** of **`app/`**), or the alternate path **`app/forms/<formType>/...`** where **`forms`** sits **inside** **`app`**. See [App bundle format](/docs/reference/app-bundle-format).

### Example Form

**schema.json:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "title": "Full Name"
    },
    "age": {
      "type": "integer",
      "title": "Age",
      "minimum": 0,
      "maximum": 120
    },
    "email": {
      "type": "string",
      "title": "Email",
      "format": "email"
    }
  },
  "required": ["name", "age"]
}
```

**ui.json:**
```json
{
  "type": "VerticalLayout",
  "elements": [
    {
      "type": "Control",
      "scope": "#/properties/name"
    },
    {
      "type": "Control",
      "scope": "#/properties/age"
    },
    {
      "type": "Control",
      "scope": "#/properties/email"
    }
  ]
}
```

## Form Integration

### Opening Forms

Use the Formulus API to open forms:

```javascript
import { openForm } from './utils/formulusApi';

async function handleFormSubmit() {
  try {
    const result = await openForm('survey', {
      mode: 'create',
      initialData: {}
    });
    
    if (result.status === 'completed') {
      console.log('Form data:', result.data);
      // Handle successful submission
    }
  } catch (error) {
    console.error('Form error:', error);
  }
}
```

### Mock API for Development

During development, a mock API provides realistic behavior without needing the mobile app:

```javascript
// src/utils/mockFormulusApi.js
export class MockFormulusAPI {
  async openForm(formId, options = {}) {
    // Simulate form opening with mock data
    return {
      status: 'completed',
      data: { /* mock form data */ }
    };
  }
}
```

## Build Process

### Package.json Scripts

```json
{
  "scripts": {
    "copy-forms": "node scripts/copy-forms.js",
    "dev": "npm run copy-forms && vite",
    "build": "npm run copy-forms && vite build",
    "zip": "node scripts/build-zip.js",
    "validate:forms": "node scripts/validate-forms.js"
  }
}
```

### Build Scripts

**scripts/copy-forms.js:**
```javascript
import fs from 'fs-extra';
import path from 'path';

const sourceDir = path.join(process.cwd(), '..', 'forms');
const targetDir = path.join(process.cwd(), 'public', 'forms');

fs.copy(sourceDir, targetDir)
  .then(() => console.log('Forms copied successfully'))
  .catch(err => console.error('Error copying forms:', err));
```

**scripts/build-zip.js:**
```javascript
import AdmZip from 'adm-zip';
import path from 'path';

const zip = new AdmZip();
const buildDir = path.join(process.cwd(), '..', 'app-bundles', 'app');
const formsDir = path.join(process.cwd(), '..', 'forms');

zip.addLocalFolder(buildDir, 'app');
zip.addLocalFolder(formsDir, 'forms');

zip.writeZip(path.join(process.cwd(), '..', 'bundle-v1.0.0.zip'));
```

## Form Validation

### Validation Script

**scripts/validate-forms.js:**
```javascript
import Ajv from 'ajv';
import fs from 'fs-extra';

const ajv = new Ajv();

function validateForm(formPath) {
  const schema = fs.readJsonSync(path.join(formPath, 'schema.json'));
  const uiSchema = fs.readJsonSync(path.join(formPath, 'ui.json'));
  
  // Validate JSON Schema
  const validate = ajv.compile(schema);
  
  // Validate UI schema references
  // ... validation logic
  
  return { valid: true, errors: [] };
}
```

## Development Workflow

### Local Development

1. **Setup**: `npm install`
2. **Development**: `npm run dev` (includes form copying)
3. **Validation**: `npm run validate:forms`
4. **Build**: `npm run build && npm run zip`

### Testing Forms

Use the built-in form explorer to test forms locally:

```javascript
// Navigate to http://localhost:5173/#/forms
// Browse and test all forms with mock data
```

## Deployment

### Bundle Creation

1. Build the application: `npm run build`
2. Create deployment bundle: `npm run zip`
3. Upload bundle to Synkronus server
4. Deploy to mobile devices via sync

### Version Management

Update the version in `app.config.json` and `package.json`:

```json
{
  "version": "1.1.0"
}
```

Bundle filename will automatically reflect the version: `bundle-v1.1.0.zip`

## Best Practices

### Form Design
- Use clear, descriptive field titles
- Implement proper validation rules
- Provide helpful error messages
- Consider offline usage scenarios

### Performance
- Optimize bundle size (target < 200KB)
- Use lazy loading for large forms
- Implement efficient data structures
- Test on target devices

### User Experience
- Follow Material Design 3 guidelines
- Implement consistent navigation
- Provide clear feedback for actions
- Handle errors gracefully

### Code Organization
- Separate concerns (UI, logic, data)
- Use TypeScript for type safety
- Implement proper error handling
- Write maintainable, documented code

## Troubleshooting

### Common Issues

**Forms not appearing:**
- Verify forms are copied to `public/forms/`
- Check `forms-manifest.json` format
- Validate form schemas

**Build failures:**
- Ensure all dependencies are installed
- Check form validation errors
- Verify configuration syntax

**Deployment issues:**
- Confirm bundle size limits
- Validate app configuration
- Test bundle extraction

This guide provides the foundation for building robust custom applications that integrate seamlessly with the ODE ecosystem.

