---
sidebar_position: 5
---

# Custom Extensions

Create custom question types and extend the Formulus Formplayer with specialized input fields.

:::info Production Ready
The ODE extension system allows developers to package custom question types that work seamlessly with the form system. Extensions are deployed via app bundles and automatically available to all users.
:::

## Overview

The extension system enables you to:

- **Custom Question Types** - Add specialized input components beyond built-in types
- **Business Logic** - Implement domain-specific validation and processing
- **Reusable Components** - Package extensions for distribution to other implementations
- **Automatic Distribution** - Deploy via app bundles; users get updates automatically

## Profile-aware extensions

Custom renderers and validators run in a Formplayer WebView for the **active host profile**. Formulus owns the profile's observation database, attachments, app bundle cache, and Formplayer draft storage. Switch profiles from the Formulus **Profiles** screen; switching remounts the WebView rather than changing its profile in place.

For extension-owned browser preferences, use the synchronous bridge helpers `formulus.getProfileId()` and `formulus.getLocalStorageRef()` (after the bridge is ready). The latter supports `getItem`, `setItem`, `removeItem`, and `clear` for keys in `ode:{profileId}:app:{key}`; `clear` affects only this profile's app namespace. Avoid raw `localStorage`: a shared `file://` origin may expose raw keys to other profiles or third-party code. Profiles provide organizational/storage namespacing, **not a sandbox or confidentiality boundary**, nor a guarantee that third-party raw keys will be erased on profile deletion. Depending on WebView file-access settings and device behavior, code in a form extension or custom app may read other profiles' data or attachments via file access. A connected Synkronus server can supply bundles with such code, though connecting does not mean every server executes arbitrary code. Connect only to trusted servers and install only trusted app bundles; do not store secrets in browser storage. See [Formulus JavaScript interface](../reference/formulus.md#getprofileid-and-getlocalstorageref) and [custom-app storage guidance](./custom-applications.md#profile-aware-browser-storage).

## Sub-observations (`format: sub-observation`)

:::tip Built-in Formplayer control
Sub-observations are rendered by **Formplayer itself**. You declare them on the parent form’s JSON Schema.
:::

Use sub-observations when related answers should live **inside the parent observation** as an **embedded JSON array** of child payloads, instead of separate top-level observations per child.

### Behavior

- The parent schema defines one property (often `type: "array"`) with `"format": "sub-observation"` plus the configuration keys below.
- Each completed child payload is plain JSON appended or updated in that array when the enumerator finishes the nested **child form**.
- **Add / Edit** opens the child form through the Formulus API [`openFormplayer`](../reference/formulus.md) with `{ subObservationMode: true }`. The nested session returns child JSON **without** creating a separate synced observation for each completion.
- **Remove** deletes one embedded payload from the parent array only (within the current parent draft or saved observation).

### Schema configuration

| Property | Required | Description |
|----------|----------|-------------|
| `format` | yes | Must be `"sub-observation"`. |
| `linkedForm` | yes | Child **form type** opened for add/edit (non-empty string). |
| `parentKey` | optional | When set, field name written on **new** child payloads linking back to the parent (for example a foreign key). When omitted, embedded repeats rely on data already nested in the parent JSON — typical when the child form does not need an injected parent id. |
| `parentValuePath` | recommended when `parentKey` is set | Dot path into **current parent form data** for that key’s value (falls back to parent `observationId` when absent). |
| `columns` | optional | `{ key, label }[]` entries for the on-screen summary list; if omitted, `displayField` drives a single summary column. |
| `displayField` | optional | Fallback field key for the summary column (default `observationId`). |
| `itemLabel` | optional | Singular name for each embedded item (for example `"room"`). When set, the add button shows `+ Add {itemLabel}`, the empty table shows `No {itemLabel}`, and delete confirmations fall back to `this {itemLabel}`. When omitted, legacy copy is unchanged (`+ Add observation`, etc.). |
| `orderBy` | optional | Sort embedded items by field: string field name or `{ key, direction }` (`asc` / `desc`). Without `key`, sorts by `createdAt` descending when present on payloads. |
| `allowDelete` | optional | Default `true`. |
| `subObservationInitValues` | optional | Map merged into **initial params** when **adding** a new embedded child. Values support templates `{{parentValue}}`, `{{currentInstanceId}}`, or `{{dot.path}}` into parent data. |
| `subObservationEditInitValues` | optional | Map merged **on top of** the saved child payload when **opening an existing** embedded item for edit—useful when parent-derived fields must be refreshed each time (often omitted). |
| `skipFinalize` | optional | When `true`, the nested child form **omits the Finalize page**; **Done** on the last content page runs the same submit path as Finalize. The child is still validated against **its own** `schema.json` (AJV + that form's custom validators) before `formData` is returned to the parent. Formulus also skips GPS `beginObservationSession()` and suppresses the success modal for this fast path. Can be set on the schema property or passed via `openFormplayer(..., { skipFinalize: true })`. |

**`openFormplayer` options (custom apps):** `{ subObservationMode?, skipFinalize?, skipDraftSelection? }`. Use `skipDraftSelection: true` on **root** forms when the custom app orchestrates the session and must not show the draft picker (for example headless follow-up after `persistObservation`). Sub-observation sessions never offer the draft picker.

**UI schema override:** On the parent `ui.json` Control, `options.addButtonLabel` sets the **full** add-button text (JSON Forms array convention). It takes precedence over `itemLabel` when both are set — useful for localized phrasing (for example `"+ Adicionar quarto"`).

### Validation and `skipFinalize`

`skipFinalize` does **not** defer validation to the root form. Each nested session is a separate Formplayer instance with its own `ui.json` and schema:

| When | What validates |
|------|----------------|
| Child **Done** / submit (`skipFinalize` or Finalize page) | Child form only — required fields, AJV, `options.customValidators` on **that** form |
| Parent data change / parent Finalize | Parent form — including validators on embedded arrays at the parent level |

On success, `SubObservationQuestionRenderer` merges `result.formData` into the parent array and closes the child modal immediately. Parent-level logic (denormalized indexes, cross-row rules, global sequence numbers) does **not** run inside the child session unless you duplicate it there or pass context in (see below).

### Nested sessions and custom validators

Custom validators run in the **active Formplayer session only**. For a multi-level embedded tree (for example `household → rooms[] → beds[] → persons[]`):

- A validator on the **root** form's `rooms` control runs when **root** `data` changes — not when the enumerator adds a bed inside an open **room** sub-form.
- Put validators on **each form** where rows are added if numbering or summary columns must update as soon as the child returns (typical with `skipFinalize`).
- Use **config** (for example `scope: "household" | "quarto" | "cama"`) so one validator module can serve multiple form types.

**Authoring checklist for auto-numbering embedded rows:**

1. Root form — validator on the top-level sub-observation array; rebuild parent-only indexes (for example a flattened lookup array).
2. Each nested child form — validator on its own sub-observation array for local sequence fields (`bed_num`, `person_num`, …).
3. **Global** sequences across the whole tree — pass a read-only snapshot from the parent via flat `subObservationInitValues` / `subObservationEditInitValues` (single-token templates preserve JSON types), or wait for platform **parent context** (below). Strip ephemeral snapshot fields on root finalize so they are not persisted.

See [Custom validators](#custom-validators-validators) and [Parent context across nesting levels](#parent-context-across-nesting-levels).

### Parent context across nesting levels

Nested `openFormplayer` sessions receive only the **current row** as `core.data`, not the full parent observation. That limits cross-sibling validation, global numbering, and extension helpers that need ancestor fields.

**Today (workaround):** Copy needed parent slices into child **data** with flat init templates, for example `"household_rooms": "{{rooms}}"` on `subObservationInitValues`. Formplayer resolves **top-level string templates only** — not nested object maps. Mark snapshot fields `readOnly` and remove them in a root-level validator before persist. Distinct from `format: "form_context"` / `params.context`, which are better for session metadata than large tree copies.

**Proposed (not yet in ODE):** `subObservationContext` — read-only parent snapshot resolved at open time, exposed to validators/extensions, **not** validated against the child schema and **not** merged into persisted child JSON. Until then, use init templates or duplicate validators per level.

Example property on the parent schema:

```json
{
  "linked_visits": {
    "type": "array",
    "format": "sub-observation",
    "title": "Visits",
    "linkedForm": "visit",
    "parentKey": "household_id",
    "parentValuePath": "hh_id",
    "displayField": "visit_date",
    "allowDelete": true,
    "subObservationInitValues": {
      "household_id": "{{parentValue}}"
    }
  }
}
```

:::note Types in legacy forms
Some forms use `type: ["array", "string"]` with `"format": "sub-observation"` for migration compatibility; Formplayer activates the control whenever `format` matches.
:::

## Custom validators (`validators/`)

Bundle **custom validators** alongside custom question types. Register them in the app manifest (`validators/<name>/index.js`); reference them from `ui.json` control `options.customValidators`.

```json
{
  "type": "Control",
  "scope": "#/properties/quartos",
  "options": {
    "customValidators": [
      { "name": "assignRepeatPositions", "config": { "quartosField": "quartos" } }
    ]
  }
}
```

**Mutating validators:** A validator may update `data` in place (for example auto-numbering embedded sub-observation rows or rebuilding a denormalized index array). Formplayer detects mutations after each change and before finalize, then refreshes form state so summary tables and dependent fields update immediately. Return validation errors in the usual way; returning patches is not required.

**Per-session scope:** Mutations apply to the **current** form session. Nested sub-observations need validators on each level where rows are added, or a parent snapshot field (see [Parent context across nesting levels](#parent-context-across-nesting-levels)). Root-only validators are not enough for deep embedded trees.

```json
{
  "type": "Control",
  "scope": "#/properties/beds",
  "options": {
    "customValidators": [
      {
        "name": "assignRepeatPositions",
        "config": { "scope": "room", "bedsField": "beds" }
      }
    ]
  }
}
```

See also [Form specifications](../reference/form-specifications.md) and [Formplayer](../reference/formplayer.md).

## Quick Start

### Creating a Custom Question Type

A custom question type consists of:

1. **TypeScript/JavaScript Component** - React component for rendering
2. **Type Definition** - JSON schema for form configuration
3. **Registration** - Entry in the extension registry

**Example: Custom Phone Number Input**

```typescript
// phone-number-type.tsx

import React from 'react';
import { Control } from 'react-hook-form';

interface PhoneNumberProps {
  value: string;
  onChange: (value: string) => void;
  format: 'intl' | 'local';  // From UI Schema
  country?: string;          // From UI Schema
  required?: boolean;
  error?: string;
}

export const PhoneNumberControl: React.FC<PhoneNumberProps> = ({
  value,
  onChange,
  format,
  country,
  error,
  required
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Custom formatting logic
    const cleaned = input.replace(/\D/g, '');
    const formatted = formatPhoneNumber(cleaned, format, country);
    onChange(formatted);
  };

  return (
    <div>
      <input
        type="tel"
        value={value}
        onChange={handleChange}
        placeholder={getPlaceholder(format, country)}
        required={required}
        aria-invalid={!!error}
      />
      {error && <span className="error">{error}</span>}
    </div>
  );
};

// Helper functions
function formatPhoneNumber(
  digits: string,
  format: 'intl' | 'local',
  country?: string
): string {
  if (format === 'intl') {
    return `+${digits}`;  // International format
  }
  // Local format based on country
  if (country === 'UG') {
    return digits.replace(/(\d{3})(\d{2})(\d{6})/, '+256$2 $3');
  }
  return digits;
}

function getPlaceholder(format: 'intl' | 'local', country?: string): string {
  if (format === 'intl') return '+256 701 234567';
  if (country === 'UG') return '0701 234567';
  return '(Enter phone number)';
}
```

### Defining in Schema

Define the custom type in your form schema:

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "phone": {
        "type": "string",
        "title": "Phone Number",
        "x-custom": {
          "type": "phone-number",
          "format": "intl",
          "country": "UG"
        }
      }
    }
  },
  "uischema": {
    "type": "VerticalLayout",
    "elements": [
      {
        "type": "Control",
        "scope": "#/properties/phone"
      }
    ]
  }
}
```

### Registering the Extension

Extensions are registered when the app initializes using the extension system:

```typescript
// In Formulus initialization or custom app setup

import { registerExtension } from '@ode/formulus-extensions';
import { PhoneNumberControl } from './phone-number-type';

registerExtension({
  name: 'phone-number',
  renderer: PhoneNumberControl,
  schema: {
    type: 'string',
    x-custom: {
      type: 'phone-number'
    }
  },
  validation: {
    pattern: '^\\+?\\d{6,15}$',
    minLength: 6,
    maxLength: 15
  },
  metadata: {
    displayName: 'Phone Number',
    description: 'International or local phone number input',
    version: '1.0.0'
  }
});
```

## Extension Types

### 1. Custom Question Type

New input component for collecting specific data types:

```typescript
interface QuestionTypeExtension {
  name: string;                    // Unique type ID
  renderer: React.ComponentType;   // React component
  supportedFormats?: string[];     // Optional format variants
  validation?: ValidationSchema;   // Validation rules
  metadata: ExtensionMetadata;
}
```

**Examples:**
- Phone number with formatting
- GPS coordinate input with map
- Color picker
- Time range selector
- Signature capture with pressure

### 2. Business Logic Extension

Custom functions for validation, calculation, or data processing:

```typescript
interface BusinessLogicExtension {
  name: string;
  description: string;
  functions: {
    [key: string]: (params: any) => any;
  };
  metadata: ExtensionMetadata;
}

// Example: Custom validation function
registerLogicExtension({
  name: 'advanced-validations',
  functions: {
    validateHouseholdStructure: (household) => {
      // Validate household relationships
      const adults = household.members.filter(m => m.age >= 18);
      return adults.length > 0;
    },
    calculateHouseholdSize: (household) => {
      return household.members.length;
    }
  }
});

// Use in form
{
  "type": "object",
  "properties": {
    "members": {
      "type": "array",
      "x-validation": {
        "function": "validateHouseholdStructure"
      }
    }
  }
}
```

### 3. Data Enhancement Extension

Augment observations with computed or retrieved data:

```typescript
interface DataEnhancementExtension {
  name: string;
  enhancers: {
    [key: string]: (obs: Observation) => Promise<any>;
  };
}

// Example: Fetch location name from coordinates
registerDataEnhancer({
  name: 'location-enrichment',
  enhancers: {
    reverseGeocode: async (observation) => {
      const { lat, lng } = observation.data.location;
      const response = await fetch(
        `https://api.example.com/reverse?lat=${lat}&lng=${lng}`
      );
      return {
        location_name: response.locality,
        location_admin: response.admin2,
        location_country: response.country
      };
    }
  }
});
```

## Packaging Extensions

### App Bundle Structure

Extensions are distributed as part of the app bundle:

```
app-bundle.zip
├── forms/
│   └── *.json                    # Form definitions
├── question_types/
│   ├── custom-phone-number.js
│   ├── custom-map-field.js
│   └── custom-signature.js
├── logic/
│   ├── household-validations.js
│   └── calculations.js
├── styles/
│   └── extensions.css           # Custom CSS for extensions
└── metadata.json
```

### Metadata File

Define extension metadata in `metadata.json`:

```json
{
  "version": "1.2.0",
  "description": "Custom question types for household surveys",
  "forms": ["household", "hh_person", "hh_follow_up"],
  "extensions": [
    {
      "name": "phone-number",
      "type": "question-type",
      "description": "International phone number input",
      "version": "1.0.0"
    },
    {
      "name": "location-detail",
      "type": "question-type",
      "description": "GPS with map preview",
      "version": "1.1.0"
    },
    {
      "name": "household-validations",
      "type": "business-logic",
      "description": "Validation rules for household data",
      "version": "1.0.0"
    }
  ],
  "dependencies": [
    "formulus >= 1.0.0",
    "formplayer >= 1.0.0"
  ],
  "author": "Your Organization",
  "license": "MIT"
}
```

## Deployment

### Upload App Bundle

Use the Synkronus CLI or API to deploy:

```bash
synk app-bundle upload path/to/bundle.zip
```

Or API:

```bash
curl -X PUT https://synkronus.example.com/api/v1/app-bundle \
  -H "Authorization: Bearer $TOKEN" \
  -F "bundle=@bundle.zip"
```

### Versioning

Maintain multiple versions:

```bash
# List versions
synk app-bundle list

# Activate specific version
synk app-bundle activate 1.2.0

# Previous version remains available for older clients
```

### Safe Rollback

If issues occur:

```bash
# Immediately activate previous version
synk app-bundle activate 1.1.0

# Clients will pull updated bundle on next sync
```

## Best Practices

### Design

✅ **Do:**
- Keep extensions focused and single-purpose
- Follow component composition patterns
- Reuse core Formulus components where possible
- Implement accessibility (ARIA labels, keyboard navigation)
- Support theme customization
- Validate input on every change

❌ **Don't:**
- Create monolithic extensions doing too much
- Rely on external APIs without fallbacks
- Hard-code strings (use i18n)
- Break from standard form patterns
- Ignore edge cases
- Store sensitive data locally

### Performance

- Minimize bundle size (extensions increase app size)
- Lazy load if possible
- Cache expensive computations
- Avoid blocking operations
- Test on slow networks and low-end devices

### Compatibility

- Test across devices (Android 8+, iOS 13+)
- Support multiple screen sizes
- Handle orientation changes
- Verify offline functionality
- Test with real field data

## Example Implementation

### Complete Custom Time Range Picker

```typescript
// time-range-picker.tsx

import React, { useState } from 'react';

interface TimeRange {
  start: string;  // HH:MM
  end: string;    // HH:MM
}

interface TimeRangePickerProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  label?: string;
}

export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  value,
  onChange,
  label
}) => {
  const [startTime, setStartTime] = useState(value?.start || '');
  const [endTime, setEndTime] = useState(value?.end || '');

  const handleChange = (newStart: string, newEnd: string) => {
    setStartTime(newStart);
    setEndTime(newEnd);
    onChange({ start: newStart, end: newEnd });
  };

  const isValidRange = !startTime || !endTime || startTime <= endTime;

  return (
    <div className="time-range-picker">
      {label && <label>{label}</label>}
      
      <div className="time-inputs">
        <div className="time-field">
          <label htmlFor="start">Start Time</label>
          <input
            id="start"
            type="time"
            value={startTime}
            onChange={(e) => handleChange(e.target.value, endTime)}
          />
        </div>

        <div className="separator">to</div>

        <div className="time-field">
          <label htmlFor="end">End Time</label>
          <input
            id="end"
            type="time"
            value={endTime}
            onChange={(e) => handleChange(startTime, e.target.value)}
          />
        </div>
      </div>

      {!isValidRange && (
        <div className="error">End time must be after start time</div>
      )}
    </div>
  );
};
```

Register it:

```typescript
registerExtension({
  name: 'time-range',
  renderer: TimeRangePicker,
  metadata: {
    displayName: 'Time Range',
    description: 'Select start and end times',
    version: '1.0.0'
  }
});
```

Use in form:

```json
{
  "working_hours": {
    "type": "object",
    "x-custom": {
      "type": "time-range"
    },
    "properties": {
      "start": { "type": "string" },
      "end": { "type": "string" }
    }
  }
}
```

## Development Workflow

1. **Setup** - Create React project for extension
2. **Develop** - Build and test component locally
3. **Test** - Verify in Formulus with test forms
4. **Package** - Bundle into app-bundle.zip
5. **Deploy** - Upload via CLI or API
6. **Verify** - Check deployment and monitor usage
7. **Update** - Continue improving based on feedback

## Testing Extensions

### Unit Tests

```typescript
import { render, screen } from '@testing-library/react';
import { TimeRangePicker } from './time-range-picker';

describe('TimeRangePicker', () => {
  it('should accept time range', () => {
    const onChange = jest.fn();
    render(
      <TimeRangePicker
        value={{ start: '09:00', end: '17:00' }}
        onChange={onChange}
        label="Working Hours"
      />
    );

    const inputs = screen.getAllByRole('textbox');
    expect(inputs[0]).toHaveValue('09:00');
    expect(inputs[1]).toHaveValue('17:00');
  });

  it('should validate time range', () => {
    const { getByText } = render(
      <TimeRangePicker
        value={{ start: '17:00', end: '09:00' }}
        onChange={() => {}}
      />
    );

    expect(getByText(/End time must be after start time/)).toBeInTheDocument();
  });
});
```

### Integration Tests

Test with actual forms and the Formulus environment.

## Related Content

- [Form Design](/docs/guides/form-design) - Learn about form structure and types
- [Custom Question Types](/docs/guides/custom-question-types) - Current renderer contract and packaging
- [Formplayer Reference](/docs/reference/formplayer) - Built-in question types
- [App Bundle Format](/docs/reference/app-bundle-format) - Full bundle specification
- [Deployment](/docs/guides/deployment) - Deploy to production