---
sidebar_position: 1
---

# Form Design

Complete guide to designing forms in ODE using JSON schema and JSON Forms.

## Overview

ODE forms support optional **embedded translations** in `ui.json` (form-owned copy) separate from **ODE platform locales** (Formulus Settings → Language). For multi-locale forms, put display strings on `Control.label` / `Label.text` with a `translations` block — see [Form translations](/guides/form-translations).

Forms in ODE are defined using JSON schema, following the JSON Forms specification. A form consists of two main components:

1. **Schema**: Defines the data structure and validation rules
2. **UI Schema**: Defines how the form is presented to users

## How Forms Work in ODE

Understanding the mental model of forms in ODE is essential for effective form design.

### What is a "Form" in ODE?

A form in ODE is a structured data collection interface that consists of:

- **JSON Schema**: Defines what data can be collected, its structure, types, and validation rules
- **UI Schema**: Defines how the form is presented to users, including layout, field ordering, and conditional visibility
- **Formplayer**: The rendering engine that interprets these schemas and creates the interactive form interface

### The Role of JSON Schema

JSON Schema serves as the **data contract** for your form:

- **Structure Definition**: Defines the shape of data (properties, types, nesting)
- **Validation Rules**: Enforces data quality (required fields, ranges, formats)
- **Type Safety**: Ensures data types match expectations (string, number, boolean, etc.)

JSON Schema follows the [JSON Schema Draft 7](https://json-schema.org/specification-links.html#draft-7) specification, but ODE Formplayer intentionally supports a **safe, predictable subset** of JSON Schema features.

### The Role of UI Schema

UI Schema (JSON Forms UI Schema) controls the **presentation layer**:

- **Layout**: How fields are arranged (vertical, horizontal, grouped, paginated)
- **Ordering**: The sequence in which fields appear
- **Conditional Logic**: When fields are shown or hidden
- **Field Configuration**: Labels, placeholders, and display options

For **multi-locale** forms, user-visible labels belong on `Control.label` in `ui.json` (with optional `translations`), not on `schema.json` `title`. See [Schema `title` vs UI `label`](/guides/form-translations#schema-title-vs-ui-label) in the form translations guide.

### The Role of Formplayer

Formplayer is the React-based rendering engine that:

- **Interprets Schemas**: Reads JSON Schema and UI Schema to understand form structure
- **Renders Components**: Creates interactive form elements (inputs, selects, media capture, etc.)
- **Validates Input**: Enforces schema validation rules in real-time
- **Manages State**: Tracks form data, validation errors, and user interactions

### Why ODE Supports a Subset of JSON Schema

**Key Message**: ODE Formplayer intentionally supports a safe, predictable subset of JSON Schema and JSON Forms to ensure:

1. **Reliability**: Forms work consistently across all devices and scenarios
2. **Performance**: Complex schema features don't slow down form rendering
3. **Predictability**: Form behavior is deterministic and easy to reason about
4. **Mobile Optimization**: Features work well in resource-constrained mobile environments

**Important**: Forms that use unsupported JSON Schema features may load but are **not guaranteed to work**. Always refer to the [Formplayer Supported Schema & UI Profile](/reference/formplayer#supported-schema--ui-profile) for the definitive list of supported features.

## Basic Form Structure

Here's a simple form example:

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "title": "Name"
      },
      "age": {
        "type": "integer",
        "title": "Age",
        "minimum": 0,
        "maximum": 120
      }
    },
    "required": ["name", "age"]
  },
  "uischema": {
    "type": "VerticalLayout",
    "elements": [
      {
        "type": "Control",
        "scope": "#/properties/name"
      },
      {
        "type": "Control",
        "scope": "#/properties/age"
      }
    ]
  }
}
```

## Schema Definition

The schema defines the data structure and validation rules for your form. It follows the JSON Schema specification.

### Property Types

ODE supports various property types:

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text input | Name, description |
| `integer` | Whole number | Age, count |
| `number` | Decimal number | Weight, temperature |
| `boolean` | True/false value | Consent, agreement |
| `array` | List of items | Multiple selections |
| `object` | Nested object | Complex data structures |

### Validation Rules

You can add validation rules to properties:

```json
{
  "type": "string",
  "title": "Email",
  "format": "email",
  "minLength": 5,
  "maxLength": 100
}
```

Common validation rules:

- `minimum` / `maximum`: For numbers
- `minLength` / `maxLength`: For strings
- `pattern`: Regular expression pattern
- `format`: Predefined formats (email, date, etc.)
- `enum`: List of allowed values

## Designing UI Schemas for ODE Formplayer

The UI schema defines how form fields are presented to users. It controls layout, ordering, and presentation. ODE Formplayer has specific requirements and best practices for UI schema design.

### Required Layout Structure

**All ODE forms must use `SwipeLayout` as the root element.** This enables pagination and swipe navigation between form sections.

#### SwipeLayout (Required Root)

`SwipeLayout` is the root layout type that enables multi-page forms with swipe navigation. It automatically wraps other layout types if not explicitly specified.

**Required Structure:**
```json
{
  "type": "SwipeLayout",
  "elements": [
    // Each element becomes a swipeable page
  ]
}
```

**Key Characteristics:**
- **Root Element**: Must be the top-level element in your UI schema
- **Pagination**: Each element in `elements[]` becomes a separate page
- **Swipe Navigation**: Users can swipe left/right to navigate between pages
- **Progress Tracking**: Shows progress bar indicating current page
- **Auto-wrapping**: If root is not SwipeLayout, Formplayer automatically wraps it

**SwipeLayout `options`:**

| Option | Values | Description |
|--------|--------|-------------|
| `labelLayout` | `"inline"` (default) \| `"stacked"` | Compact two-column layout (title left, input right) vs classic stacked fields |
| `headerFields` | string[] (max 2) | Read-only field keys shown under the progress bar on every page |
| `showInnerTitle` | boolean (default `false`) | Show the form `schema.title` in the inner header (off by default to avoid duplicating the Formulus chrome) |
| `autoFocusFirstInput` | boolean (default `true`) | Focus the first text input when a page opens (keeps the keyboard open across swipes) |
| `nextButtonLabel` | string | Override the Next button label |
| `finalizeButtonLabel` | string | Override the label on the last content page before Finalize |

Per-field override: set `"options": { "labelLayout": "stacked" }` on a `Control` to force a full-width stacked row (useful for photo, signature, GPS, or wide button groups).

**Safe Example:**
```json
{
  "type": "SwipeLayout",
  "elements": [
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
        }
      ]
    },
    {
      "type": "VerticalLayout",
      "elements": [
        {
          "type": "Control",
          "scope": "#/properties/email"
        }
      ]
    }
  ]
}
```

**Unsafe Example:**
```json
{
  "type": "VerticalLayout",  // ❌ Not SwipeLayout - will be auto-wrapped
  "elements": [...]
}
```

### Layout Types

#### VerticalLayout

Fields arranged vertically in a single column.

**Required Fields:**
- `type`: `"VerticalLayout"`
- `elements`: Array of UI schema elements

**Usage:**
```json
{
  "type": "VerticalLayout",
  "elements": [
    {
      "type": "Control",
      "scope": "#/properties/field1"
    },
    {
      "type": "Control",
      "scope": "#/properties/field2"
    }
  ]
}
```

#### HorizontalLayout

Fields arranged horizontally in a row.

**Required Fields:**
- `type`: `"HorizontalLayout"`
- `elements`: Array of UI schema elements

**Usage:**
```json
{
  "type": "HorizontalLayout",
  "elements": [
    {
      "type": "Control",
      "scope": "#/properties/firstName"
    },
    {
      "type": "Control",
      "scope": "#/properties/lastName"
    }
  ]
}
```

#### Group

Groups related fields together with a label.

**Required Fields:**
- `type`: `"Group"`
- `label`: Group title (required)
- `elements`: Array of UI schema elements

**Usage:**
```json
{
  "type": "Group",
  "label": "Personal Information",
  "elements": [
    {
      "type": "Control",
      "scope": "#/properties/name"
    },
    {
      "type": "Control",
      "scope": "#/properties/email"
    }
  ]
}
```

**Note**: Groups can be used as pages within SwipeLayout. Each Group element in a SwipeLayout's `elements[]` becomes a separate page.

### Control Configuration

Controls bind UI elements to schema properties.

**Required Fields:**
- `type`: `"Control"`
- `scope`: JSON pointer to schema property (must exist in schema)

**Optional Fields:**
- `label`: Override field label
- `options`: Additional configuration

**Safe Example:**
```json
{
  "type": "Control",
  "scope": "#/properties/name",  // ✅ Scope exists in schema
  "label": "Full Name",
  "options": {
    "placeholder": "Enter your name"
  }
}
```

**Unsafe Example:**
```json
{
  "type": "Control",
  "scope": "#/properties/nonexistent"  // ❌ Scope doesn't exist - will cause error
}
```

### Label Element

Displays text labels within forms.

**Required Fields:**
- `type`: `"Label"`
- `text`: Label text content

**Usage:**
```json
{
  "type": "Label",
  "text": "Section Introduction"
}
```

### UI Schema Best Practices

#### Pagination Patterns

**Recommended**: Use SwipeLayout with VerticalLayout pages for multi-step forms:

```json
{
  "type": "SwipeLayout",
  "elements": [
    {
      "type": "VerticalLayout",
      "elements": [
        { "type": "Label", "text": "Step 1: Basic Info" },
        { "type": "Control", "scope": "#/properties/name" },
        { "type": "Control", "scope": "#/properties/age" }
      ]
    },
    {
      "type": "VerticalLayout",
      "elements": [
        { "type": "Label", "text": "Step 2: Contact" },
        { "type": "Control", "scope": "#/properties/email" }
      ]
    }
  ]
}
```

#### Grouping Best Practices

**Use Groups for logical organization:**
```json
{
  "type": "SwipeLayout",
  "elements": [
    {
      "type": "Group",
      "label": "Demographics",
      "elements": [
        { "type": "Control", "scope": "#/properties/age" },
        { "type": "Control", "scope": "#/properties/gender" }
      ]
    },
    {
      "type": "Group",
      "label": "Health Information",
      "elements": [
        { "type": "Control", "scope": "#/properties/height" },
        { "type": "Control", "scope": "#/properties/weight" }
      ]
    }
  ]
}
```

#### Common Pitfalls

**❌ Missing elements array:**
```json
{
  "type": "SwipeLayout"
  // ❌ Missing elements - will cause error
}
```

**✅ Always include elements:**
```json
{
  "type": "SwipeLayout",
  "elements": []  // ✅ Empty array is safe
}
```

**❌ Invalid scope paths:**
```json
{
  "type": "Control",
  "scope": "#/properties/missingField"  // ❌ Field doesn't exist in schema
}
```

**✅ Verify scope exists:**
```json
{
  "type": "Control",
  "scope": "#/properties/existingField"  // ✅ Field exists in schema
}
```

**❌ Nested SwipeLayout:**
```json
{
  "type": "SwipeLayout",
  "elements": [
    {
      "type": "SwipeLayout",  // ❌ Nested SwipeLayout not supported
      "elements": [...]
    }
  ]
}
```

**✅ Use VerticalLayout or Group inside SwipeLayout:**
```json
{
  "type": "SwipeLayout",
  "elements": [
    {
      "type": "VerticalLayout",  // ✅ Use VerticalLayout for pages
      "elements": [...]
    }
  ]
}
```

## Question Types

ODE supports various question types through the Formplayer component. Question types are specified using the `format` property in the schema.

### Basic Input Types

**Text Input:**
```json
{
  "type": "string",
  "title": "Name",
  "format": "text"
}
```

**Number Input:**
```json
{
  "type": "integer",
  "title": "Age",
  "minimum": 0,
  "maximum": 120
}
```

**Date and Time:**
```json
{
  "type": "string",
  "title": "Date",
  "format": "date"
}
```

**Selection:**
```json
{
  "type": "string",
  "title": "Choice",
  "enum": ["option1", "option2"],
  "enumNames": ["Option 1", "Option 2"]
}
```

**Boolean:**
```json
{
  "type": "boolean",
  "title": "Consent"
}
```

### Sub-observations

Use **`format: sub-observation`** on an array property for **embedded repeats**: each nested completion stores JSON on the parent observation. Adding or editing opens the linked child form in **sub-observation mode**, so Synkronus still receives **one** parent observation payload.

See [Custom Extensions](./custom-extensions.md#sub-observations-format-sub-observation) for schema keys (`linkedForm`, optional `parentKey`, `parentValuePath`, `subObservationInitValues`, `skipFinalize`, templates, etc.).

**`skipFinalize`:** Skips only the Finalize **page**; the child form still validates on **Done** before returning `formData` to the parent. Validation is **not** deferred to the root form.

**Custom validators** (for example auto-numbering embedded rows) are declared in `ui.json` via `options.customValidators`. Validators run in the **active** form session — for nested trees, attach validators on **each** level where rows are added, not only on the root array. See [Custom Extensions — nested sessions](./custom-extensions.md#nested-sessions-and-custom-validators) and [parent context](./custom-extensions.md#parent-context-across-nesting-levels).

## Control options

Form authors can tune presentation and behaviour per field via the `options` object on a `Control` in `ui.json`.

### Choice display

Plain `oneOf` / shared `$ref` single-select fields default to a **native HTML `<select>`** (keyboard-free, reliable in Formulus WebViews). Opt back into the searchable Autocomplete with `"autocomplete": true`.

| Option | Values | Applies to |
|--------|--------|------------|
| `display` | `"radio"` \| `"buttons"` | Single-select |
| `display` | `"checkboxes"` \| `"buttons"` | Multi-select (`type: array` with `uniqueItems`) |
| `orientation` | `"vertical"` (default) \| `"horizontal"` \| `"flow"` | Radio, checkbox, and button modes |
| `buttonGroup` | `"segmented"` (default) \| `"separated"` | Button modes |
| `autocomplete` | `true` | Single-select — use searchable Autocomplete instead of native select |
| `placeholder` | string | Placeholder for native select (e.g. `"Select…"`) |

**Tap-to-clear:** In `radio` and `buttons` single-select modes, tapping the already-selected option clears the answer.

**Example — horizontal Yes/No buttons:**

```json
{
  "type": "Control",
  "scope": "#/properties/consent",
  "options": {
    "display": "buttons",
    "orientation": "horizontal"
  }
}
```

### Sticky fields

Set `"sticky": true` to remember the last submitted scalar value for that field. Values are stored in device `localStorage`, keyed by form type + version + field path, and applied as the **lowest-precedence** default on **new** observations only (not edits, drafts, or sub-observation sessions).

```json
{
  "type": "Control",
  "scope": "#/properties/interviewer_id",
  "options": { "sticky": true }
}
```

### Dynamic schema defaults

For new observations, Formplayer resolves a small set of **default tokens** in `schema.json` property `default` values (only when the field is still empty after params / `defaultData`):

| Token | Resolves to |
|-------|-------------|
| `$today` | Local calendar date `YYYY-MM-DD` (`format: "date"`) |
| `$now` | ISO 8601 date-time (`format: "date-time"`) |

Static `default` literals are unchanged.

### Deferred validation

New observations start with validation errors hidden (`ValidateAndHide`). Errors appear after the user navigates forward or reaches Finalize. Edits and draft resumes show validation immediately. Override via `params.validationMode`: `"ValidateAndShow"`, `"ValidateAndHide"`, or `"NoValidation"`.

**Draft picker:** On a new root form, Formplayer offers to resume local drafts when any exist. Custom apps pass `skipDraftSelection: true` in `openFormplayer` options to open directly (see [Formulus bridge API](../reference/formulus.md#openformplayer-options)).
### Number bounds

`minimum` / `maximum` are **validation constraints**, not per-keystroke clamps. Users can type out-of-range values; AJV surfaces errors on blur and at finalize. Stepper +/- buttons still respect bounds.

## Working with Media & Special Field Types

ODE Formplayer supports specialized field types for capturing media, location, signatures, and scanning codes. Each type has specific schema requirements and platform constraints.

### Photo Capture

Captures photos using device camera or gallery selection.

**Expected Schema:**
```json
{
  "type": "object",
  "format": "photo",
  "title": "Profile Photo",
  "properties": {
    "filename": { "type": "string" },
    "uri": { "type": "string" },
    "width": { "type": "integer" },
    "height": { "type": "integer" },
    "timestamp": { "type": "string", "format": "date-time" }
  }
}
```

**Required UI Schema:**
```json
{
  "type": "Control",
  "scope": "#/properties/photo"
}
```

**Renderer Behavior:**
- Opens device camera or gallery picker
- Stores photo as attachment (synchronized separately)
- Returns metadata object with filename, URI, dimensions, timestamp

**Platform Constraints:**
- Requires camera permission on mobile devices
- Photo files are stored locally and synced as attachments
- Large photos may be compressed automatically

### GPS Location

Captures GPS coordinates with accuracy information.

**Expected Schema:**
```json
{
  "type": "object",
  "format": "gps",
  "title": "Current Location",
  "properties": {
    "latitude": { "type": "number" },
    "longitude": { "type": "number" },
    "altitude": { "type": "number" },
    "accuracy": { "type": "number" },
    "timestamp": { "type": "string", "format": "date-time" }
  }
}
```

**Required UI Schema:**
```json
{
  "type": "Control",
  "scope": "#/properties/location"
}
```

**Renderer Behavior:**
- Requests location permission (first time)
- Captures current GPS coordinates
- Shows accuracy indicator
- May display map preview (platform dependent)

**Platform Constraints:**
- Requires location permission
- GPS accuracy depends on device capabilities and environment
- Indoor locations may have poor accuracy
- Battery impact: GPS usage drains battery faster

### Signature Capture

Captures digital signatures using touch input.

**Expected Schema:**
```json
{
  "type": "object",
  "format": "signature",
  "title": "Customer Signature",
  "properties": {
    "data": { "type": "string" },  // Base64 encoded image
    "timestamp": { "type": "string", "format": "date-time" }
  }
}
```

**Required UI Schema:**
```json
{
  "type": "Control",
  "scope": "#/properties/signature"
}
```

**Renderer Behavior:**
- Opens signature pad interface
- User draws signature with finger/stylus
- Stores as base64-encoded image
- Provides clear/retry functionality

**Platform Constraints:**
- Works best on touch-enabled devices
- Signature quality depends on screen size and resolution
- Stored as image data (may be large)

### Audio Recording

Records audio using device microphone.

**Expected Schema:**
```json
{
  "type": "object",
  "format": "audio",
  "title": "Voice Note"
}
```

**Required UI Schema:**
```json
{
  "type": "Control",
  "scope": "#/properties/audio"
}
```

**Renderer Behavior:**
- Opens audio recording interface
- Records audio using device microphone
- Stores audio file with metadata (duration, format, file size)
- Provides playback preview

**Platform Constraints:**
- Requires microphone permission
- Audio files are stored as attachments
- File size depends on recording duration and quality
- Format: Platform-dependent (typically MP3, M4A, or WAV)

### Video Recording

Records video using device camera.

**Expected Schema:**
```json
{
  "type": "object",
  "format": "video",
  "title": "Instructional Video"
}
```

**Required UI Schema:**
```json
{
  "type": "Control",
  "scope": "#/properties/video"
}
```

**Renderer Behavior:**
- Opens video recording interface
- Records video using device camera
- Stores video file with metadata (duration, resolution, format)
- Provides playback preview

**Platform Constraints:**
- Requires camera permission
- Video files are large (stored as attachments)
- File size depends on duration and resolution
- Format: Platform-dependent (typically MP4)
- Battery and storage intensive

### File Selection

Allows users to pick an arbitrary file from device storage (documents, exports, etc.). Behaves like other **attachment** fields: the observation stores a **basename** (stable key under app `attachments/`) plus portable metadata; the binary syncs through the attachment pipeline separately from the observation JSON.

**Expected Schema:**
```json
{
  "type": "object",
  "format": "select_file",
  "title": "Upload Document"
}
```

**Required UI Schema:**
```json
{
  "type": "Control",
  "scope": "#/properties/document"
}
```

**Renderer Behavior:**
- Opens the system file picker
- Copies the file into **`attachments/draft/`** with a generated basename (mobile)
- Persists **`filename`** (basename), **`timestamp`**, and **`metadata`** (`mimeType`, `size`, `extension`, optional **`originalFileName`** for display)
- Shows **only the display filename** in the form (no thumbnail or inline preview)

**Platform Constraints:**
- Allowed file types depend on OS picker and Formulus configuration
- Large files affect sync time and storage
- Storage / privacy permissions depend on platform

### QR Code / Barcode Scanner

Scans QR codes and barcodes using device camera.

**Expected Schema:**
```json
{
  "type": "string",
  "format": "qrcode",
  "title": "QR Code Scanner"
}
```

**Required UI Schema:**
```json
{
  "type": "Control",
  "scope": "#/properties/qrCode"
}
```

**Renderer Behavior:**
- Opens camera scanner interface
- Automatically detects and scans codes
- Returns scanned data as string
- Supports multiple barcode formats

**Supported Formats:**
- QR Code
- Code 128
- Code 39
- EAN-13
- UPC-A
- Data Matrix
- PDF417
- Aztec

**Platform Constraints:**
- Requires camera permission
- Requires good lighting for reliable scanning
- Some formats may not be supported on all platforms

### Best Practices for Media Fields

1. **Consider File Sizes**: Media files are large - be mindful of storage and sync bandwidth
2. **Request Permissions Early**: Request camera/microphone/location permissions before users need them
3. **Provide Clear Instructions**: Users may not understand how to use specialized field types
4. **Handle Offline Scenarios**: Media capture works offline, but upload requires connectivity
5. **Test on Real Devices**: Media features behave differently on different devices
6. **Compress When Possible**: Large photos/videos should be compressed before storage
7. **Validate File Types**: Ensure selected files match expected formats

## Conditional Logic in ODE Forms

Conditional logic allows you to show or hide fields based on other field values. This is essential for creating dynamic, context-aware forms.

### How Rules Work

Rules are defined in the UI schema using the `rule` property on Control elements. Rules evaluate conditions and apply effects (SHOW or HIDE) based on the result.

**Basic Rule Structure:**
```json
{
  "type": "Control",
  "scope": "#/properties/targetField",
  "rule": {
    "effect": "SHOW",  // or "HIDE"
    "condition": {
      "scope": "#/properties/sourceField",
      "schema": {
        // Condition schema
      }
    }
  }
}
```

:::warning Clear-on-hide deletes the field value
When Formplayer hides a **Control** (`SHOW` until the condition is true, or `HIDE` when the condition is true), it **clears that field’s value** from the observation (ODK-style `relevant` behaviour). This is intentional for user-entered answers that should not stay when the question is no longer relevant.

**Do not** put `SHOW`/`HIDE` on fields you need to keep—especially values injected by a custom app via `defaultData` (cluster IDs, device role, AF codes, enrollment mode, etc.).

**Recommended pattern for injected / stamp fields:**

1. Declare the field in `schema.json` so it can be stored and validated.
2. Pass it in `openFormplayer` / `FormInitData` as `params.defaultData`.
3. **Do not** add a UI `Control` for that field (or never attach a visibility rule to it).
4. If the enumerator must **see** the value, use a separate display-only / computed proxy (for example `lbl_region`, `lbl_af`) or list the stamp in SwipeLayout `headerFields`—not a hidden Control on the real field.

Using a Control solely to “hide” an injected field will wipe the inject on open and can cause required-field failures or silent data loss.
:::

### Scope Resolution Rules

**Critical Rule**: Rule condition scopes **must exist in the schema at all times**, even when the field is hidden. The scope is evaluated against the current form data.

**Safe Pattern:**
```json
{
  "schema": {
    "type": "object",
    "properties": {
      "contactMethod": {
        "type": "string",
        "enum": ["email", "phone"]
      },
      "email": {
        "type": "string",
        "format": "email"
      },
      "phone": {
        "type": "string"
      }
    }
  },
  "uischema": {
    "type": "SwipeLayout",
    "elements": [
      {
        "type": "VerticalLayout",
        "elements": [
          {
            "type": "Control",
            "scope": "#/properties/contactMethod"
          },
          {
            "type": "Control",
            "scope": "#/properties/email",
            "rule": {
              "effect": "SHOW",
              "condition": {
                "scope": "#/properties/contactMethod",  // ✅ Scope exists in schema
                "schema": {
                  "const": "email"
                }
              }
            }
          },
          {
            "type": "Control",
            "scope": "#/properties/phone",
            "rule": {
              "effect": "SHOW",
              "condition": {
                "scope": "#/properties/contactMethod",  // ✅ Scope exists in schema
                "schema": {
                  "const": "phone"
                }
              }
            }
          }
        ]
      }
    ]
  }
}
```

### Safe Patterns

#### Equality Check

Show field when another field equals a specific value:

```json
{
  "type": "Control",
  "scope": "#/properties/email",
  "rule": {
    "effect": "SHOW",
    "condition": {
      "scope": "#/properties/contactMethod",
      "schema": {
        "const": "email"
      }
    }
  }
}
```

#### Enum Value Check

Show field when another field is one of several values:

```json
{
  "type": "Control",
  "scope": "#/properties/otherDetails",
  "rule": {
    "effect": "SHOW",
    "condition": {
      "scope": "#/properties/category",
      "schema": {
        "enum": ["category1", "category2"]
      }
    }
  }
}
```

#### Boolean Check

Show field when boolean is true:

```json
{
  "type": "Control",
  "scope": "#/properties/consentDetails",
  "rule": {
    "effect": "SHOW",
    "condition": {
      "scope": "#/properties/hasConsent",
      "schema": {
        "const": true
      }
    }
  }
}
```

#### Multi-select choice check

For **array** multi-select fields, use `contains` with `const` (not `const` on the array itself):

```json
{
  "type": "Control",
  "scope": "#/properties/other_symptoms",
  "rule": {
    "effect": "SHOW",
    "condition": {
      "scope": "#/properties/symptoms",
      "schema": {
        "contains": { "const": "other" }
      }
    }
  }
}
```

Custom question types (`format` renderers) and the root `SwipeLayout` element also honour `SHOW` / `HIDE` rules.

### Unsafe Patterns

#### ❌ Rule Referencing Missing Field

**Problem**: Rule condition scope doesn't exist in schema.

```json
{
  "schema": {
    "properties": {
      "field1": { "type": "string" }
      // field2 doesn't exist
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/field1",
    "rule": {
      "condition": {
        "scope": "#/properties/field2",  // ❌ Field doesn't exist - will crash
        "schema": { "const": "value" }
      }
    }
  }
}
```

**Fix**: Ensure all fields referenced in rules exist in the schema.

#### ❌ Using $data References

**Problem**: `$data` references are not supported and will cause errors.

```json
{
  "type": "Control",
  "scope": "#/properties/field1",
  "rule": {
    "condition": {
      "scope": "#/properties/field2",
      "schema": {
        "minimum": { "$data": "#/properties/minValue" }  // ❌ $data not supported
      }
    }
  }
}
```

**Fix**: Use literal values only:

```json
{
  "type": "Control",
  "scope": "#/properties/field1",
  "rule": {
    "condition": {
      "scope": "#/properties/field2",
      "schema": {
        "minimum": 0  // ✅ Literal value
      }
    }
  }
}
```

#### ❌ Using if/then/else

**Problem**: JSON Schema `if/then/else` is not supported in rule conditions.

```json
{
  "rule": {
    "condition": {
      "scope": "#/properties/field",
      "schema": {
        "if": { "type": "string" },  // ❌ Not supported
        "then": { "const": "value" }
      }
    }
  }
}
```

**Fix**: Use simple const or enum checks instead.

### Best Practices for Conditional Logic

1. **Always Define Referenced Fields**: Every field referenced in a rule condition must exist in the schema
2. **Use Simple Conditions**: Prefer `const` and `enum` over complex schema conditions
3. **Test All Conditions**: Verify rules work for all possible field values
4. **Avoid Circular Dependencies**: Don't create rules that depend on each other
5. **Document Complex Logic**: Comment complex conditional logic in your form specifications

## Advanced Features

### Multimedia Capture

Forms can include fields for capturing photos, audio, and video, and for attaching generic files (`select_file`). These binaries are handled as **attachments** and synchronized separately from observation metadata (observation JSON holds basename + metadata).

### Location Capture

GPS coordinates can be captured automatically or manually entered.

### File Attachments

Files can be attached to observations and are synchronized separately from the observation data.

## Form Versioning

Forms support versioning to allow updates while maintaining compatibility with existing observations. When editing an observation, the form version used to create it is used.

## Form Design Best Practices by Application Type

Different application types have different requirements and constraints. Follow these best practices for your specific use case.

### Research Data Collection

**Characteristics**: Structured data collection, often longitudinal, requires high data quality.

**Best Practices:**
1. **Use Clear Field Names**: Use descriptive, research-standard field names (e.g., `participant_id`, `visit_date`)
2. **Implement Validation**: Strict validation rules to ensure data quality
3. **Version Control**: Carefully version forms to maintain data consistency
4. **Minimize Required Fields**: Only require essential fields to reduce data entry burden
5. **Use Conditional Logic**: Show relevant fields based on participant characteristics
6. **Document Changes**: Maintain detailed changelog for form versions

**Example Pattern:**
```json
{
  "schema": {
    "properties": {
      "participant_id": {
        "type": "string",
        "title": "Participant ID",
        "pattern": "^P-[0-9]{4}$"
      },
      "visit_number": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10
      }
    },
    "required": ["participant_id", "visit_number"]
  }
}
```

### Medical / Clinical Records

**Characteristics**: Sensitive data, regulatory compliance, complex workflows.

**Best Practices:**
1. **Consent Management**: Always include consent fields with clear labels
2. **Date/Time Precision**: Use precise date-time fields for clinical events
3. **Signature Requirements**: Use signature fields for consent and approvals
4. **Photo Documentation**: Use photo fields for wound tracking, skin conditions, etc.
5. **Structured Data**: Use enums for standardized values (e.g., diagnosis codes)
6. **Audit Trail**: Forms should capture who, what, when for audit purposes
7. **HIPAA/GDPR Compliance**: Ensure forms comply with data protection regulations

**Example Pattern:**
```json
{
  "schema": {
    "properties": {
      "consent_obtained": {
        "type": "boolean",
        "title": "Patient consent obtained"
      },
      "consent_signature": {
        "type": "object",
        "format": "signature",
        "title": "Patient signature"
      },
      "visit_date": {
        "type": "string",
        "format": "date-time",
        "title": "Visit date and time"
      }
    },
    "required": ["consent_obtained", "consent_signature", "visit_date"]
  }
}
```

### Surveys with Consent

**Characteristics**: User-facing, requires clear consent, may be anonymous.

**Best Practices:**
1. **Consent First**: Place consent fields at the beginning of the form
2. **Clear Language**: Use plain language, avoid jargon
3. **Progress Indicators**: Show progress to encourage completion
4. **Optional Fields**: Mark optional fields clearly
5. **Privacy Notice**: Include privacy information if collecting personal data
6. **Thank You Message**: Provide confirmation after submission

**Example Pattern:**
```json
{
  "uischema": {
    "type": "SwipeLayout",
    "elements": [
      {
        "type": "VerticalLayout",
        "elements": [
          {
            "type": "Label",
            "text": "Consent and Privacy"
          },
          {
            "type": "Control",
            "scope": "#/properties/consent_read",
            "label": "I have read and understood the consent form"
          },
          {
            "type": "Control",
            "scope": "#/properties/consent_agreed",
            "rule": {
              "effect": "SHOW",
              "condition": {
                "scope": "#/properties/consent_read",
                "schema": { "const": true }
              }
            }
          }
        ]
      }
    ]
  }
}
```

### Longitudinal Forms

**Characteristics**: Same form used multiple times, data comparison over time.

**Best Practices:**
1. **Consistent Structure**: Maintain consistent field structure across versions
2. **Version Tracking**: Track which version was used for each observation
3. **Baseline Data**: Include baseline measurement fields
4. **Change Detection**: Use conditional logic to highlight changes
5. **Date Tracking**: Always include date/time fields for temporal analysis
6. **Backward Compatibility**: Ensure new versions don't break existing data

**Example Pattern:**
```json
{
  "schema": {
    "properties": {
      "measurement_date": {
        "type": "string",
        "format": "date",
        "title": "Measurement Date"
      },
      "baseline_value": {
        "type": "number",
        "title": "Baseline Value"
      },
      "current_value": {
        "type": "number",
        "title": "Current Value"
      },
      "change_from_baseline": {
        "type": "number",
        "title": "Change from Baseline",
        "readOnly": true  // Calculated field
      }
    }
  }
}
```

### General Best Practices

**Form Structure:**
1. **Keep Forms Focused**: Each form should have a clear, single purpose
2. **Logical Grouping**: Group related fields together using Groups or separate pages
3. **Progressive Disclosure**: Use conditional logic to show fields only when relevant
4. **Clear Navigation**: Use SwipeLayout for multi-step forms with clear progress indicators

**Field Design:**
1. **Use Clear Labels**: Field labels should be descriptive and unambiguous
2. **Provide Help Text**: Use descriptions or placeholders to guide users
3. **Validate Input**: Use validation rules to catch errors early
4. **Use Appropriate Types**: Choose the right field type for the data (date picker for dates, not text)

**Data Quality:**
1. **Required Fields**: Only require truly essential fields
2. **Default Values**: Provide sensible defaults when appropriate
3. **Enum Constraints**: Use enums for fields with limited valid values
4. **Format Validation**: Use format validation (email, date, etc.) when applicable

**Testing:**
1. **Test All Paths**: Test all conditional logic branches
2. **Test Validation**: Verify validation rules work correctly
3. **Test on Devices**: Test on actual mobile devices, not just emulators
4. **Test Offline**: Verify forms work correctly in offline mode
5. **User Testing**: Get feedback from actual users before deployment

## Validating Forms Before Deployment

Validating forms before deployment prevents errors and ensures forms work correctly in production. This section covers validation tools and workflows.

### Validation Tools

#### Form Validation Script

ODE provides a validation script (`validate-forms.js`) that checks forms for common issues:

**Usage:**
```bash
npm run validate:forms
```

**Checks Performed:**
- JSON Schema syntax validation
- UI Schema format validation
- Field reference validation (scope paths exist in schema)
- Required field validation
- Conditional logic validation (rule scopes exist)
- SwipeLayout structure validation

**Common Validation Failures:**

1. **Invalid JSON Schema:**
   ```
   Error: Schema validation failed
   - Property "minimum" must be a number
   ```
   **Fix**: Ensure `minimum`/`maximum` use literal numbers, not `$data` references

2. **Missing Scope:**
   ```
   Error: Scope "#/properties/missingField" not found in schema
   ```
   **Fix**: Add the referenced field to the schema or correct the scope path

3. **Invalid UI Schema Structure:**
   ```
   Error: SwipeLayout missing required "elements" array
   ```
   **Fix**: Ensure SwipeLayout has an `elements` array (can be empty)

4. **Rule Scope Error:**
   ```
   Error: Rule condition scope "#/properties/field" not found
   ```
   **Fix**: Ensure all fields referenced in rules exist in the schema

### CI Integration

Integrate form validation into your CI/CD pipeline:

**GitHub Actions Example:**
```yaml
name: Validate Forms

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run validate:forms
```

**GitLab CI Example:**
```yaml
validate_forms:
  script:
    - npm install
    - npm run validate:forms
```

### Recommended Workflow

1. **Local Validation**: Run validation script before committing changes
2. **Pre-commit Hooks**: Set up git hooks to validate forms automatically
3. **CI Validation**: Include validation in CI pipeline to catch errors early
4. **Manual Testing**: Test forms on actual devices before deployment
5. **Staging Deployment**: Deploy to staging environment and test thoroughly
6. **Production Deployment**: Only deploy validated, tested forms

### Validation Checklist

Before deploying a form, verify:

- [ ] JSON Schema is valid JSON Schema Draft 7
- [ ] All scope paths in UI schema exist in JSON schema
- [ ] SwipeLayout is root element (or will be auto-wrapped)
- [ ] All rule condition scopes exist in schema
- [ ] No `$data` references used
- [ ] No `if/then/else` in rule conditions
- [ ] All required fields are clearly marked
- [ ] Validation rules use literal values (not dynamic)
- [ ] Media field types have correct schema structure
- [ ] Form tested on actual mobile devices
- [ ] Form tested in offline mode
- [ ] All conditional logic paths tested

### Troubleshooting Validation Errors

**"minimum value must be ['number']"**
- **Cause**: Using `$data` or non-numeric value in `minimum`
- **Fix**: Use literal number: `"minimum": 0`

**"Cannot read properties of undefined (reading 'find')"**
- **Cause**: Layout missing `elements` array, invalid scope, or rule referencing missing field
- **Fix**: 
  - Add `elements: []` to layouts
  - Validate all scope paths exist
  - Ensure rule scopes reference existing fields

**"Rule condition scope not found"**
- **Cause**: Rule references field that doesn't exist in schema
- **Fix**: Add the referenced field to schema or correct the scope path

## Related Documentation

- [Form Specifications Reference](/reference/form-specifications)
- [Formplayer Supported Schema & UI Profile](/reference/formplayer#supported-schema--ui-profile)
- [Formplayer Errors Explained](/using/troubleshooting#formplayer-errors)
- [Your First Form](/using/your-first-form)
- [Custom Applications](/guides/custom-applications)

