# Custom Question Types - Security Options

This document outlines three approaches to security for custom question types, from most secure to least secure.

## Current Status

✅ **Option 1 is now implemented** - Custom renderers can access `window.formulus` API for safe database queries while still being sandboxed from dangerous browser APIs.

---

## Option 1: Sandboxed with Formulus API Access (✅ CURRENT - RECOMMENDED)

**Security Level:** High  
**Ease of Use:** Medium-High

### What's Allowed:
- ✅ React and MaterialUI (injected)
- ✅ `window.formulus` API (for database queries)
- ✅ Standard JavaScript (arrays, objects, functions, etc.)

### What's Blocked:
- ❌ `fetch()`, `XMLHttpRequest`, `WebSocket` (network requests)
- ❌ `localStorage`, `sessionStorage`, `indexedDB` (storage)
- ❌ `document.cookie`, `navigator.sendBeacon` (data exfiltration)
- ❌ `eval()`, `new Function()` (code injection)
- ❌ Direct DOM manipulation

### How Custom Renderers Access Data:

```javascript
function MyRenderer({ value, onChange, config }) {
  const [people, setPeople] = React.useState([]);

  React.useEffect(() => {
    // Safe database query via Formulus API
    if (formulus?.getObservationsByQuery) {
      formulus.getObservationsByQuery({
        formType: 'person',
        whereClause: "data.sex = 'male'"
      }).then(observations => {
        setPeople(observations.map(obs => obs.data));
      });
    }
  }, []);

  // Render UI using React.createElement and MaterialUI
  return React.createElement(MaterialUI.Box, {}, /* ... */);
}

module.exports = { default: MyRenderer };
```

### Benefits:
- ✅ Safe: No network requests or data exfiltration possible
- ✅ Flexible: Can query database via controlled API
- ✅ Isolated: Errors in custom code don't crash the app
- ✅ Maintainable: Clear security boundaries

### Drawbacks:
- ⚠️ Must use `React.createElement()` instead of JSX
- ⚠️ Must use `formulus` API instead of direct fetch

---

## Option 2: Remove Sandbox (Full Browser Access)

**Security Level:** Low  
**Ease of Use:** Very High

### What Would Change:

1. **Remove sandbox evaluation** - Use standard `eval()` or dynamic import
2. **Remove static blocklist** - Allow all JavaScript patterns
3. **Full browser API access** - `fetch`, `localStorage`, `document`, etc.

### Implementation:

**In `CustomQuestionTypeLoader.ts`:**

```typescript
// REPLACE the sandboxed evaluation with:
function evaluateModuleInSandbox(
  source: string,
  formatName: string,
): React.ComponentType<CustomQuestionTypeProps> {
  // Option 2A: Use eval() directly (full access)
  const exports: Record<string, unknown> = {};
  const moduleObj = { exports };
  
  // Wrap in IIFE to avoid polluting global scope
  const wrappedSource = `
    (function(module, exports) {
      ${source}
    })(module, exports);
  `;
  
  eval(wrappedSource);
  
  // OR Option 2B: Use dynamic import (requires file path)
  // This would require changing the architecture to pass file paths
  // instead of source strings
  
  const component = moduleObj.exports.default ?? moduleObj.exports;
  if (typeof component !== 'function') {
    throw new Error(`Module "${formatName}" does not export a valid React component`);
  }
  return component as React.ComponentType<CustomQuestionTypeProps>;
}
```

**In `CustomQuestionTypeScanner.ts`:**

```typescript
// REMOVE or comment out the blocklist:
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  // Comment out all patterns to allow everything
];
```

### How Custom Renderers Would Work:

```javascript
// Now they can use JSX, fetch, localStorage, etc.
function MyRenderer({ value, onChange, config }) {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    // Direct fetch - now allowed!
    fetch('/api/people')
      .then(res => res.json())
      .then(setData);
  }, []);

  // Can use JSX if you add a JSX transform
  return (
    <MaterialUI.Box>
      <MaterialUI.Typography>{data?.name}</MaterialUI.Typography>
    </MaterialUI.Box>
  );
}

module.exports = { default: MyRenderer };
```

### Benefits:
- ✅ Very easy to write (can use JSX, fetch, standard imports)
- ✅ Full JavaScript ecosystem available
- ✅ Can use any npm package (if bundled)

### Drawbacks:
- ❌ **Security Risk**: Malicious code can:
  - Make unauthorized network requests
  - Access and exfiltrate localStorage data
  - Manipulate the DOM
  - Access cookies and session data
  - Run arbitrary code via `eval()`
- ❌ **No Isolation**: Bugs in custom code can crash the entire form
- ❌ **Trust Required**: Must trust all app bundle authors completely

### When to Use:
- Only if you have complete control over app bundle sources
- Only if all form developers are trusted
- Not recommended for production with untrusted sources

---

## Option 3: Hybrid Approach (Selective Whitelist)

**Security Level:** Medium  
**Ease of Use:** High

### What Would Change:

Allow specific safe APIs while blocking dangerous ones:

```typescript
// In CustomQuestionTypeLoader.ts
const factory = new Function(
  'module',
  'exports',
  'React',
  'MaterialUI',
  'formulus',
  'console',      // Allow console for debugging
  'setTimeout',   // Allow async operations
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'Promise',      // Allow promises
  'JSON',         // Allow JSON parsing
  source,
);

factory(
  moduleObj, 
  exports, 
  ReactLib, 
  MUILib, 
  FormulusAPI,
  console,
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval,
  Promise,
  JSON
);
```

### Benefits:
- ✅ More APIs available (console, timers, JSON)
- ✅ Still blocks dangerous APIs (fetch, localStorage)
- ✅ Better developer experience

### Drawbacks:
- ⚠️ More complex to maintain
- ⚠️ Need to carefully vet each API

---

## Recommendation

**Use Option 1 (Current Implementation)** because:

1. **Security**: Prevents data exfiltration and unauthorized network requests
2. **Flexibility**: `window.formulus` API provides all necessary data access
3. **Isolation**: Errors in custom code don't crash the app
4. **Maintainability**: Clear security boundaries

If you need JSX support, consider adding a lightweight JSX transform instead of removing the sandbox.

---

## Migration Path

If you want to move from Option 1 to Option 2:

1. Update `CustomQuestionTypeLoader.ts` to use `eval()` instead of sandboxed `new Function()`
2. Remove or disable the blocklist in `CustomQuestionTypeScanner.ts`
3. Update documentation to warn about security implications
4. Consider adding code signing or other trust mechanisms

---

## Questions?

- **"Can custom renderers access the database?"** → Yes, via `window.formulus.getObservationsByQuery()` (Option 1)
- **"Can they make HTTP requests?"** → No in Option 1, Yes in Option 2 (security risk)
- **"Can they use JSX?"** → Not directly, but you can add a JSX transform
- **"Can they use npm packages?"** → Only if pre-bundled in the app bundle
