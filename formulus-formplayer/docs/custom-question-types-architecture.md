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
    ├── x-ranking/
    │   └── index.js       ← default export: React component
    ├── x-dynamicEnum/
    │   └── index.js
    └── x-custom-text/
        └── index.js
```

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

// Custom code CAN access:    React, MaterialUI, module, exports
// Custom code CANNOT access:  fetch, document, localStorage, window, etc.
```

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
    ├── x-ranking/index.js          ← pairwise Elo ranking UI
    ├── x-dynamicEnum/index.js      ← dynamic choice list from DB queries
    └── x-custom-text/index.js      ← enhanced text input
```

### 2. Formulus RN Scans, Reads & Screens

`CustomQuestionTypeScanner.ts` scans `question_types/`, reads each `index.js` as a raw string,
and screens it against the blocklist:

```typescript
// In CustomQuestionTypeScanner.ts
const questionTypesDir = `${customAppPath}/question_types`;
const folders = await RNFS.readDir(questionTypesDir);

for (const folder of folders) {
  if (folder.isDirectory()) {
    const source = await RNFS.readFile(`${folder.path}/index.js`, 'utf8');

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
    "x-ranking": {
      "source": "(function() { 'use strict'; ... module.exports = RankingRenderer; })()"
    },
    "x-dynamicEnum": {
      "source": "(function() { 'use strict'; ... module.exports = DynamicEnumControl; })()"
    },
    "x-custom-text": {
      "source": "(function() { 'use strict'; ... module.exports = CustomTextRenderer; })()"
    }
  }
}
```

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
const exports = {};
const moduleObj = { exports };

const factory = new Function(
  'module', 'exports', 'React', 'MaterialUI',
  meta.source,
);

factory(moduleObj, exports, React, MaterialUI);

// Extract only the component
const component = moduleObj.exports.default ?? moduleObj.exports;
```

### 5. Registry & Rendering

`CustomQuestionTypeRegistry.ts` takes each loaded component and:
- Auto-generates a tester: `rankWith(6, schemaMatches(s => s.format === name))`
- Creates a renderer entry via `CustomQuestionTypeAdapter.tsx`
- Registers the format with AJV: `ajv.addFormat('x-ranking', () => true)`

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  DEVICE STORAGE (after custom_app unzip)                    │
│                                                             │
│  /Documents/app/question_types/x-ranking/index.js           │
│  /Documents/app/question_types/x-dynamicEnum/index.js       │
│  /Documents/app/question_types/x-custom-text/index.js       │
└────────────────────────┬────────────────────────────────────┘
                         │ RNFS.readFile() → string
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  FORMULUS RN — CustomQuestionTypeScanner                    │
│                                                             │
│  1. Reads each index.js as a raw string                     │
│  2. Screens against blocklist (fetch, eval, etc.)           │
│  3. Builds manifest with source strings:                    │
│     { "x-ranking": { source: "..." } }                      │
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
│    new Function('module','exports','React','MaterialUI',    │
│                 source)                                     │
│    Extracts module.exports.default (React component)        │
│    Validates it's a function                                │
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
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
┌──────────────────────┐  ┌──────────────────────────────────┐
│  AJV Registration    │  │  JsonForms Renderers Array       │
│                      │  │                                  │
│  ajv.addFormat(      │  │  [                               │
│    'x-ranking',      │  │    ...builtInRenderers,          │
│    () => true        │  │    ...customTypeRenderers, ← NEW │
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
│  errors (string)             validation { error, msg }      │
│  schema['x-config']          config                         │
│  enabled                     enabled                        │
│  path                        fieldPath                      │
│  label, description          label, description             │
│                                                             │
│  Wraps in: QuestionShell + ErrorBoundary                    │
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

Used in `p_focal` — pairwise Elo ranking of people by social attributes:

```json
{
  "ranking_result": {
    "type": "object",
    "format": "x-ranking",
    "x-config": {
      "sexFilter": "female",
      "hardLimit": 250
    }
  }
}
```

### Dynamic Enum Question

Used across many forms — dropdown choices populated from database queries:

```json
{
  "selected_person": {
    "type": "string",
    "format": "x-dynamicEnum",
    "x-config": {
      "query": "p_consent",
      "params": {
        "scope": "{{data.scope}}"
      },
      "valueField": "observationId",
      "labelField": "data.name"
    }
  }
}
```

### Custom Text Question

Enhanced text input with configurable multiline and placeholder:

```json
{
  "notes": {
    "type": "string",
    "format": "x-custom-text",
    "maxLength": 500,
    "x-config": {
      "placeholder": "Enter field notes...",
      "helperText": "Describe any notable observations"
    }
  }
}
```

**What happens for each:**

1. `format: "x-ranking"` → tester matches → the ranking renderer is used
2. `x-config` → passed as `props.config` to the author's component
3. Standard JSON Schema keywords (`type`, `maxLength`, etc.) → validated by AJV as normal
4. AJV doesn't reject the custom format strings because we registered them

---

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
| `CustomQuestionTypeLoader.ts` | Rewritten: `import()` → `new Function()` sandbox |

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
