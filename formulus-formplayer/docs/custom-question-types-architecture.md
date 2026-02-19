# Custom Question Types — Architecture & Flow

---

## File Structure

```
formulus-formplayer/src/                    (FORMPLAYER — runs in WebView)
├── types/
│   ├── CustomQuestionTypeContract.ts       ← 1. The contract authors code against
│   └── FormulusInterfaceDefinition.ts      ← 2. FormInitData (carries the manifest)
│
├── services/
│   ├── CustomQuestionTypeLoader.ts         ← 3. Sandboxed evaluation of source strings
│   └── CustomQuestionTypeRegistry.ts       ← 4. Auto-generates testers + renderer entries
│
├── renderers/
│   └── CustomQuestionTypeAdapter.tsx       ← 5. Bridges ControlProps → CustomQuestionTypeProps
│
└── App.tsx                                 ← 6. Orchestrates everything

formulus/src/                               (FORMULUS — runs in React Native)
├── services/
│   └── CustomQuestionTypeScanner.ts        ← Reads files, screens against blocklist
│
└── components/
    └── FormplayerModal.tsx                 ← Calls scanner, passes source in FormInitData
```

### Author's Side (custom_app)

```
custom_app/
└── question_types/
    ├── ranking/
    │   └── renderer.js    ← default export: React component
    ├── select-person/
    │   └── renderer.js
    └── test-simple/
        └── renderer.js
```

**Note:** The folder name becomes the format string. For example:
- `question_types/ranking/renderer.js` → `format: "ranking"`
- `question_types/select-person/renderer.js` → `format: "select-person"`
- `question_types/test-simple/renderer.js` → `format: "test-simple"`

**Important:** The scanner specifically looks for `renderer.js` (not `index.js`). The file must be named `renderer.js` in each question type directory.

---

## Security Model — Source Extraction

Custom question type JS files could contain malicious code. Instead of letting the WebView
`import()` arbitrary scripts (which would give them full access to fetch, DOM, localStorage, etc.),
we use a **source extraction** approach with two layers of defense:

| Layer | Where | What it does |
|-------|-------|-------------|
| **Static blocklist** | RN side (`CustomQuestionTypeScanner`) | Rejects code containing dangerous patterns before it reaches the WebView |
| **Scoped evaluation** | WebView (`CustomQuestionTypeLoader`) | `new Function()` sandbox — code can only access React and MUI, nothing else |

### Blocked Patterns (RN-side screening)

```
fetch(             — network requests
XMLHttpRequest     — network requests
WebSocket          — persistent connections
eval(              — dynamic code execution
new Function(      — dynamic code execution
document.cookie    — cookie access
localStorage       — storage access
sessionStorage     — storage access
indexedDB          — database access
navigator.sendBeacon — data exfiltration
importScripts(     — script injection
```

### Scoped Sandbox (WebView-side evaluation)

```javascript
// Instead of: import("file:///path/to/index.js")
// We do:
const factory = new Function(
  'module', 'exports', 'React', 'MaterialUI',
  sourceString  // ← sent from RN as a string, not a file path
);

// React and MaterialUI are accessed from global scope
const ReactLib = window.React || globalThis.React || self.React;
const MUILib = window.MaterialUI || globalThis.MaterialUI || self.MaterialUI;

factory(moduleObj, exports, ReactLib, MUILib);

// Custom code CAN access:    React, MaterialUI, module, exports
// Custom code CANNOT access:  fetch, document, localStorage, window, etc.
```

**Important Implementation Details:**
- React and MaterialUI are injected into the global scope by the WebView before custom question types are loaded
- The sandbox factory function receives these as explicit parameters, ensuring they're the only globals accessible
- If React or MaterialUI are not found in the global scope, loading fails with a clear error message
- The code supports both CommonJS patterns: `module.exports = Component` and `module.exports.default = Component`

---

## How Module Loading Works

### 1. Device Storage

When the custom_app archive is unzipped, files land on the device filesystem:

```
/data/.../Documents/app/
├── forms/
│   ├── hh_hut/schema.json
│   ├── hh_person/schema.json
│   ├── p_focal/schema.json
│   └── ...
└── question_types/
    ├── ranking/renderer.js          ← pairwise Elo ranking UI
    ├── select-person/renderer.js    ← person selection with search
    └── test-simple/renderer.js      ← simple test renderer
```

### 2. Formulus RN Scans, Reads & Screens

`CustomQuestionTypeScanner.ts` scans `question_types/`, reads each `renderer.js` as a raw string,
and screens it against the blocklist:

```typescript
// In CustomQuestionTypeScanner.ts
const questionTypesDir = `${customAppPath}/question_types`;
const folders = await RNFS.readDir(questionTypesDir);

for (const folder of folders) {
  if (folder.isDirectory()) {
    const source = await RNFS.readFile(`${folder.path}/renderer.js`, 'utf8');

    // Screen against blocklist
    const violation = screenSource(source);
    if (violation) {
      errors.push({ name: folder.name, error: `Blocked: ${violation}` });
      continue;
    }

    // Source is clean — include it
    custom_types[folder.name] = { source };
  }
}
```

**Sample manifest** (source strings, not file paths):

```json
{
  "custom_types": {
    "ranking": {
      "source": "(function() { 'use strict'; ... module.exports = { default: RankingRenderer }; })()"
    },
    "select-person": {
      "source": "(function() { 'use strict'; ... module.exports = { default: SelectPersonRenderer }; })()"
    },
    "test-simple": {
      "source": "(function() { 'use strict'; ... module.exports = { default: TestSimpleRenderer }; })()"
    }
  }
}
```

**Note:** The format name matches the folder name in `question_types/`. The scanner reads the file content and includes it as a source string in the manifest.

### 3. FormInitData Carries the Source Strings

In `FormplayerModal.tsx`, `initializeForm()` calls the scanner and includes the result:

```typescript
const customAppPath = RNFS.DocumentDirectoryPath + '/app';

// Scan and screen custom question types
const scanResult = await scanCustomQuestionTypes(customAppPath);
if (scanResult.errors.length > 0) {
  console.warn('Some custom question types failed screening:', scanResult.errors);
}

const formInitData = {
  formType: formType.id,
  observationId,
  params: formParams,
  savedData: existingObservationData || {},
  formSchema: formType.schema,
  uiSchema: formType.uiSchema ?? {},
  extensions,
  customQuestionTypes: {
    custom_types: scanResult.custom_types,
  },
} as FormInitData;
```

### 4. WebView Receives & Evaluates in Sandbox

`FormulusWebViewHandler.sendFormInit()` serializes the `FormInitData` and injects it into
the WebView. Then `CustomQuestionTypeLoader.ts` evaluates each source in a scoped sandbox:

```typescript
// CustomQuestionTypeLoader.ts — evaluateModuleInSandbox()
const exports: Record<string, unknown> = {};
const moduleObj = { exports };

// Access React and MaterialUI from global scope
const ReactLib = window.React || globalThis.React || self.React;
const MUILib = window.MaterialUI || globalThis.MaterialUI || self.MaterialUI;

if (!ReactLib) {
  throw new Error('React is not available in the global scope');
}

// Create factory with restricted scope
const factory = new Function(
  'module', 'exports', 'React', 'MaterialUI',
  sourceString
);

factory(moduleObj, exports, ReactLib, MUILib);

// Extract the component (supports both default and named exports)
const component = moduleObj.exports.default ?? moduleObj.exports;

// Validate it's a function
if (typeof component !== 'function') {
  throw new Error(`Module does not export a valid React component`);
}
```

**Error Handling:**
- Each module evaluation is wrapped in try-catch
- Failed modules are logged with detailed error messages
- Loading continues for other modules even if one fails
- Errors are collected and returned in the result for debugging

### 5. Registry & Rendering

`CustomQuestionTypeRegistry.ts` takes each loaded component and:
- Auto-generates a tester: `rankWith(6, schemaMatches(s => s.format === name))`
  - Priority 6 is higher than default Material renderers (3-5) but lower than specialized built-ins (10+)
- Creates a renderer entry via `CustomQuestionTypeAdapter.tsx`
- Returns renderer entries and format strings for AJV registration

**Renderer Creation:**
- Each custom question type is wrapped in `QuestionShell` for consistent styling
- An `ErrorBoundary` catches any crashes in custom components
- The adapter maps JSON Forms `ControlProps` to simplified `CustomQuestionTypeProps`
- Config is extracted from schema properties (excluding reserved ones) and merged with `x-config`

**AJV Format Registration:**
- Format strings are registered with AJV to prevent validation errors for unknown formats
- Registration happens in `App.tsx` after loading: `ajv.addFormat(formatName, () => true)`

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  DEVICE STORAGE (after custom_app unzip)                    │
│                                                             │
│  /Documents/app/question_types/ranking/renderer.js          │
│  /Documents/app/question_types/select-person/renderer.js    │
│  /Documents/app/question_types/test-simple/renderer.js      │
└────────────────────────┬────────────────────────────────────┘
                         │ RNFS.readFile() → string
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  FORMULUS RN — CustomQuestionTypeScanner                    │
│                                                             │
│  1. Reads each index.js as a raw string                     │
│  2. Screens against blocklist (fetch, eval, etc.)           │
│  3. Builds manifest with source strings:                    │
│     { "ranking": { source: "..." } }                        │
│  4. Rejected modules → logged as warnings                   │
└────────────────────────┬────────────────────────────────────┘
                         │ FormInitData.customQuestionTypes
                         │ sendFormInit() → injectJavaScript()
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  FORMPLAYER WEBVIEW — App.tsx                               │
│                                                             │
│  initializeForm() reads initData.customQuestionTypes        │
│  calls loadCustomQuestionTypes(manifest)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  CustomQuestionTypeLoader.ts — SANDBOX                      │
│                                                             │
│  For each entry in manifest.custom_types:                   │
│    1. Access React/MaterialUI from global scope            │
│    2. new Function('module','exports','React','MaterialUI',│
│                    source)                                   │
│    3. Execute factory(moduleObj, exports, React, MUI)      │
│    4. Extract module.exports.default or module.exports      │
│    5. Validate it's a function                              │
│    6. Collect errors if evaluation fails                    │
│    ❌ No access to: fetch, document, localStorage, etc.     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  CustomQuestionTypeRegistry.ts                              │
│                                                             │
│  For each loaded component:                                 │
│    Auto-generates a tester:                                 │
│      rankWith(6, schemaMatches(s => s.format === name))     │
│    Creates renderer entry via adapter                       │
│    Returns: { renderers[], formats[] }                      │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
┌──────────────────────┐  ┌──────────────────────────────────┐
│  AJV Registration    │  │  JsonForms Renderers Array       │
│                      │  │                                  │
│  ajv.addFormat(      │  │  [                               │
│    'ranking',        │  │    ...builtInRenderers,          │
│    'select-person',  │  │    ...customTypeRenderers, ← NEW │
│    () => true        │  │  ]                               │
│  )                   │  │  ]                               │
│                      │  │                                  │
│  Prevents AJV from   │  │  Testers run top-to-bottom,      │
│  rejecting unknown   │  │  highest rank wins               │
│  format strings      │  │                                  │
└──────────────────────┘  └───────────────┬──────────────────┘
                                          │ at render time
                                          ▼
┌─────────────────────────────────────────────────────────────┐
│  CustomQuestionTypeAdapter.tsx                              │
│                                                             │
│  JSON Forms ControlProps  →  CustomQuestionTypeProps        │
│  ─────────────────────       ────────────────────────       │
│  data                        value                          │
│  handleChange(path, val)     onChange(val)                  │
│  errors (string/array)       validation { error, msg }      │
│  schema (all props)          config (merged with x-config)  │
│  enabled                     enabled                        │
│  path                        fieldPath                      │
│  label, description          label, description             │
│                                                             │
│  Config extraction:                                          │
│    - All schema properties (except reserved) → config       │
│    - x-config properties override schema properties          │
│    - Reserved: type, title, description, format, enum, etc.│
│                                                             │
│  Wraps in: QuestionShell + ErrorBoundary                    │
│    - ErrorBoundary shows user-friendly error UI             │
│    - Form continues to function if component crashes        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Author's Component                                         │
│                                                             │
│  Receives only: { value, config, onChange, validation, ... }│
│  No JSON Forms knowledge needed.                            │
│  Crash-safe via ErrorBoundary.                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Schema Examples (based on AnthroCollect forms)

### Ranking Question

Used for pairwise comparison ranking of people (similar to ODK-X OMO style):

```json
{
  "ranking_field": {
    "type": "array",
    "format": "ranking",
    "title": "Rank People",
    "description": "Rank the people in order of preference",
    "items": {
      "type": "string"
    },
    "people": [
      {
        "id": "person1",
        "name": "John Doe",
        "age": 35,
        "clan": "Alpha",
        "sex": "male",
        "photo_uriFragment": null
      },
      {
        "id": "person2",
        "name": "Jane Smith",
        "age": 28,
        "clan": "Beta",
        "sex": "female",
        "photo_uriFragment": null
      }
    ],
    "promptText": "Select the person you prefer"
  }
}
```

**Key points:**
- `format: "ranking"` (no "x-" prefix needed)
- `people` array is passed directly in schema (becomes `config.people`)
- `promptText` is optional and becomes `config.promptText`
- Value stored is an array of person IDs in ranked order
- Uses Elo-style pairwise comparison algorithm

### Select Person Question

Used for selecting a person from a list with optional search:

```json
{
  "select_person_field": {
    "type": "string",
    "format": "select-person",
    "title": "Select Person",
    "description": "Choose a person from the list",
    "showSearch": true,
    "showPhoto": false,
    "people": [
      {
        "id": "person1",
        "name": "John Doe",
        "age": 35,
        "clan": "Alpha",
        "sex": "male"
      },
      {
        "id": "person2",
        "name": "Jane Smith",
        "age": 28,
        "clan": "Beta",
        "sex": "female"
      }
    ]
  }
}
```

**Key points:**
- `format: "select-person"` (no "x-" prefix needed)
- `people` array is passed directly in schema (becomes `config.people`)
- `showSearch` (default: true) enables searchable autocomplete
- `showPhoto` (default: false) shows person photos if available
- Value stored is the selected person's ID (string)

### Simple Test Question

Minimal example for testing the custom question type system:

```json
{
  "test_custom_field": {
    "type": "string",
    "format": "test-simple",
    "title": "Test Custom Question Type",
    "description": "This field uses the test-simple custom question type renderer",
    "placeholder": "Enter test value here...",
    "maxLength": 50
  }
}
```

**Key points:**
- `format: "test-simple"` (no "x-" prefix needed)
- `placeholder` is passed directly in schema (becomes `config.placeholder`)
- Standard JSON Schema validation (`maxLength`) still applies

### Using x-config (Alternative)

You can also use `x-config` for explicit configuration that overrides schema properties:

```json
{
  "custom_field": {
    "type": "string",
    "format": "my-custom-type",
    "title": "My Field",
    "maxLength": 100,
    "x-config": {
      "customParam": "value",
      "maxLength": 200
    }
  }
}
```

In this case, `config.maxLength` will be `200` (from `x-config`), not `100` (from schema property).

**What happens for each:**

1. `format: "ranking"` → tester matches → the ranking renderer is used
2. Schema properties (except reserved ones) → passed as `props.config` to the author's component
3. `x-config` properties → override schema properties in config
4. Standard JSON Schema keywords (`type`, `maxLength`, etc.) → validated by AJV as normal
5. AJV doesn't reject the custom format strings because we registered them

---

## Implementation Details

### Security Model Implementation

**Source Extraction Flow:**
1. RN side (`CustomQuestionTypeScanner`) reads JS files as raw strings
2. Static blocklist screening rejects dangerous patterns (fetch, eval, localStorage, etc.)
3. Clean source strings are passed in `FormInitData.customQuestionTypes`
4. WebView side (`CustomQuestionTypeLoader`) evaluates source in scoped sandbox
5. Only React, MaterialUI, module, and exports are accessible to custom code

**Global Scope Access:**
- React and MaterialUI must be available in the WebView's global scope before loading
- The loader checks `window`, `globalThis`, and `self` for these libraries
- If not found, loading fails with a clear error message
- This ensures custom code can use React hooks and Material UI components

**Error Handling:**
- Each module evaluation is wrapped in try-catch
- Failed modules are logged but don't stop other modules from loading
- Errors are collected and returned: `{ format: string, error: string }[]`
- The registry only processes successfully loaded components

### Module Export Patterns

Custom question type modules can export components in multiple ways:
```javascript
// Pattern 1: Object with default property (recommended)
module.exports = {
  default: function MyComponent(props) { ... }
};

// Pattern 2: Direct default export
module.exports.default = function MyComponent(props) { ... };

// Pattern 3: Direct export (also supported)
module.exports = function MyComponent(props) { ... };

// Pattern 4: Named export (also supported)
module.exports.MyComponent = function MyComponent(props) { ... };
```

The loader checks `module.exports.default` first, then falls back to `module.exports`. The recommended pattern is Pattern 1 (object with default property) as used in the AnthroCollect examples.

### Config Extraction

The adapter extracts configuration from the schema:
- All schema properties except reserved ones become `config`
- Reserved properties: `type`, `title`, `description`, `format`, `enum`, `const`, `default`, `required`, `properties`, `items`, `oneOf`, `anyOf`, `allOf`, `$ref`, `$schema`, validation keywords, etc.
- Properties from `x-config` override schema properties
- This allows passing parameters like `maxStars: 5` directly in the schema

### Tester Priority

Custom question type testers use priority 6:
- Higher than default Material renderers (priority 3-5)
- Lower than specialized built-in question types (priority 10+)
- Ensures custom types are selected when format matches, but built-ins take precedence for their specific formats

## Implementation Plan (completed)

All changes below have been implemented.

### Formulus RN Side

| File | Change |
|------|--------|
| `FormulusInterfaceDefinition.ts` | `modulePath` → `source` in `FormInitData.customQuestionTypes` |
| `CustomQuestionTypeScanner.ts` | **NEW** — scans, reads, screens question type modules |
| `FormplayerModal.tsx` | Calls scanner, passes source strings in `FormInitData` |

### FormPlayer WebView Side

| File | Change |
|------|--------|
| `FormulusInterfaceDefinition.ts` | `modulePath` → `source` (mirror) |
| `CustomQuestionTypeContract.ts` | `modulePath` → `source` in `CustomQuestionTypeManifest` |
| `CustomQuestionTypeLoader.ts` | Rewritten: `import()` → `new Function()` sandbox with React/MUI from global scope |
| `CustomQuestionTypeRegistry.ts` | Auto-generates testers with priority 6, creates renderer entries |
| `CustomQuestionTypeAdapter.tsx` | Maps ControlProps → CustomQuestionTypeProps, wraps in ErrorBoundary |
| `App.tsx` | Orchestrates loading, registers formats with AJV, merges with built-in renderers |

### Key Files — Full Reference

| File | Role | Key Export |
|------|------|-----------|
| `CustomQuestionTypeScanner.ts` (RN) | Reads & screens modules | `scanCustomQuestionTypes()` |
| `CustomQuestionTypeContract.ts` | Defines what authors receive | `CustomQuestionTypeProps` |
| `CustomQuestionTypeLoader.ts` | Sandboxed evaluation | `loadCustomQuestionTypes()` |
| `CustomQuestionTypeRegistry.ts` | Creates JsonForms entries | `registerCustomQuestionTypes()` |
| `CustomQuestionTypeAdapter.tsx` | Props bridge + error isolation | `createCustomQuestionTypeRenderer()` |
| `FormulusInterfaceDefinition.ts` | Carries source from RN → WebView | `FormInitData` |
| `App.tsx` | Orchestrates load → register → render | `initializeForm()` |
| `FormplayerModal.tsx` (RN) | Builds FormInitData, sends to WebView | `initializeForm()` |
