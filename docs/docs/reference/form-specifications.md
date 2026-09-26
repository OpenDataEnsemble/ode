---
sidebar_position: 3
---

# Form Specifications

Technical specification for ODE form definitions using JSON schema and JSON Forms.

## Overview

Forms in ODE are defined using two JSON documents:

1. **Schema**: Defines the data structure and validation rules (JSON Schema)
2. **UI Schema**: Defines how the form is presented to users (JSON Forms UI Schema)

Both follow established standards: JSON Schema for data validation and JSON Forms for UI specification.

## Schema Format

The schema follows the JSON Schema specification (draft 7). It defines the structure and validation rules for form data.

### Basic Structure

```json
{
  "type": "object",
  "properties": {
    "fieldName": {
      "type": "string",
      "title": "Field Label",
      "description": "Field description"
    }
  },
  "required": ["fieldName"]
}
```

### Property Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text input | Names, descriptions, text fields |
| `integer` | Whole number | Age, count, quantity |
| `number` | Decimal number | Weight, temperature, measurements |
| `boolean` | True/false value | Consent, agreement, flags |
| `array` | List of items | Multiple selections, lists |
| `object` | Nested object | Complex data structures |

### Validation Rules

Common validation rules:

```json
{
  "type": "string",
  "minLength": 5,
  "maxLength": 100,
  "pattern": "^[A-Za-z]+$",
  "format": "email"
}
```

**Available formats:**
- `email`: Email address validation
- `date`: Date validation (ISO 8601)
- `date-time`: Date and time validation
- `uri`: URI validation
- `uuid`: UUID validation

**Numeric constraints:**
- `minimum` / `maximum`: For numbers
- `exclusiveMinimum` / `exclusiveMaximum`: Exclude boundary values
- `multipleOf`: Must be multiple of value

**String constraints:**
- `minLength` / `maxLength`: String length
- `pattern`: Regular expression pattern

### Enumeration

Define allowed values:

```json
{
  "type": "string",
  "enum": ["option1", "option2", "option3"],
  "enumNames": ["Option 1", "Option 2", "Option 3"]
}
```

## UI Schema Format

The UI schema follows the JSON Forms UI Schema specification. It controls how form fields are presented and organized.

### Basic Structure

```json
{
  "type": "VerticalLayout",
  "elements": [
    {
      "type": "Control",
      "scope": "#/properties/fieldName"
    }
  ]
}
```

### Layout Types

| Layout | Description | Use Case |
|--------|-------------|----------|
| `VerticalLayout` | Fields arranged vertically | Default layout |
| `HorizontalLayout` | Fields arranged horizontally | Side-by-side fields |
| `Group` | Group related fields | Logical grouping |
| `Categorization` | Organize into categories | Complex forms with sections |

### Control Configuration

```json
{
  "type": "Control",
  "scope": "#/properties/fieldName",
  "label": "Custom Label",
  "options": {
    "placeholder": "Enter value",
    "format": "password"
  }
}
```

### Conditional Display

Show or hide fields based on other field values:

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

## Question Types

Question types are specified using the `format` property in the schema:

### Text Input

```json
{
  "type": "string",
  "title": "Name",
  "format": "text"
}
```

### Number Input

```json
{
  "type": "integer",
  "title": "Age",
  "minimum": 0,
  "maximum": 120
}
```

### Date and Time

```json
{
  "type": "string",
  "title": "Date",
  "format": "date"
}
```

### Selection

```json
{
  "type": "string",
  "title": "Choice",
  "enum": ["option1", "option2"],
  "enumNames": ["Option 1", "Option 2"]
}
```

### Sub-observations (embedded observations of another form type)

Collect **multiple related observations as JSON objects inside one parent observation** using `"format": "sub-observation"`. Each embedded item is edited in a nested Formplayer session (`openFormplayer` with `subObservationMode`). Only **`linkedForm`** is required; **`parentKey`** is optional. Optional **`itemLabel`** customizes add-button and empty-table copy (see [Custom Extensions](../guides/custom-extensions.md#sub-observations-format-sub-observation)).

Nested sessions validate the **child** schema on submit (`skipFinalize` only skips the Finalize page). Parent-level validators and denormalized fields run in the **parent** session. For multi-level trees, use validators on each form where rows are added, or parent snapshot init fields — see [Nested sessions and custom validators](../guides/custom-extensions.md#nested-sessions-and-custom-validators).

See the full schema options and examples in [Custom Extensions](../guides/custom-extensions.md#sub-observations-format-sub-observation).

```json
{
  "linked_children": {
    "type": "array",
    "format": "sub-observation",
    "title": "Related entries",
    "linkedForm": "child_form",
    "parentKey": "parent_id",
    "parentValuePath": "parent_id",
    "displayField": "name",
    "subObservationInitValues": {
      "parent_id": "{{parentValue}}"
    }
  }
}
```

### Multimedia Types

#### Photo

```json
{
  "type": "object",
  "format": "photo",
  "title": "Profile Photo"
}
```

#### Audio

```json
{
  "type": "string",
  "format": "audio",
  "title": "Voice Note"
}
```

#### Video

```json
{
  "type": "string",
  "format": "video",
  "title": "Instructional Video"
}
```

#### GPS

```json
{
  "type": "string",
  "format": "gps",
  "title": "Current Location"
}
```

#### Signature

```json
{
  "type": "object",
  "format": "signature",
  "title": "Customer Signature"
}
```

#### QR Code

```json
{
  "type": "string",
  "format": "qrcode",
  "title": "QR Code Scanner"
}
```

#### File Selection

Generic attachment via document picker. Use **`type: object`** with **`format: select_file`** (Formplayer stores basename + portable metadata; no inline preview).

```json
{
  "type": "object",
  "format": "select_file",
  "title": "Upload Document"
}
```

### Rating Scales (Likert)

Use **`format: "likert"`** for agreement, satisfaction, frequency, importance, likelihood, and numeric rating scales.

:::tip Display and content are independent

There are no topic-specific Likert types (no separate "pain slider" or "satisfaction buttons"). Pick a **`likert.display`** for *how* the scale looks, and set **`title`** plus **`oneOf`** for *what* it measures — any display works with any values and labels. Presets are optional shortcuts for common label sets on standard numeric ranges.

:::

#### Quick start

Add a field to **`schema.json`**, then wire it in **`ui.json`** with a standard `Control`:

**schema.json**

```json
{
  "type": "object",
  "properties": {
    "satisfaction": {
      "type": "integer",
      "format": "likert",
      "title": "How satisfied are you with the service?",
      "oneOf": [
        { "const": 1, "title": "Very dissatisfied" },
        { "const": 2, "title": "Dissatisfied" },
        { "const": 3, "title": "Neutral" },
        { "const": 4, "title": "Satisfied" },
        { "const": 5, "title": "Very satisfied" }
      ],
      "likert": {
        "display": "buttons",
        "colorMode": "spectrum",
        "allowClear": true
      }
    }
  },
  "required": ["satisfaction"]
}
```

**ui.json**

```json
{
  "type": "Control",
  "scope": "#/properties/satisfaction"
}
```

That is enough to render the question. Put display options (`likert.display`, `colorMode`, etc.) in **schema.json**. Use **ui.json** only when you need per-placement overrides such as layout (`orientation`) or a different display for the same field on another page.

For multi-locale forms, put the visible question text on `Control.label` in `ui.json` (with optional `translations`) rather than relying on `schema.title` alone — see [Form translations](/guides/form-translations).

#### What gets stored

The observation stores the selected option's **`oneOf[].const`** — not the label text.

| User selects | Stored value (`satisfaction`) |
| ------------ | ----------------------------- |
| "Satisfied"  | `4`                           |
| Clears answer (when `allowClear: true`) | field omitted or `null` depending on schema |
| "Not applicable" (when configured) | `null` (or `notApplicableValue`) |

Example observation payload:

```json
{
  "satisfaction": 4
}
```

In review/finalize mode, Formplayer shows the matching `oneOf[].title` (e.g. "Satisfied"), or the N/A label when the stored value is null.

#### Display modes (`likert.display`)

| Value     | Presentation                                              |
| --------- | --------------------------------------------------------- |
| `buttons` | Equal-width labelled option cells (**default**)           |
| `radio`   | Radio row with labels below (classic survey style)        |
| `slider`  | Slider with tick marks, endpoint anchors, and value badge |
| `numeric` | Compact number cells (NPS style)                          |
| `stars`   | Star rating with the selected label alongside             |
| `emoji`   | One emoji per option (`emoji` on each `oneOf` entry)      |

All variants share one clean look: neutral outlined option cells, with an accent border and tint on the selected option only. Every option is a touch-friendly target and the layout adapts to phone and tablet widths.

#### Colour (`likert.colorMode`)

| Value      | Selected-option accent                                |
| ---------- | ----------------------------------------------------- |
| `neutral`  | Theme primary (**default**)                           |
| `spectrum` | Semantic red → yellow → green by scale position       |
| `stars`    | Standard rating gold (used with `display: "stars"`)   |

Colour is only ever a secondary cue — selection is always conveyed by the border, tint, and weight as well, so scales remain readable for colour-blind respondents.

#### Presets

When you omit `oneOf`, set **`likert.preset`** to generate standard options automatically:

```json
{
  "type": "integer",
  "format": "likert",
  "title": "How often do you exercise?",
  "likert": {
    "preset": "frequency",
    "display": "buttons",
    "colorMode": "neutral"
  }
}
```

| Preset         | Stored values | Options (labels) |
| -------------- | ------------- | ---------------- |
| `agreement`    | 1–5           | Strongly disagree → Strongly agree |
| `frequency`    | 1–5           | Never → Always |
| `satisfaction` | 1–5           | Very dissatisfied → Very satisfied |
| `importance`   | 1–5           | Not important → Very important |
| `likelihood`   | 1–5           | Very unlikely → Very likely |
| `numeric_0_10` | 0–10          | `0`, `1`, … `10` |
| `numeric_1_5`  | 1–5           | `1`, `2`, … `5` |
| `numeric_1_7`  | 1–7           | `1`, `2`, … `7` |

Presets are a shortcut for common scales. For custom wording or non-standard value ranges, define your own `oneOf` instead.

#### Choosing a scale

| Display                                | Best for                        | Label pattern                                                    |
| -------------------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| `buttons` / `radio`                    | Opinion scales (3–5 options)    | Full label per option (`oneOf[].title`)                          |
| `numeric`                              | NPS, intensity, rating (5+ points) | Numbers in cells; word labels on the first/last `oneOf` entries  |
| `buttons` + `endpointLabelsOnly: true` | NPS 0–10 in button form         | Digits in cells; endpoint words below                            |
| `slider`                               | Continuous 0–10 ranges          | Endpoint word anchors below; value badge always visible          |
| `emoji`                                | Optional sentiment (low-stakes) | Emoji **and** text label on every option                         |
| `stars`                                | 5-point satisfaction            | Star count with the selected label beside it                     |

Research on survey scales favours **numeric scales with verbal endpoint anchors** (highest reliability) and **fully-labelled word buttons** (fastest to answer). Emoji are engaging but can cluster toward the middle and vary by culture, so they always render with a text label and are best reserved for informal contexts.

#### Copy-paste recipes

**0–10 slider with endpoint anchors** — stores `0` … `10`. Change `title` and the first/last `oneOf[].title` values to rate anything; the slider UI is the same.

*Example — pain intensity:*

```json
{
  "type": "integer",
  "format": "likert",
  "title": "Rate your pain level",
  "oneOf": [
    { "const": 0, "title": "No pain" },
    { "const": 1, "title": "1" },
    { "const": 2, "title": "2" },
    { "const": 3, "title": "3" },
    { "const": 4, "title": "4" },
    { "const": 5, "title": "5" },
    { "const": 6, "title": "6" },
    { "const": 7, "title": "7" },
    { "const": 8, "title": "8" },
    { "const": 9, "title": "9" },
    { "const": 10, "title": "Worst pain" }
  ],
  "likert": {
    "display": "slider",
    "colorMode": "spectrum"
  }
}
```

*Example — task difficulty (same display, different labels):*

```json
{
  "type": "integer",
  "format": "likert",
  "title": "How difficult was this task?",
  "oneOf": [
    { "const": 0, "title": "Very easy" },
    { "const": 1, "title": "1" },
    { "const": 2, "title": "2" },
    { "const": 3, "title": "3" },
    { "const": 4, "title": "4" },
    { "const": 5, "title": "5" },
    { "const": 6, "title": "6" },
    { "const": 7, "title": "7" },
    { "const": 8, "title": "8" },
    { "const": 9, "title": "9" },
    { "const": 10, "title": "Extremely hard" }
  ],
  "likert": {
    "display": "slider",
    "colorMode": "spectrum"
  }
}
```

**NPS-style 0–10 (endpoint labels only in button form)** — stores `0` … `10`:

```json
{
  "type": "integer",
  "format": "likert",
  "title": "How likely are you to recommend us?",
  "oneOf": [
    { "const": 0, "title": "Not at all likely" },
    { "const": 1, "title": "1" },
    { "const": 2, "title": "2" },
    { "const": 3, "title": "3" },
    { "const": 4, "title": "4" },
    { "const": 5, "title": "5" },
    { "const": 6, "title": "6" },
    { "const": 7, "title": "7" },
    { "const": 8, "title": "8" },
    { "const": 9, "title": "9" },
    { "const": 10, "title": "Extremely likely" }
  ],
  "likert": {
    "display": "buttons",
    "colorMode": "spectrum",
    "endpointLabelsOnly": true,
    "allowClear": true
  }
}
```

**Emoji sentiment** — stores `1` … `5`; `emoji` is display-only metadata:

```json
{
  "type": "integer",
  "format": "likert",
  "title": "How do you feel about your visit today?",
  "oneOf": [
    { "const": 1, "title": "Very bad", "emoji": "😞" },
    { "const": 2, "title": "Bad", "emoji": "😕" },
    { "const": 3, "title": "Okay", "emoji": "😐" },
    { "const": 4, "title": "Good", "emoji": "🙂" },
    { "const": 5, "title": "Great", "emoji": "😄" }
  ],
  "likert": {
    "display": "emoji",
    "colorMode": "spectrum",
    "allowClear": true
  }
}
```

**With "Not applicable"** — stores `null` when N/A is chosen; use `type: ["integer", "null"]`:

```json
{
  "type": ["integer", "null"],
  "format": "likert",
  "title": "How important is this feature to you?",
  "oneOf": [
    { "const": 1, "title": "Not important" },
    { "const": 2, "title": "Slightly important" },
    { "const": 3, "title": "Moderately important" },
    { "const": 4, "title": "Important" },
    { "const": 5, "title": "Very important" }
  ],
  "likert": {
    "display": "buttons",
    "allowClear": true,
    "allowNotApplicable": true,
    "notApplicableLabel": "Not applicable",
    "notApplicableValue": null
  }
}
```

:::note

You only need `type: ["integer", "null"]` (so the field can hold the N/A value). Formplayer automatically allows the `notApplicableValue` during validation — you do **not** need to add a `null` branch to `oneOf` yourself, and the N/A choice is never shown twice.

:::

**Required field** — add the property name to the schema `required` array:

```json
{
  "type": "object",
  "properties": {
    "satisfaction": { "type": "integer", "format": "likert", "likert": { "preset": "satisfaction" } }
  },
  "required": ["satisfaction"]
}
```

You can also mark a control required in `ui.json` with `"options": { "required": true }` on that `Control`.

#### Additional options

| Option                       | Description                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `likert.allowClear`          | Tapping the selected option again clears it (default `true`).                                    |
| `likert.endpointLabelsOnly`  | Show word labels only at the endpoints of long numeric scales; omit for 3–4 option scales.       |
| `likert.allowNotApplicable`  | Adds a "Not applicable" choice. Use `type: ["integer", "null"]`; stores the `notApplicableValue`. |
| `likert.notApplicableLabel`  | Custom label for the N/A option (default "Not applicable").                                       |
| `likert.notApplicableValue`  | Stored value for N/A (default `null`).                                                            |

#### Layout (UI schema)

Control the arrangement from the UI schema `options`:

```json
{
  "type": "Control",
  "scope": "#/properties/satisfaction",
  "options": { "orientation": "cols-2" }
}
```

`options.orientation` accepts `horizontal` (default), `vertical` (stacked), `flow` (wrap), or `cols-2` … `cols-5` (a fixed multi-column grid, useful on tablets). Word and radio scales automatically stack to one option per row on narrow phones. `options.display` overrides `likert.display` for that control only.

On tablets and desktop, word-label scales render as **equal-width cells** in an even grid, so long labels (e.g. "Strongly agree", "Always") never stretch to a full-width row.

In review/read-only mode the selected answer stays prominent while the other options are de-emphasised.

#### Translating option labels

Question text is translated via `Control.label` + `translations` (see [Form translations](/guides/form-translations)). To translate the **scale option labels**, mirror the values in the UI schema `options.oneOf` and provide per-locale overrides — they are matched to the schema options by `const`:

```json
{
  "type": "Control",
  "scope": "#/properties/satisfaction",
  "label": "How satisfied are you?",
  "options": {
    "oneOf": [
      { "const": 1, "title": "Very dissatisfied" },
      { "const": 5, "title": "Very satisfied" }
    ]
  },
  "translations": {
    "pt": {
      "label": "Quão satisfeito está?",
      "options": {
        "oneOf": [
          { "const": 1, "title": "Muito insatisfeito" },
          { "const": 5, "title": "Muito satisfeito" }
        ]
      }
    }
  }
}
```

The stored value is unchanged (`oneOf[].const`). Any option not listed in a locale keeps its `schema.json` `oneOf[].title`. The finalize summary uses the `schema.json` titles.

### Duration / Timer

Use **`format: "duration"`** to capture elapsed time. The stored value is always a JSON **number of seconds** (e.g. `90.5` for one minute thirty-and-a-half seconds).

#### Quick start

**schema.json**

```json
{
  "type": "object",
  "properties": {
    "task_duration": {
      "type": "number",
      "format": "duration",
      "title": "Time to complete the task",
      "minimum": 0,
      "duration": {
        "mode": "stopwatch",
        "unit": "seconds",
        "precision": 1,
        "allowManualEntry": true
      }
    }
  }
}
```

**ui.json**

```json
{
  "type": "Control",
  "scope": "#/properties/task_duration"
}
```

#### What gets stored

| Mode        | When value is written              | Example stored value |
| ----------- | ---------------------------------- | -------------------- |
| `stopwatch` | Collector taps **Save** after timing | `125.3` (seconds)  |
| `countdown` | When countdown completes or is saved | `42.0`           |
| `manual`    | On blur / field commit             | `300`              |

Example observation payload:

```json
{
  "task_duration": 125.3
}
```

The finalize summary shows a human-readable form (e.g. `2 min 5.3 sec`). Use `minimum: 0` to reject negative durations.

#### Modes

| `duration.mode` | Presentation                                          |
| --------------- | ----------------------------------------------------- |
| `stopwatch`     | Start / Pause / Resume / Reset, then **Save** to commit |
| `countdown`     | Counts down from `duration.countdownFrom` seconds      |
| `manual`        | A plain numeric seconds field only                    |

**Stopwatch** does not write a value while the timer is running. The collector must pause and tap **Save** — this prevents partial or accidental commits.

#### Copy-paste recipes

**Stopwatch with optional manual entry** (default pattern):

```json
{
  "type": "number",
  "format": "duration",
  "title": "Time to complete the task",
  "minimum": 0,
  "duration": {
    "mode": "stopwatch",
    "unit": "seconds",
    "precision": 1,
    "allowManualEntry": true
  }
}
```

**Countdown from 60 seconds** (e.g. breath-hold test):

```json
{
  "type": "number",
  "format": "duration",
  "title": "Hold breath duration",
  "minimum": 0,
  "duration": {
    "mode": "countdown",
    "unit": "seconds",
    "precision": 1,
    "countdownFrom": 60,
    "allowManualEntry": false
  }
}
```

**Manual entry only** (no timer UI):

```json
{
  "type": "number",
  "format": "duration",
  "title": "Enter elapsed time (seconds)",
  "minimum": 0,
  "duration": {
    "mode": "manual",
    "unit": "seconds",
    "precision": 1
  }
}
```

#### Duration options

| Option               | Description |
| -------------------- | ----------- |
| `duration.mode`      | `stopwatch`, `countdown`, or `manual` (default `stopwatch`) |
| `duration.unit`      | Display unit; currently only `"seconds"` |
| `duration.precision` | Decimal places shown (default `1`) |
| `duration.allowManualEntry` | When `true`, shows a seconds input alongside stopwatch/countdown |
| `duration.countdownFrom` | Starting seconds for `countdown` mode (required for countdown) |

## Form Versioning

Forms support versioning to allow updates while maintaining compatibility:

- Each form has a `schemaType` and `schemaVersion`
- When editing an observation, the form version used to create it is used
- New observations use the latest form version

## Complete Example

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "title": "Full Name",
        "minLength": 1,
        "maxLength": 100
      },
      "age": {
        "type": "integer",
        "title": "Age",
        "minimum": 0,
        "maximum": 120
      },
      "email": {
        "type": "string",
        "title": "Email Address",
        "format": "email"
      },
      "photo": {
        "type": "object",
        "format": "photo",
        "title": "Profile Photo"
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
      },
      {
        "type": "Control",
        "scope": "#/properties/email"
      },
      {
        "type": "Control",
        "scope": "#/properties/photo"
      }
    ]
  }
}
```

## Related Documentation

- [Form Design Guide](/guides/form-design)
- [JSON Forms Documentation](https://jsonforms.io)
- [JSON Schema Documentation](https://json-schema.org)
