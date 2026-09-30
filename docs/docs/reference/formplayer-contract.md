---
sidebar_position: 7
---

# Formplayer Contract

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Authoritative Reference

This document defines the complete contract for ODE Formplayer, including supported JSON Schema features, UI schema structure, validation rules, and behavioral guarantees. Use this as the definitive reference when creating forms for ODE.

---

## Table of Contents

1. [Overview](#overview)
2. [Stability Guarantees](#stability-guarantees)
3. [Why Formplayer Restricts JSON Schema](#why-formplayer-restricts-json-schema)
4. [Entry Point & Initialization](#entry-point--initialization)
5. [JSON Schema Support](#json-schema-support)
6. [UI Schema Structure](#ui-schema-structure)
7. [Validation Layer](#validation-layer)
8. [Custom Formats & Renderers](#custom-formats--renderers)
9. [Rules & Conditional Logic](#rules--conditional-logic)
10. [Renderer Boundaries](#renderer-boundaries)
11. [Error Patterns & Solutions](#error-patterns--solutions)
12. [Safe vs Unsafe Patterns](#safe-vs-unsafe-patterns)
13. [Examples](#examples)
14. [Future Evolution (Non-Contractual)](#future-evolution-non-contractual)

---

## Overview

**Formplayer** is a React-based form rendering engine that uses:
- **JSON Forms 3.5.1** for form rendering
- **JSON Schema Draft-07** for data validation
- **Ajv 8.17.1** for schema validation
- **Material UI** for component rendering

**Key Characteristics:**
- All forms are normalized to `SwipeLayout` root (auto-wrapped if needed)
- `Finalize` element is automatically appended to all forms
- Validation occurs both pre-deployment (static) and runtime (dynamic)
- Custom formats require custom renderers registered in the renderer chain

---

## Stability Guarantees

**Formplayer guarantees correct behavior only when the contract in this document is followed.**

Forms that violate the contract may:
- Crash at runtime (e.g., "Cannot read properties of undefined")
- Render partially or incorrectly
- Exhibit undefined rule behavior
- Pass validation but fail during rendering
- Produce unexpected validation errors (e.g., "minimum value must be ['number']")

**Such behavior is considered out of contract and will not be treated as a Formplayer bug.**

This contract defines the supported subset of JSON Schema and JSON Forms. Forms that exceed these boundaries operate at their own risk. Maintainers should reject forms that violate the contract during pre-deployment validation.

**For maintainers:** When investigating form-related crashes or errors, first verify the form adheres to this contract. Issues arising from contract violations are not bugs in Formplayer itself.

---

## Why Formplayer Restricts JSON Schema

Although Formplayer uses JSON Schema Draft-07, it intentionally supports only a subset of the full specification.

**Reasons for Restrictions:**

1. **Mobile Performance Constraints**
   - Complex schema evaluation (e.g., `$data` references, dynamic `$ref` resolution) is computationally expensive
   - Mobile devices need predictable, fast form rendering
   - Offline-first execution requires static schema analysis

2. **Predictable Rendering**
   - Formplayer needs to know renderer selection at schema load time
   - Dynamic schema features make renderer selection ambiguous
   - Predictable structure enables better error handling and user experience

3. **Offline-First Execution**
   - Forms must work without network connectivity
   - External `$ref` resolution requires network access
   - Static schema validation can be done pre-deployment

4. **Simpler Mental Model for Form Authors**
   - Research teams, medical staff, and field workers need straightforward form design
   - Complex JSON Schema features create cognitive overhead
   - Clear contract reduces support burden

5. **Avoiding Runtime Schema Evaluation**
   - `$data` references require runtime schema evaluation
   - This creates unpredictable validation behavior
   - Literal values enable compile-time validation

**This is a design choice, not a limitation of JSON Schema itself.**

JSON Schema Draft-07 supports many features that Formplayer intentionally does not. This restriction is by design to ensure reliable, performant form rendering across diverse use cases (research tools, medical records, CHT-like flows, bespoke apps).

---

## Entry Point & Initialization

### Entry Files

- **`src/index.tsx`**: React app entry point
- **`src/App.tsx`**: Main component with form initialization logic

### Initialization Flow

```typescript
// 1. Form data received via window.onFormInit
// 2. initializeForm() called with FormInitData
// 3. Schema normalization:
   setSchema(formSchema)
   const swipeLayoutUISchema = ensureSwipeLayoutRoot(uiSchema)
   const processedUISchema = processUISchemaWithFinalize(swipeLayoutUISchema)
   setUISchema(processedUISchema)
// 4. JsonForms component renders with normalized schemas
```

### Auto-Wrapping Behavior

**Function:** `ensureSwipeLayoutRoot()` (App.tsx:61-103)

The UI schema root is **always** normalized to `SwipeLayout`:

| Input | Output |
|-------|--------|
| `null` or `undefined` | `{ type: 'SwipeLayout', elements: [] }` |
| `{ type: 'SwipeLayout', ... }` | Returns as-is |
| `{ type: 'Group', ... }` | Wrapped: `{ type: 'SwipeLayout', elements: [original] }` |
| `{ type: 'VerticalLayout', ... }` | Wrapped: `{ type: 'SwipeLayout', elements: [original] }` |
| `{ type: 'HorizontalLayout', ... }` | Wrapped: `{ type: 'SwipeLayout', elements: [original] }` |
| Array of elements | Wrapped: `{ type: 'SwipeLayout', elements: array }` |

**Guarantee:** The root UI schema will always be `SwipeLayout` before rendering.

### Finalize Element Injection

**Function:** `processUISchemaWithFinalize()` (App.tsx:106-148)

**Behavior:**
- Removes any existing `Finalize` elements (with warning)
- Always appends `{ type: 'Finalize' }` as the last element
- If no `elements` array exists, creates `VerticalLayout` with just `Finalize`

**Guarantee:** Every form will have exactly one `Finalize` element as the last page.

### Validation vs Rendering

**Pre-Deployment Validation:**
- Static validation via `validate-forms.js` scripts
- Checks schema structure, UI schema format, field references
- **Fails early** - prevents invalid forms from being deployed

**Runtime Validation:**
- Dynamic validation via Ajv during form interaction
- Validates data against schema (`validationMode="ValidateAndShow"`)
- **Fails late** - shows errors as user interacts with form

**Rendering:**
- Occurs after normalization
- Uses `JsonForms` component with custom renderers
- Assumes normalized structure (SwipeLayout root, Finalize present)

---

## JSON Schema Support

### Supported JSON Schema Draft-07 Features

#### ✅ Fully Supported

**Root Properties:**
- `$schema`: Must be `"http://json-schema.org/draft-07/schema#"`
- `type`: Must be `"object"` at root level
- `properties`: Required object containing field definitions
- `required`: Array of required field names
- `title`: Form title (displayed in UI)
- `description`: Form description

**Data Types:**
- `string`, `integer`, `number`, `boolean`, `object`, `array`

**String Validation:**
- `minLength`: Minimum string length (integer)
- `maxLength`: Maximum string length (integer)
- `pattern`: Regex pattern (string)
- `format`: Built-in formats (see [Custom Formats](#custom-formats--renderers))

**Number Validation:**
- `minimum`: Minimum value (**literal number only**)
- `maximum`: Maximum value (**literal number only**)
- `exclusiveMinimum`: Exclusive minimum (**literal number only**)
- `exclusiveMaximum`: Exclusive maximum (**literal number only**)
- `multipleOf`: Must be multiple of value (**literal number only**)

**Array Validation:**
- `items`: Schema for array items
- `minItems`: Minimum array length
- `maxItems`: Maximum array length
- `uniqueItems`: Boolean (enforces uniqueness)

**Selection Fields:**
- `enum`: Array of allowed values
- `oneOf`: Array of `{ const: value, title: "Label" }` objects (**recommended**)
- `const`: Single constant value

**Object Nesting:**
- `type: "object"` with `properties` object
- Nested objects require explicit UI schema (see [Object Handling](#object-handling))

**Advanced Features:**
- `allOf`: Array of schemas (all must match)
- `if/then/else`: Conditional schema validation (supported in schema, not in rule conditions)

#### ❌ NOT Supported / Unsafe

> ⚠️ **HARD RUNTIME ASSUMPTION**
> 
> Formplayer assumes all validation keywords (`minimum`, `maximum`, etc.) contain literal values.
> `$data` references or dynamic values will cause Ajv validation errors at runtime.
> Always use literal numbers, strings, or arrays for validation constraints.

**Unsupported Features:**
- `$data` references: **Will cause runtime errors**
  - Error: `"minimum value must be ['number']"`
  - Use literal values only
- `$ref` to external schemas: Not validated or resolved
- `anyOf`: Not explicitly supported (use `oneOf` instead)
- `$defs`/`definitions`: Not resolved
- Dynamic constraints: All validation values must be literals

**Unsafe Patterns:**
```json
// ❌ UNSAFE - $data reference
{
  "type": "integer",
  "minimum": { "$data": "/otherField" }
}

// ✅ SAFE - Literal value
{
  "type": "integer",
  "minimum": 0
}
```

### Validator Configuration

**Ajv Setup** (App.tsx:537-542):
```typescript
const ajv = new Ajv({
  allErrors: true,        // Collect all errors, not just first
  strictTypes: false,     // Allow custom formats without strict type checking
});
addErrors(ajv);           // Enhanced error messages
addFormats(ajv);          // Standard format validators (date, email, etc.)
// Custom formats registered separately (see Custom Formats section)
```

---

## UI Schema Structure

### Root Layout Types

**Valid Root Types** (before auto-wrapping):
- `SwipeLayout` (recommended, explicit)
- `VerticalLayout` (auto-wrapped to SwipeLayout)
- `HorizontalLayout` (auto-wrapped to SwipeLayout)
- `Group` (auto-wrapped to SwipeLayout)

**After Normalization:**
- Always `SwipeLayout` at root

### Element Types

#### SwipeLayout

**Structure:**
```json
{
  "type": "SwipeLayout",
  "elements": [
    { "type": "Group", "label": "Page 1", "elements": [...] },
    { "type": "Group", "label": "Page 2", "elements": [...] }
  ]
}
```

**Required:**
- `type`: `"SwipeLayout"`
- `elements`: Array of child elements (can be empty, but must exist)

**Behavior:**
- Creates swipeable pages
- Each element in `elements` becomes a page
- Progress indicator shows current page
- Navigation buttons (Previous/Next) provided automatically
- Root `SwipeLayout` honours `SHOW` / `HIDE` rules (same as nested pages)
- Default `labelLayout` is `"inline"` (compact two-column rows); set `"stacked"` for classic layout
- Optional `headerFields` (up to two schema keys) show read-only context under the progress bar
- `showInnerTitle` defaults to `false` (form title lives in Formulus chrome unless opted in)

**SwipeLayout `options`:**

| Option | Values | Notes |
|--------|--------|-------|
| `labelLayout` | `"inline"` \| `"stacked"` | Default `"inline"` |
| `headerFields` | `string[]` | Max 2 field keys |
| `showInnerTitle` | `boolean` | Default `false` |
| `autoFocusFirstInput` | `boolean` | Default `true` |
| `nextButtonLabel` | `string` | Custom Next label |
| `finalizeButtonLabel` | `string` | Last content page label |

#### VerticalLayout

**Structure:**
```json
{
  "type": "VerticalLayout",
  "elements": [
    { "type": "Control", "scope": "#/properties/field1" },
    { "type": "Control", "scope": "#/properties/field2" }
  ]
}
```

**Required:**
- `type`: `"VerticalLayout"`
- `elements`: Array of child elements (can be empty, but must exist)

**Behavior:**
- Arranges elements vertically
- Scrollable if content exceeds viewport
- Commonly used inside SwipeLayout pages

#### HorizontalLayout

**Structure:**
```json
{
  "type": "HorizontalLayout",
  "elements": [
    { "type": "Control", "scope": "#/properties/field1" },
    { "type": "Control", "scope": "#/properties/field2" }
  ]
}
```

**Required:**
- `type`: `"HorizontalLayout"`
- `elements`: Array of child elements (can be empty, but must exist)

**Behavior:**
- Arranges elements horizontally
- Useful for side-by-side fields

#### Group

**Structure:**
```json
{
  "type": "Group",
  "label": "Section Title",
  "elements": [
    { "type": "Control", "scope": "#/properties/field1" }
  ]
}
```

**Required:**
- `type`: `"Group"`
- `label`: String (section header)
- `elements`: Array of child elements (can be empty, but must exist)

**Behavior:**
- Groups related controls
- Displays label as section header
- Can be used as SwipeLayout page (auto-converted)

#### Control

**Structure:**
```json
{
  "type": "Control",
  "scope": "#/properties/fieldName",
  "label": "Custom Label",  // Optional, overrides schema title
  "options": {              // Optional renderer options
    "multi": true
  },
  "rule": {                 // Optional conditional logic
    "effect": "SHOW",
    "condition": { ... }
  }
}
```

**Required:**
- `type`: `"Control"`
- `scope`: JSON Pointer to schema property (must start with `#/properties/`)

**Optional:**
- `label`: String or `false` (to hide label). **Primary on-screen label** for multi-locale forms; merged with `translations` at init. When omitted, Formplayer falls back to `schema.title` — see [Form translations — label resolution](/guides/form-translations#how-formplayer-picks-the-displayed-label).
- `options`: Object with renderer-specific options (see below)
- `rule`: Conditional display/enable rule
- `translations`: Optional per-locale overrides (see [Form translations](/guides/form-translations))

**`translations` (form i18n):**

```json
{
  "type": "Control",
  "scope": "#/properties/name",
  "label": "Name",
  "translations": {
    "fr": { "label": "Nom" },
    "pt": { "label": "Nome" }
  }
}
```

Partial keys are allowed. Merged once at form init from `params.locale`. Not persisted as observation data.

**Common `options`:**

| Option | Values | Description |
|--------|--------|-------------|
| `labelLayout` | `"inline"` \| `"stacked"` | Per-field layout override (inherits SwipeLayout default) |
| `sticky` | `true` | Remember last submitted scalar value for new observations |
| `display` | `"radio"` \| `"buttons"` \| `"checkboxes"` | Choice layout (single- or multi-select) |
| `orientation` | `"vertical"` \| `"horizontal"` \| `"flow"` | Choice layout direction |
| `buttonGroup` | `"segmented"` \| `"separated"` | Button-group styling |
| `autocomplete` | `true` | Searchable Autocomplete for single-select (default is native `<select>`) |
| `placeholder` | `string` | Native select placeholder |
| `multi` | `true` | Multi-line text input |

**Scope Format:**
- Must start with `#/properties/`
- Examples:
  - `"#/properties/name"` - Root property
  - `"#/properties/person/properties/age"` - Nested property (requires explicit UI schema)

#### Label

**Structure:**
```json
{
  "type": "Label",
  "text": "Instructions or information"
}
```

**Required:**
- `type`: `"Label"`
- `text`: String to display

**Behavior:**
- Static text display
- No `elements` array needed
- Useful for instructions or section headers

### Critical Requirements

> ⚠️ **HARD RUNTIME ASSUMPTION**
> 
> Formplayer assumes every layout element has an `elements` array.
> Missing this will cause runtime crashes in some render paths (e.g., "Cannot read properties of undefined (reading 'find')").
> Always include `elements: []` even if the layout is empty.

**All Layouts Must Have `elements` Array:**
```json
// ❌ UNSAFE - Missing elements
{
  "type": "Group",
  "label": "Section"
}

// ✅ SAFE - elements array present (even if empty)
{
  "type": "Group",
  "label": "Section",
  "elements": []
}
```

> ⚠️ **HARD RUNTIME ASSUMPTION**
> 
> Formplayer assumes all `Control.scope` paths exist in the schema.
> Invalid scopes may cause runtime crashes or silent rendering failures.
> Always validate scope paths exist before deployment.

**All Scopes Must Exist in Schema:**
- Every `Control.scope` must reference a property in `schema.properties`
- Validation script checks this pre-deployment
- Runtime crashes if scope doesn't exist

**Nested Objects Require Explicit UI Schema:**
- Object-typed properties don't auto-render nested fields
- Must provide UI schema for each nested property
- See [Object Handling](#object-handling) section

---

## Validation Layer

### Pre-Deployment Validation

**Script:** `validate-forms.js` (found in app directories)

**What's Enforced:**

#### Schema Validation

1. **Structure Checks:**
   - `$schema` must be `"http://json-schema.org/draft-07/schema#"`
   - Root `type` must be `"object"`
   - Must have `properties` object

2. **Compilation Check:**
   - Schema must compile with Ajv (structural validity)
   - Catches syntax errors, invalid keywords

#### UI Schema Validation

1. **Root Type:**
   - Must be `SwipeLayout`, `VerticalLayout`, or `HorizontalLayout`
   - (Note: Auto-wrapping happens at runtime, but validation checks input)

2. **Element Types:**
   - Valid types: `Control`, `Label`, `VerticalLayout`, `HorizontalLayout`, `SwipeLayout`
   - Invalid types are flagged

3. **Control Elements:**
   - Must have `scope` property
   - `scope` must start with `#/properties/`

4. **Layout Elements:**
   - `VerticalLayout`, `HorizontalLayout`, `SwipeLayout` must have `elements` array
   - Missing `elements` is flagged as error

5. **Rules:**
   - `rule.effect` must be `SHOW`, `HIDE`, `ENABLE`, or `DISABLE`
   - `rule.condition.scope` must start with `#/properties/`

#### Field Reference Validation

- All `Control.scope` paths must exist in schema properties
- All `rule.condition.scope` paths must exist in schema properties
- Prevents runtime crashes from invalid references

### Runtime Validation

**When:** During form interaction (`validationMode="ValidateAndShow"`)

**What's Validated:**
- Data values against schema constraints
- Required fields
- Type constraints (string, number, etc.)
- Format validators (date, email, etc.)
- Custom format validators (photo, gps, etc.)

**What's NOT Validated:**
- Schema structure (assumed valid from pre-deployment)
- UI schema structure (assumed valid from pre-deployment)
- Field existence (assumed valid from pre-deployment)

### What's NOT Enforced (Runtime Only)

These issues are **not caught** by validation scripts but **will cause runtime errors**:

1. **`$data` References:**
   - Validation script doesn't check for `$data`
   - Runtime error: `"minimum value must be ['number']"`

2. **Missing `elements` on Nested Layouts:**
   - Validation only checks root and direct children
   - Deeply nested missing `elements` may not be caught
   - Runtime error: `"Cannot read properties of undefined (reading 'find')"`

3. **Invalid Rule Scopes:**
   - Validation checks scope format, not existence in all cases
   - May cause unexpected rule behavior

---

## Custom Formats & Renderers

### Supported Custom Formats

All custom formats are registered in Ajv and have corresponding custom renderers:

| Format | Schema Type | Renderer | Description |
|--------|-------------|----------|-------------|
| `photo` | `object` | `PhotoQuestionRenderer` | Camera capture |
| `gps` | `string` or `object` | `GPSQuestionRenderer` | GPS coordinates |
| `signature` | `object` | `SignatureQuestionRenderer` | Signature pad |
| `qrcode` | `string` or `object` | `QrcodeQuestionRenderer` | Barcode scanner |
| `audio` | `object` | `AudioQuestionRenderer` | Audio recording |
| `video` | `object` | `VideoQuestionRenderer` | Video recording |
| `select_file` | `object` | `FileQuestionRenderer` | Generic file attachment (picker) |

### Format Registration

**Ajv Registration** (App.tsx):
```typescript
ajv.addFormat('photo', () => true);        // Accepts any value
ajv.addFormat('qrcode', () => true);
ajv.addFormat('signature', () => true);
ajv.addFormat('select_file', () => true);
ajv.addFormat('audio', () => true);
ajv.addFormat('gps', () => true);
ajv.addFormat('video', () => true);
```

**Renderer Registration** (App.tsx:164-175):
```typescript
export const customRenderers = [
  { tester: photoQuestionTester, renderer: PhotoQuestionRenderer },
  { tester: qrcodeQuestionTester, renderer: QrcodeQuestionRenderer },
  { tester: signatureQuestionTester, renderer: SignatureQuestionRenderer },
  { tester: fileQuestionTester, renderer: FileQuestionRenderer },
  { tester: audioQuestionTester, renderer: AudioQuestionRenderer },
  { tester: gpsQuestionTester, renderer: GPSQuestionRenderer },
  { tester: videoQuestionTester, renderer: VideoQuestionRenderer },
];
```

### Format Requirements

**Photo:**
```json
// Schema
{
  "patient_photo": {
    "type": "object",
    "format": "photo",
    "title": "Patient Photo"
  }
}

// UI Schema
{
  "type": "Control",
  "scope": "#/properties/patient_photo"
}
```

**File (`select_file`):**

Use `type: object` with `format: select_file`. The Formplayer stores **basename-only** attachment keys and portable metadata (mime type, size, extension, optional original picker display name). The native app copies the picked file into **`attachments/draft/`** (same layout as photos). The UI shows the **filename only**—there is no embedded preview.

```json
// Schema
{
  "supporting_doc": {
    "type": "object",
    "format": "select_file",
    "title": "Supporting document"
  }
}

// UI Schema
{
  "type": "Control",
  "scope": "#/properties/supporting_doc"
}
```

**GPS:**
```json
// Schema (string format)
{
  "location": {
    "type": "string",
    "format": "gps",
    "title": "Location"
  }
}

// OR (object format)
{
  "location": {
    "type": "object",
    "format": "gps",
    "title": "Location"
  }
}

// UI Schema
{
  "type": "Control",
  "scope": "#/properties/location"
}
```

**Key Points:**
- ✅ No special UI schema required (standard `Control` is sufficient)
- ✅ Format must be specified in schema
- ✅ Attachment-backed builtins (**`photo`**, **`audio`**, **`video`**, **`select_file`**) use **`type: object`** in current Formplayer (match JSON Forms testers in `App.tsx`). Other formats may accept `string` or `object` (e.g. **`gps`**, **`qrcode`**).
- ✅ Custom renderer handles all UI and interaction

---

## Rules & Conditional Logic

### Rule Structure

```json
{
  "type": "Control",
  "scope": "#/properties/targetField",
  "rule": {
    "effect": "SHOW|HIDE|ENABLE|DISABLE",
    "condition": {
      "scope": "#/properties/sourceField",
      "schema": {
        // Condition schema (const, enum, etc.)
      }
    }
  }
}
```

### Rule Effects

| Effect | Behavior |
|--------|----------|
| `SHOW` | Element is hidden until condition is true |
| `HIDE` | Element is shown until condition is true |
| `ENABLE` | Element is disabled until condition is true |
| `DISABLE` | Element is enabled until condition is true |

> **Clear-on-hide:** For `SHOW` and `HIDE`, when a Control becomes not visible Formplayer **deletes that field’s value** from form data (see `useClearOnHide`). Use visibility rules only for answers that should reset when irrelevant. Keep injected / stamp fields in the schema and `defaultData` **without** a hidden Control—display via `headerFields` or a separate computed/`lbl_*` field if needed. Details: [Form design — Conditional Logic](../guides/form-design.md#conditional-logic-in-ode-forms).

### Condition Schema

**Supported Condition Types:**

1. **Constant Match:**
```json
{
  "condition": {
    "scope": "#/properties/field",
    "schema": { "const": "value" }
  }
}
```

2. **Enum Match:**
```json
{
  "condition": {
    "scope": "#/properties/field",
    "schema": { "enum": ["value1", "value2"] }
  }
}
```

3. **Boolean Match:**
```json
{
  "condition": {
    "scope": "#/properties/field",
    "schema": { "const": true }
  }
}
```

### Rule Evaluation

**How Rules Work:**
- Rules are evaluated by JSON Forms core (not custom Formplayer code)
- Condition is evaluated by validating the referenced field's value against `condition.schema`
- If validation passes, effect is applied
- Evaluation happens on every data change

**Undefined Scope Behavior:**
- JSON Forms treats undefined scopes as condition success (by default)
- Formplayer doesn't add defensive checks
- **Best Practice:** Ensure all rule condition scopes exist in schema

> ⚠️ **HARD RUNTIME ASSUMPTION**
> 
> Formplayer assumes all rule condition scopes exist in the schema.
> Invalid scopes may cause rules to fail silently or exhibit undefined behavior.
> JSON Forms treats undefined scopes as condition success by default, which may not match intended behavior.

### Critical Requirements

**Rule Condition Scope Must Exist:**
```json
// ❌ UNSAFE - Scope doesn't exist
{
  "rule": {
    "condition": {
      "scope": "#/properties/nonexistent",  // Field doesn't exist
      "schema": { "const": "value" }
    }
  }
}

// ✅ SAFE - Scope exists in schema
{
  "schema": {
    "properties": {
      "hasConsent": { "type": "boolean" }
    }
  },
  "uischema": {
    "rule": {
      "condition": {
        "scope": "#/properties/hasConsent",  // Field exists
        "schema": { "const": true }
      }
    }
  }
}
```

**Rule Condition Schema Must Be Simple:**
```json
// ❌ UNSAFE - Complex schema not supported
{
  "condition": {
    "schema": {
      "if": { "type": "string" },
      "then": { "const": "value" }
    }
  }
}

// ✅ SAFE - Simple const or enum
{
  "condition": {
    "schema": { "const": "value" }
  }
}
```

### Rule Examples

**Show When Value Equals:**
```json
{
  "type": "Control",
  "scope": "#/properties/detailField",
  "rule": {
    "effect": "SHOW",
    "condition": {
      "scope": "#/properties/showDetail",
      "schema": { "const": true }
    }
  }
}
```

**Hide When Value Equals:**
```json
{
  "type": "Control",
  "scope": "#/properties/skipReason",
  "rule": {
    "effect": "HIDE",
    "condition": {
      "scope": "#/properties/completed",
      "schema": { "const": true }
    }
  }
}
```

**Show When One of Multiple Values:**
```json
{
  "type": "Control",
  "scope": "#/properties/referralForm",
  "rule": {
    "effect": "SHOW",
    "condition": {
      "scope": "#/properties/testResult",
      "schema": { "enum": ["positive", "inconclusive"] }
    }
  }
}
```

**Group-Level Rules:**
```json
{
  "type": "Group",
  "label": "TB Screening",
  "elements": [...],
  "rule": {
    "effect": "SHOW",
    "condition": {
      "scope": "#/properties/screeningType",
      "schema": { "const": "tb" }
    }
  }
}
```

---

## Renderer Boundaries

### SwipeLayoutRenderer

**File:** `SwipeLayoutRenderer.tsx`

**Critical Assumptions:**
- `uischema.elements` exists (defensive: `|| []` at line 53)
- `layouts[currentPage]` exists (uses optional chaining at line 89)
- `layouts.length > 0` checked before rendering (line 126)

**What Must Exist:**
- `uischema.type` (checked at line 48)
- `uischema.elements` (defensive fallback to `[]`)

**Where Undefined Causes Crashes:**
- If `uischema` is `null` or `undefined` (shouldn't happen after normalization)
- If `layouts[currentPage]` is accessed when `currentPage >= layouts.length` (guarded by length check)

### FinalizeRenderer

**File:** `FinalizeRenderer.tsx`

**Critical Assumptions:**
- `fullUISchema.elements` exists (guarded at line 139)
- `screen.elements` exists before iteration (guarded at line 153)
- `fullSchema.properties` exists (guarded at line 177)

**What Must Exist:**
- `fullUISchema` and `fullUISchema.elements` (guarded)
- `screen.elements` for each screen (guarded with `'elements' in screen`)
- `fullSchema.properties` (guarded)

**Where Undefined Causes Crashes:**
- `screen.elements.find()` if `screen.elements` is undefined (guarded at line 153)
- `fullUISchema.elements.forEach()` if `elements` is missing (guarded at line 139)
- `schema.properties[key]` if `properties` is missing (guarded at line 177)

### Structural Assumptions

**Guaranteed by Normalization:**
1. Root is always `SwipeLayout` (via `ensureSwipeLayoutRoot()`)
2. `Finalize` element always present (via `processUISchemaWithFinalize()`)
3. Root has `elements` array (created if missing)

**Not Guaranteed (Must Be Enforced):**
1. Nested layouts have `elements` arrays (validation script checks, but deep nesting may be missed)
2. All `Control.scope` paths exist (validation script checks)
3. All `rule.condition.scope` paths exist (validation script checks format, not always existence)

**Defensive Checks in Code:**
- Most renderers use optional chaining (`?.`) and fallbacks (`|| []`)
- Some code paths assume structure exists (crashes if assumption fails)
- **Best Practice:** Always include `elements: []` even if empty

---

## Error Patterns & Solutions

### Error: "minimum value must be ['number']"

**Cause:**
- Using `$data` reference or non-numeric value for `minimum`/`maximum`
- Ajv expects literal numbers, not references

**Example:**
```json
// ❌ CAUSES ERROR
{
  "type": "integer",
  "minimum": { "$data": "/otherField" }
}

// ✅ FIX
{
  "type": "integer",
  "minimum": 0
}
```

**Solution:**
- Use literal numbers only for `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`
- If dynamic constraints needed, handle at application level, not schema level

### Error: "Cannot read properties of undefined (reading 'find')"

**Cause:**
- Accessing `.find()` or other array methods on undefined `elements` array
- Layout element missing `elements` property

**Example:**
```json
// ❌ CAUSES ERROR
{
  "type": "Group",
  "label": "Section"
  // Missing "elements" array
}

// ✅ FIX
{
  "type": "Group",
  "label": "Section",
  "elements": []  // Always include, even if empty
}
```

**Solution:**
- Always include `elements: []` for all layout types
- Validation script should catch this, but check nested layouts manually
- Defensive code exists in some renderers, but not all paths are protected

### Error: Rule Condition Fails Unexpectedly

**Cause:**
- Rule condition scope doesn't exist in schema
- Rule condition scope points to undefined data
- Complex condition schema not supported

**Example:**
```json
// ❌ CAUSES ISSUES
{
  "rule": {
    "condition": {
      "scope": "#/properties/nonexistent",  // Field doesn't exist
      "schema": { "const": "value" }
    }
  }
}

// ✅ FIX
// Ensure field exists in schema:
{
  "schema": {
    "properties": {
      "hasConsent": { "type": "boolean" }
    }
  },
  "uischema": {
    "rule": {
      "condition": {
        "scope": "#/properties/hasConsent",  // Field exists
        "schema": { "const": true }
      }
    }
  }
}
```

**Solution:**
- Validate all rule condition scopes exist in schema
- Use simple condition schemas (`const` or `enum`)
- Test rules with missing data to verify behavior

### Error: Object Properties Not Rendering

**Cause:**
- Object-typed property without explicit UI schema for nested fields
- JSON Forms doesn't auto-render nested object properties

**Example:**
```json
// ❌ NESTED FIELDS WON'T RENDER
{
  "schema": {
    "properties": {
      "gps_location": {
        "type": "object",
        "properties": {
          "latitude": { "type": "number" },
          "longitude": { "type": "number" }
        }
      }
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/gps_location"
    // Missing UI schema for nested fields
  }
}

// ✅ FIX - Explicit UI Schema
{
  "uischema": {
    "type": "Group",
    "label": "GPS Location",
    "elements": [
      { "type": "Control", "scope": "#/properties/gps_location/properties/latitude" },
      { "type": "Control", "scope": "#/properties/gps_location/properties/longitude" }
    ]
  }
}
```

**Solution:**
- Provide explicit UI schema for nested object properties
- Use `Group` or `VerticalLayout` to organize nested fields
- Exception: Custom format objects (photo, gps, etc.) don't need nested UI schema

---

## Safe vs Unsafe Patterns

### Schema Patterns

#### ✅ Safe: Literal Validation Values
```json
{
  "type": "integer",
  "minimum": 0,
  "maximum": 100
}
```

#### ❌ Unsafe: $data References
```json
{
  "type": "integer",
  "minimum": { "$data": "/otherField" }
}
```

#### ✅ Safe: oneOf with const + title
```json
{
  "type": "string",
  "oneOf": [
    { "const": "value1", "title": "Display 1" },
    { "const": "value2", "title": "Display 2" }
  ]
}
```

#### ⚠️ Works but Less Flexible: enum
```json
{
  "type": "string",
  "enum": ["value1", "value2"]
}
```

### UI Schema Patterns

#### ✅ Safe: Complete Layout Structure
```json
{
  "type": "SwipeLayout",
  "elements": [
    {
      "type": "Group",
      "label": "Section",
      "elements": [
        { "type": "Control", "scope": "#/properties/field1" }
      ]
    }
  ]
}
```

#### ❌ Unsafe: Missing elements Array
```json
{
  "type": "Group",
  "label": "Section"
  // Missing "elements"
}
```

#### ✅ Safe: Valid Scope References
```json
{
  "type": "Control",
  "scope": "#/properties/existingField"
}
```

#### ❌ Unsafe: Invalid Scope References
```json
{
  "type": "Control",
  "scope": "#/properties/nonexistentField"
}
```

### Rule Patterns

#### ✅ Safe: Rule with Existing Scope
```json
{
  "schema": {
    "properties": {
      "hasConsent": { "type": "boolean" }
    }
  },
  "uischema": {
    "rule": {
      "condition": {
        "scope": "#/properties/hasConsent",
        "schema": { "const": true }
      }
    }
  }
}
```

#### ❌ Unsafe: Rule with Missing Scope
```json
{
  "rule": {
    "condition": {
      "scope": "#/properties/nonexistent",
      "schema": { "const": "value" }
    }
  }
}
```

#### ✅ Safe: Simple Condition Schema
```json
{
  "condition": {
    "schema": { "const": "value" }
  }
}
```

#### ❌ Unsafe: Complex Condition Schema
```json
{
  "condition": {
    "schema": {
      "if": { "type": "string" },
      "then": { "const": "value" }
    }
  }
}
```

### Object Handling Patterns

#### ✅ Safe: Custom Format Object (No Nested UI Needed)
```json
{
  "schema": {
    "patient_photo": {
      "type": "object",
      "format": "photo"
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/patient_photo"
  }
}
```

#### ✅ Safe: Regular Object with Explicit UI Schema
```json
{
  "schema": {
    "gps_location": {
      "type": "object",
      "properties": {
        "latitude": { "type": "number" },
        "longitude": { "type": "number" }
      }
    }
  },
  "uischema": {
    "type": "Group",
    "label": "GPS Location",
    "elements": [
      { "type": "Control", "scope": "#/properties/gps_location/properties/latitude" },
      { "type": "Control", "scope": "#/properties/gps_location/properties/longitude" }
    ]
  }
}
```

#### ❌ Unsafe: Regular Object without UI Schema
```json
{
  "schema": {
    "gps_location": {
      "type": "object",
      "properties": {
        "latitude": { "type": "number" }
      }
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/gps_location"
    // Nested fields won't render
  }
}
```

---

## Examples

### Example 1: Complete Working Form

**File:** `demos/demo_malaria_screening/forms/registration/`

**Schema (`schema.json`):**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Patient Registration",
  "type": "object",
  "properties": {
    "full_name": {
      "type": "string",
      "title": "Full Name"
    },
    "gender": {
      "type": "integer",
      "title": "Gender",
      "oneOf": [
        { "const": 1, "title": "Male" },
        { "const": 2, "title": "Female" }
      ]
    },
    "age_years": {
      "type": "integer",
      "title": "Age in years",
      "minimum": 0
    },
    "temperature_c": {
      "type": "number",
      "title": "Temperature (°C)",
      "exclusiveMinimum": 25,
      "exclusiveMaximum": 46
    }
  },
  "required": ["full_name", "gender"]
}
```

**UI Schema (`ui.json`):**
```json
{
  "type": "SwipeLayout",
  "elements": [
    {
      "type": "VerticalLayout",
      "elements": [
        {
          "type": "Control",
          "scope": "#/properties/full_name"
        },
        {
          "type": "Control",
          "scope": "#/properties/gender"
        },
        {
          "type": "Control",
          "scope": "#/properties/age_years"
        }
      ]
    },
    {
      "type": "VerticalLayout",
      "elements": [
        {
          "type": "Control",
          "scope": "#/properties/temperature_c"
        }
      ]
    }
  ]
}
```

**Why This Works:**
- ✅ Proper `$schema` declaration
- ✅ Root `type: "object"` with `properties`
- ✅ Literal validation values (`minimum`, `exclusiveMinimum`)
- ✅ `oneOf` with `const` + `title` for choices
- ✅ `SwipeLayout` root with `elements` arrays
- ✅ All `Control.scope` paths exist in schema
- ✅ All layouts have `elements` arrays

### Example 2: Form with Conditional Logic

**Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Health Screening",
  "type": "object",
  "properties": {
    "has_cough": {
      "type": "string",
      "title": "Does patient have cough?",
      "oneOf": [
        { "const": "yes", "title": "Yes" },
        { "const": "no", "title": "No" }
      ]
    },
    "cough_duration": {
      "type": "string",
      "title": "Cough duration",
      "oneOf": [
        { "const": "less_2_weeks", "title": "Less than 2 weeks" },
        { "const": "2_weeks_plus", "title": "2 weeks or more" }
      ]
    }
  },
  "required": ["has_cough"]
}
```

**UI Schema:**
```json
{
  "type": "SwipeLayout",
  "elements": [
    {
      "type": "VerticalLayout",
      "elements": [
        {
          "type": "Control",
          "scope": "#/properties/has_cough"
        },
        {
          "type": "Control",
          "scope": "#/properties/cough_duration",
          "rule": {
            "effect": "SHOW",
            "condition": {
              "scope": "#/properties/has_cough",
              "schema": { "const": "yes" }
            }
          }
        }
      ]
    }
  ]
}
```

**Why This Works:**
- ✅ Rule condition scope (`has_cough`) exists in schema
- ✅ Simple condition schema (`const`)
- ✅ Proper rule structure with `effect` and `condition`

### Example 3: Form with Custom Format

**Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Patient Intake",
  "type": "object",
  "properties": {
    "patient_photo": {
      "type": "object",
      "format": "photo",
      "title": "Patient Photo"
    },
    "location": {
      "type": "string",
      "format": "gps",
      "title": "Location"
    }
  }
}
```

**UI Schema:**
```json
{
  "type": "SwipeLayout",
  "elements": [
    {
      "type": "VerticalLayout",
      "elements": [
        {
          "type": "Control",
          "scope": "#/properties/patient_photo"
        },
        {
          "type": "Control",
          "scope": "#/properties/location"
        }
      ]
    }
  ]
}
```

**Why This Works:**
- ✅ Custom formats registered in Ajv
- ✅ Custom renderers registered in renderer chain
- ✅ Standard `Control` elements (no special UI schema needed)
- ✅ Format specified in schema

---

## Summary Checklist

When creating a form, ensure:

### Schema Checklist
- [ ] `$schema` is `"http://json-schema.org/draft-07/schema#"`
- [ ] Root `type` is `"object"`
- [ ] Has `properties` object
- [ ] All validation values are literals (no `$data`)
- [ ] Use `oneOf` with `const` + `title` for choices (recommended)
- [ ] Nested objects have explicit UI schema (unless custom format)

### UI Schema Checklist
- [ ] Root is `SwipeLayout` (or will be auto-wrapped)
- [ ] All layouts have `elements` arrays (even if empty)
- [ ] All `Control.scope` paths exist in schema
- [ ] All `Group` elements have `label`
- [ ] Rules reference existing fields
- [ ] Rule condition schemas are simple (`const` or `enum`)

### Validation Checklist
- [ ] Run `validate-forms.js` script before deployment
- [ ] All field references validated
- [ ] No `$data` references
- [ ] All `elements` arrays present
- [ ] All scopes valid

---

## Future Evolution (Non-Contractual)

**This section describes potential future improvements that are not currently guaranteed and should not be relied upon.**

These are areas where Formplayer might evolve as the project matures:

### Potential Enhancements

1. **Schema Pre-Validation for Unsupported Keywords**
   - Early detection of `$data`, `$ref` to externals, and other unsupported features
   - Compile-time rejection of out-of-contract schemas
   - Clearer error messages pointing to contract violations

2. **Stronger UI Schema Structural Validation**
   - Deep validation of nested layouts (not just root level)
   - Guaranteed `elements` array presence at all nesting levels
   - Validation of rule condition scope existence

3. **Defensive Guards in Renderers**
   - More comprehensive optional chaining and fallbacks
   - Graceful degradation instead of crashes
   - Better error messages when assumptions fail

4. **Formal Form Compilation Step**
   - Pre-compilation of forms to validate contract compliance
   - Optimization of renderer selection
   - Static analysis of rule conditions

5. **Extended JSON Schema Support**
   - Potential support for `$data` references (with performance trade-offs)
   - Support for external `$ref` resolution (with network requirements)
   - More complex conditional schemas in rules

**Important:** These are not commitments. Forms should be designed to work with the current contract. Future enhancements may expand the contract, but backward compatibility with the current contract will be maintained.

**For maintainers:** When considering new features, evaluate them against:
- Performance impact on mobile devices
- Complexity for form authors
- Offline-first requirements
- Backward compatibility with existing forms

---

## Version History

- **v1.0** (2024): Initial contract document based on Formplayer codebase analysis

---

## References

- **JSON Forms Documentation:** https://jsonforms.io
- **JSON Schema Draft-07:** https://json-schema.org/draft-07/schema#
- **Ajv Validator:** https://ajv.js.org
- **Formplayer Source:** `ode/formulus-formplayer/src/`

---

**End of Contract**

