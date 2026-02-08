# Extension System Implementation

## Overview

This document describes the implementation of the extension system for ODE core, allowing custom apps (e.g., AnthroCollect) to define their own extensions without ODE core owning or defining them.

## Architecture

The extension system follows a three-tier architecture:

1. **Formulus (React Native)** - Extension discovery and loading
2. **Synkronus (Go)** - Extension validation during bundle upload
3. **Formplayer (WebView)** - Runtime extension registration

## Files Changed

### 1. Formulus - Extension Service

**File: `formulus/src/services/ExtensionService.ts`** (NEW)
- Implements `getCustomAppExtensions()` API
- Discovers `ext.json` files in:
  - `/forms/ext.json` (app-level)
  - `/forms/{formName}/ext.json` (form-level)
- Merges extensions with precedence: form-level → app-level → core defaults
- Returns normalized extension object (definitions, functions, renderers)

**File: `formulus/src/services/index.ts`** (MODIFIED)
- Exports `ExtensionService`

**File: `formulus/src/components/FormplayerModal.tsx`** (MODIFIED)
- Loads extensions using `ExtensionService` when initializing forms
- Passes extension metadata to formplayer via `FormInitData`

**File: `formulus/src/webview/FormulusInterfaceDefinition.ts`** (MODIFIED)
- Added `ExtensionMetadata` interface
- Extended `FormInitData` to include optional `extensions` field

### 2. Formplayer - Runtime Extension Support

**File: `formulus-formplayer/src/extensionLoader.ts`** (NEW)
- Dynamically imports renderer components and tester functions
- Loads custom functions
- Handles import failures gracefully with error reporting

**File: `formulus-formplayer/src/App.tsx`** (MODIFIED)
- Calls `loadExtensions()` when extensions are provided
- Registers extension renderers with JsonForms (highest priority)
- Adds extension definitions to AJV for `$ref` support
- Handles missing renderers and import failures

**File: `formulus-formplayer/src/FormulusInterfaceDefinition.ts`** (MODIFIED)
- Added `ExtensionMetadata` interface matching Formulus definition

### 3. Synkronus - Validator Updates

**File: `synkronus-cli/pkg/validation/bundle.go`** (MODIFIED)
- Added `validateExtensions()` function
- Validates `ext.json` structure and required fields
- Checks that extension modules exist in bundle
- Validates UI schema format references against extension renderers
- Validates schema format properties against extension renderers
- Provides actionable error messages

## Extension File Format

Extensions are defined in `ext.json` files with the following structure:

```json
{
  "definitions": {
    "CustomType": {
      "type": "object",
      "properties": {
        "field": { "type": "string" }
      }
    }
  },
  "functions": {
    "customFunction": {
      "name": "customFunction",
      "module": "utils/customFunction.js",
      "export": "default"
    }
  },
  "renderers": {
    "customRenderer": {
      "name": "CustomRenderer",
      "format": "custom-format",
      "module": "renderers/CustomRenderer.tsx",
      "tester": "customRendererTester",
      "renderer": "CustomRenderer"
    }
  }
}
```

## Merge Precedence

Extensions are merged with the following precedence (highest to lowest):

1. **Form-level** (`/forms/{formName}/ext.json`) - Highest priority
2. **App-level** (`/forms/ext.json`) - Medium priority
3. **Core defaults** - Lowest priority (built-in renderers, formats)

## Validation Rules

The Synkronus validator enforces:

1. **Extension File Structure**
   - Must be valid JSON
   - Required fields: `name`, `format`, `module` for renderers
   - Required fields: `name` for functions

2. **Module Existence**
   - Extension modules must exist in bundle (or be valid module paths)
   - Modules can be in `forms/` or `app/` directories

3. **Renderer References**
   - UI schema format properties must have corresponding extension renderer
   - Schema format properties must have corresponding extension renderer
   - Built-in formats are allowed (date, date-time, time, photo, qrcode, etc.)

4. **Error Messages**
   - Fail early with actionable error messages
   - Clear indication of which file/field caused the error

## Runtime Behavior

### Extension Loading

1. Formulus loads extensions when initializing a form
2. Extension metadata is passed to formplayer via `FormInitData`
3. Formplayer dynamically imports extension modules
4. Extension renderers are registered with JsonForms (highest priority)
5. Extension definitions are added to AJV for `$ref` support

### Error Handling

- **Missing renderer**: Clear runtime error logged, form continues without extension
- **Import failure**: Dev warning logged, safe fallback (form continues)
- **Invalid extension**: Validation fails during bundle upload (before deployment)

## Constraints

- ✅ No app logic moved into ODE core
- ✅ No hard-coded AnthroCollect paths
- ✅ No use of `eval`
- ✅ Backwards compatible (extensions are optional)
- ✅ Declarative only (no JS module imports in ExtensionService)

## Testing

To test the extension system:

1. Create an `ext.json` file in `/forms/ext.json` or `/forms/{formName}/ext.json`
2. Define a custom renderer with a unique format
3. Reference the format in a form's UI schema
4. Bundle and upload to Synkronus
5. Validator should check extension structure and renderer references
6. Formplayer should dynamically load and register the extension

## Example Extension

```json
{
  "renderers": {
    "customDate": {
      "name": "CustomDateRenderer",
      "format": "custom-date",
      "module": "renderers/CustomDateRenderer.tsx",
      "tester": "customDateTester",
      "renderer": "CustomDateRenderer"
    }
  }
}
```

Corresponding UI schema:
```json
{
  "type": "Control",
  "scope": "#/properties/dateField",
  "options": {
    "format": "custom-date"
  }
}
```

## Ranking Renderer (AnthroCollect)

Custom renderers that need the Formulus API and form parameters (e.g., person scope, age filters) can use the `FormContext` provided by the formplayer.

### ext.json for ranking renderer

```json
{
  "renderers": {
    "ranking": {
      "name": "RankingRenderer",
      "format": "ranking",
      "module": "extensions/renderers/RankingRenderer.jsx",
      "tester": "rankingTester",
      "renderer": "RankingRenderer",
      "testerModule": "extensions/testers/rankingTester.js"
    }
  }
}
```

- **module**: Path to renderer (relative to app `forms/` directory)
- **testerModule**: Optional. Path to module containing the tester when it lives in a separate file. The tester matches when `uischema.options.renderer === 'ranking'`.

### FormContext API for custom renderers

Custom renderers receive JsonForms props (data, handleChange, path, uischema, schema, label, visible). For Formulus-specific data, use the FormContext exposed on `window.__formplayerFormContext`:

```tsx
import React from 'react';

function RankingRenderer(props) {
  const FormContext = window.__formplayerFormContext;
  const { formulusApi, formParams } = FormContext
    ? React.useContext(FormContext)
    : { formulusApi: null, formParams: {} };
  // formulusApi: FormulusInterface for anthroData.getPersonsByScopeAndFilter(formulusApi, ...)
  // formParams: { p_id, scope, age_min, age_max, ... } from openFormplayer(formType, params, savedData)
}
```

- **formulusApi**: The Formulus API instance (e.g., for `getObservationsByQuery`, etc.). Available after the formplayer loads.
- **formParams**: Parameters passed when opening the form via `openFormplayer(formType, params, savedData)`. Typically includes `p_id`, `scope`, `age_min`, `age_max` for person filtering.

### UI schema for ranking control

```json
{
  "type": "Control",
  "scope": "#/properties/demo_ranking",
  "options": {
    "renderer": "ranking",
    "sexFilter": "female"
  }
}
```

### Form params when opening ranking forms

When opening `p_ranking_female` or `p_ranking_male`, pass params so the ranking renderer can filter persons:

```javascript
openFormplayer('p_ranking_female', {
  p_id: 'person-uuid-or-focal',
  scope: 'household',
  age_min: 18,
  age_max: 65
}, savedData);
```

## Assumptions

1. Extension modules use ES6 module syntax (`import`/`export`)
2. Renderer modules export both a tester function and renderer component
3. Function modules export the function as default or named export
4. Module paths are relative to the custom app root
5. WebView can access extension modules via `file://` URLs

## Open Questions

1. Should extension functions be injected into a global evaluation context?
2. How should extension functions be called from form validation rules?
3. Should there be a versioning system for extensions?
4. How should extension conflicts be resolved (same format, different renderers)?

## Next Steps

1. Test with AnthroCollect extensions
2. Document extension development guide
3. Add extension examples to documentation
4. Consider extension versioning strategy

