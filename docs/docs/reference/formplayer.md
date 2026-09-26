---
sidebar_position: 6
---

# Formplayer Component Reference

Complete technical reference for the Formplayer form rendering component.

:::info[Authoritative Reference Available]

For the complete, authoritative contract defining all supported JSON Schema features, UI schema structure, validation rules, and behavioral guarantees, see the **[Formplayer Contract](/reference/formplayer-contract)**.

:::

## Overview

Formplayer is a React web application that renders JSON Forms and provides the dynamic form interface for data collection. It runs within WebViews in the Formulus mobile app and communicates with the native app through a JavaScript bridge.

## Supported Schema & UI Profile

**Critical**: ODE Formplayer intentionally supports a safe, predictable subset of JSON Schema and JSON Forms. Forms outside this profile may load but are **not guaranteed to work**.

### Supported JSON Schema Features

| Feature | Supported | Notes |
|---------|-----------|-------|
| `type` | ✅ | `string`, `number`, `integer`, `boolean`, `object`, `array` |
| `properties` | ✅ | Object property definitions |
| `required` | ✅ | Array of required property names |
| `minimum` / `maximum` | ✅ | Literal numbers only (e.g., `"minimum": 0`) |
| `minLength` / `maxLength` | ✅ | String length constraints |
| `pattern` | ✅ | Regular expression patterns |
| `format` | ✅ | `email`, `date`, `date-time`, `uri`, `uuid` |
| `enum` | ✅ | Array of allowed values |
| `enumNames` | ✅ | Display names for enum values |
| `oneOf` | ✅ | Recommended for single-choice selections |
| `title` | ✅ | Field display title |
| `description` | ✅ | Field description/help text |
| `default` | ✅ | Default values |
| `const` | ✅ | Constant values (used in rules) |
| `$data` | ❌ | **Will crash** - not supported |
| `if` / `then` / `else` | ❌ | **Not supported** in rule conditions |
| `$ref` | ⚠️ | Limited support - use with caution |
| `allOf` / `anyOf` | ⚠️ | Limited support - use with caution |

### Supported UI Schema Elements

| Element | Required Fields | Notes |
|---------|----------------|-------|
| **SwipeLayout** | `type`, `elements[]` | Root layout (required or auto-wrapped) |
| **VerticalLayout** | `type`, `elements[]` | Vertical field arrangement |
| **HorizontalLayout** | `type`, `elements[]` | Horizontal field arrangement |
| **Group** | `type`, `label`, `elements[]` | Grouped fields with label |
| **Control** | `type`, `scope` | Field control (scope must exist in schema) |
| **Label** | `type`, `text` | Text label element |

### Unsupported / Unsafe Features

**❌ JSON Schema:**
- `$data` references (dynamic values)
- `if`/`then`/`else` conditional schemas
- Complex `$ref` resolution
- `allOf`/`anyOf` (limited support)

**❌ UI Schema:**
- Missing `elements` array in layouts
- Invalid `scope` paths (referencing non-existent schema properties)
- Rules referencing missing fields
- Nested SwipeLayout
- `Categorization` layout (not recommended)

**⚠️ Common Pitfalls:**
- Using `$data` in `minimum`/`maximum` (use literal numbers)
- Rule conditions with scopes that don't exist in schema
- Controls with scopes pointing to non-existent properties
- Missing `elements` array in SwipeLayout or other layouts

### Safe Form Patterns

**✅ Recommended Structure:**
```json
{
  "schema": {
    "type": "object",
    "properties": {
      "field1": { "type": "string", "title": "Field 1" },
      "field2": { "type": "integer", "minimum": 0, "maximum": 100 }
    },
    "required": ["field1"]
  },
  "uischema": {
    "type": "SwipeLayout",
    "elements": [
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
    ]
  }
}
```

**❌ Unsafe Patterns:**
```json
{
  "schema": {
    "properties": {
      "field1": { "type": "string" }
    }
  },
  "uischema": {
    "type": "Control",
    "scope": "#/properties/missingField"  // ❌ Field doesn't exist
  }
}
```

```json
{
  "schema": {
    "properties": {
      "value": {
        "type": "number",
        "minimum": { "$data": "#/minValue" }  // ❌ $data not supported
      }
    }
  }
}
```

## Architecture

### Technology Stack

- **Framework**: React
- **Language**: TypeScript
- **Form Library**: JSON Forms
- **UI Framework**: Material-UI (via JSON Forms)
- **Build Tool**: Webpack/Vite

### Component Structure

```
formulus-formplayer/
├── src/
│   ├── App.tsx                    # Main application component
│   ├── FormLayout.tsx             # Form layout renderer
│   ├── QuestionShell.tsx         # Question wrapper component
│   ├── *QuestionRenderer.tsx     # Question type renderers
│   ├── FormulusInterface.ts       # Bridge interface definition
│   └── theme.ts                   # Theming configuration
├── public/
│   └── formulus-load.js          # API loading script
└── build/                         # Production build output
```

## Core Responsibilities

Formplayer is responsible for:

1. **Form Rendering**: Render forms based on JSON schema and UI schema
2. **Data Collection**: Capture user input through various question types
3. **Validation**: Validate form responses against schema rules
4. **Observation Management**: Create, edit, and delete observations
5. **Draft Management**: Save and load draft observations

## Integration with Formulus

### Initialization

Formplayer is initialized by the Formulus app with:

- **Renderers**: Container components for form layout
- **Cells**: Question type components (text, date, photo, etc.)
- **Form Specs**: JSON form specifications from server
- **Formulus API**: JavaScript interface to native app

### Communication Model

```
┌─────────────────┐         ┌──────────────────┐
│   Formulus      │         │   Formplayer     │
│   (Native)       │◄───────►│   (WebView)      │
│                 │         │                  │
│  • Database     │         │  • Form Render   │
│  • Sync Engine  │         │  • Validation    │
│  • API Bridge   │         │  • User Input    │
└─────────────────┘         └──────────────────┘
```

## JavaScript Interface

Formplayer exposes methods to custom applications and receives configuration from Formulus.

### Available Methods

#### addObservation(formType, initializationData)

Open a form to create a new observation.

```javascript
window.formulus.formplayer.addObservation('survey', {
  participantId: '123',
  location: 'Field Site A'
});
```

**Parameters:**
- `formType` (string): Form type identifier
- `initializationData` (object): Optional pre-population data

#### editObservation(formType, observationId)

Open a form to edit an existing observation.

```javascript
window.formulus.formplayer.editObservation('survey', 'obs-123');
```

**Parameters:**
- `formType` (string): Form type identifier
- `observationId` (string): Observation ID to edit

#### deleteObservation(formType, observationId)

Delete an observation.

```javascript
window.formulus.formplayer.deleteObservation('survey', 'obs-123');
```

**Parameters:**
- `formType` (string): Form type identifier
- `observationId` (string): Observation ID to delete

## Question Types

Formplayer supports various question types through custom renderers:

### Text Input

- **Single-line text**: Standard text input
- **Multi-line text**: Textarea for longer responses
- **Email**: Email format validation
- **Phone**: Phone number format validation
- **URL**: URL format validation

### Number Input

- **Integer**: Whole numbers only
- **Decimal**: Floating-point numbers
- **Range**: Min/max value constraints

### Date and Time

- **Date**: Date picker
- **Time**: Time picker
- **DateTime**: Combined date and time picker

### Selection

- **Single Select**: Native `<select>` dropdown by default for `oneOf` / `$ref` lists; optional Autocomplete (`options.autocomplete`), radio, or button groups
- **Multi Select**: Vertical checkboxes by default; optional checkbox or button groups with `options.display`

### Form UX (2026)

- **Inline layout**: SwipeLayout forms default to compact two-column rows (`labelLayout: "inline"`)
- **Sticky fields**: Opt-in per-control value memory (`options.sticky`)
- **Deferred validation**: New forms hide errors until first forward navigation
- **Sub-observation fast path**: `skipFinalize` omits the Finalize page; child still validates on Done before returning data to the parent
- **Nested validators**: Custom validators are per Formplayer session — deep embedded trees need validators on each nesting level (see [Custom Extensions](../guides/custom-extensions.md#nested-sessions-and-custom-validators))
- **Optional `parentKey`**: Sub-observation arrays require only `linkedForm`; parent id injection is optional
- **Mutating custom validators**: In-place `data` updates from bundle validators refresh the UI automatically
- **Draft bypass**: `openFormplayer(..., { skipDraftSelection: true })` for orchestrated root sessions
- **Dynamic defaults**: Schema `default: "$today"` / `"$now"` for new observations

See [Form design guide](../guides/form-design) for `ui.json` examples.

### Boolean

- **Checkbox**: True/false or yes/no

### Media Capture

- **Photo**: Camera capture or gallery selection
- **Audio**: Voice recording
- **Video**: Video recording
- **File**: File attachment

### Special Input

- **GPS**: Location coordinates capture
- **Signature**: Digital signature pad
- **QR Code**: Barcode/QR code scanner
- **Sub-observations**: Embedded repeats — nested child forms whose payloads are stored as JSON inside a parent array property (see [Custom Extensions](../guides/custom-extensions.md#sub-observations-format-sub-observation))

## Form Rendering

### Schema Processing

Formplayer processes JSON schemas to:

1. **Parse Schema**: Extract form structure and validation rules
2. **Process UI Schema**: Apply layout and presentation rules
3. **Generate Form**: Create form components based on schema
4. **Apply Validation**: Set up validation rules

### Layout System

Forms can use different layout strategies:

- **Vertical Layout**: Fields stacked vertically
- **Horizontal Layout**: Fields arranged horizontally
- **Group Layout**: Fields grouped in sections
- **Categorization**: Fields organized in tabs or categories

## Validation

### Schema Validation

Formplayer validates form responses against:

- **Required Fields**: Ensure required fields are filled
- **Type Validation**: Verify data types match schema
- **Format Validation**: Check format constraints (email, URL, etc.)
- **Range Validation**: Verify numeric ranges
- **Pattern Validation**: Match against regex patterns

### Custom Validation

Custom validation rules can be added:

- **Bundle validators**: `ui.json` → `options.customValidators` referencing `validators/<name>/` modules in the app bundle (see [Custom Extensions](../guides/custom-extensions.md#custom-validators-validators))
- **In-place updates**: Validators may mutate form `data` (for example auto-numbering repeat rows); Formplayer refreshes state when mutations are detected
- **Conditional Validation**: Rules based on other field values
- **Cross-field Validation**: Validation across multiple fields

## Draft Management

### Saving Drafts

Formplayer can save incomplete forms as drafts:

1. **Auto-save**: Periodically save form state
2. **Manual Save**: User-triggered draft save
3. **Local Storage**: Drafts stored in WebView storage

### Loading Drafts

When opening a **new** root observation, Formplayer may show a **draft selector** if local drafts exist. Custom apps can bypass this with `openFormplayer(formType, params, savedData, { skipDraftSelection: true })` when they orchestrate the session (for example after preparing `defaultData` programmatically). Sub-observation sessions and edits with `savedData` never show the picker.

When editing an observation:

1. **Load Data**: Fetch observation data from Formulus
2. **Populate Form**: Pre-fill form fields with data
3. **Restore State**: Restore form state and validation

## Theming

### Theme Configuration

Formplayer uses a theme system for styling:

- **Colors**: Primary, secondary, and accent colors
- **Typography**: Font families and sizes
- **Spacing**: Margins and padding
- **Components**: Component-specific styling

### Custom Theming

Themes can be customized:

- **Brand Colors**: Match organization branding
- **Custom Styles**: Override default component styles
- **Responsive Design**: Adapt to different screen sizes

## Building and Deployment

### Development Build

```bash
# Install dependencies (build @ode/tokens first)
cd ../packages/tokens && pnpm install && pnpm run build && cd ../formulus-formplayer
pnpm install

# Start development server
pnpm start

# Opens at http://localhost:3000 (or Vite's printed port)
```

### Production Build

```bash
# Build and copy into Formulus (and ODE Desktop)
pnpm run build:copy

# Build for web only
pnpm run build
```

### Build Output

The build process:

1. **Compiles TypeScript**: Transpiles to JavaScript
2. **Bundles Assets**: Combines CSS and images
3. **Minifies Code**: Optimizes for production
4. **Copies to Formulus**: Copies build to Formulus app

## Integration with Custom Applications

### Loading Formplayer

Custom applications can use Formplayer:

```html
<script src="formulus-load.js"></script>
<script>
  async function openForm() {
    const api = await getFormulus();
    await api.addObservation('survey', {});
  }
</script>
```

### Formplayer API

The Formplayer API is injected into custom app WebViews:

```javascript
// Access Formplayer methods
window.formulus.formplayer.addObservation('survey', {});
```

## Question Type Renderers

### Core Renderers

Formplayer includes core question type renderers:

- `TextQuestionRenderer`: Text input fields
- `NumberQuestionRenderer`: Numeric input fields
- `DateQuestionRenderer`: Date picker
- `SelectQuestionRenderer`: Dropdown selections
- `PhotoQuestionRenderer`: Camera capture
- `GPSQuestionRenderer`: Location capture
- `SignatureQuestionRenderer`: Digital signature
- `AudioQuestionRenderer`: Voice recording
- `VideoQuestionRenderer`: Video recording
- `FileQuestionRenderer`: Generic file attachment (`format: select_file`, `type: object`) — document picker, basename persistence like photos; **filename-only** UI (no preview)
- `SubObservationQuestionRenderer`: Embedded sub-observation repeats (`format: sub-observation`) — nested `openFormplayer` with `subObservationMode`

### Custom Renderers

Custom renderers can be added:

1. **Create Renderer Component**: Implement question type component
2. **Register Renderer**: Add to Formplayer configuration
3. **Use in Forms**: Reference in form schema

## Error Handling

### Validation Errors

Formplayer displays validation errors:

- **Field-level Errors**: Shown below invalid fields
- **Form-level Errors**: Shown at form level
- **Error Messages**: User-friendly error messages

### Runtime Errors

Error handling for:

- **API Errors**: Network and server errors
- **Data Errors**: Invalid data format
- **Render Errors**: Component rendering failures

## Performance

### Optimization Strategies

- **Lazy Loading**: Load form components on demand
- **Code Splitting**: Split bundle for faster loading
- **Memoization**: Cache form components
- **Virtual Scrolling**: For long forms

### Best Practices

- **Minimize Form Size**: Keep forms focused
- **Optimize Images**: Compress images in forms
- **Efficient Validation**: Validate only when needed
- **Cache Form Specs**: Cache parsed form specifications

## Development

### Local Development

1. **Start Dev Server**: `pnpm start`
2. **Open Browser**: Navigate to `http://localhost:3000`
3. **Hot Reload**: Changes reflect automatically

### Testing

- **Unit Tests**: Test individual components
- **Integration Tests**: Test form rendering
- **E2E Tests**: Test complete form workflows

## Related Documentation

- [Form Design Guide](/guides/form-design) - Creating form schemas
- [Custom Applications Guide](/guides/custom-applications) - Building custom apps
- [Formulus Reference](/reference/formulus) - Mobile app component
- [Form Specifications](/reference/form-specifications) - Schema format

