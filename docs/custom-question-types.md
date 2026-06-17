# Custom Question Types in Formplayer

Formplayer supports a plugin system that allows you to render custom UI components for specific questions in your forms. This is useful for complex interactions that standard JSON Forms inputs cannot handle (e.g., drag-and-drop ranking, signature pads, or complex search interfaces).

## How it Works

1. **Folder Structure**: You place your custom component inside the `/forms/question_types/<format_name>/` directory of your `custom_app`.
2. **Implementation**: You create a JavaScript file (`renderer.js` or `index.js`) that exports a React component.
3. **Usage in Schema**: You set the `"format"` property in your `schema.json` to match the `<format_name>` folder.
4. **Loading Payload**: When Formulus opens a form, it reads all custom question types in the `question_types` folder and injects their source code into the Formplayer WebView.
5. **Execution**: Formplayer dynamically evaluates and registers your component. It wraps it in an error boundary and adapts it to the JSONForms architecture.

### Formulus API: WebView file URLs (v1.2.0+)

Inside the WebView, `<img src>` cannot load legacy relative paths like `/default/data/tables/...`. Use the injected `getFormulus()` API (see `FormulusInterfaceDefinition.ts` in Formulus / Formplayer):

- **`getAttachmentUri(fileName)`** — returns a `file://` URL if that basename exists under the app attachments directory (or `pending_upload`), else `null`. Use the observation media `filename` / `photo.filename` basename.
- **`getAttachmentsUri()`** — base `file://` URL for the attachments folder (trailing slash).
- **`getCustomAppUri()`** — base `file://` URL for `DocumentDirectory/app/`.
- **`getFormSpecsUri()`** — base `file://` URL for `DocumentDirectory/forms/`.

---

## Creating a Custom Question Type

### 1. File Location

Create a folder named after your custom format (e.g., `ranking`). Inside it, create `renderer.js`.

```
custom_app/
  forms/
    question_types/
      ranking/
        renderer.js     <-- Your component
```

### 2. The Component Interface

Your `renderer.js` must **default export** a React component (CommonJS style `module.exports = { default: Component }`). It receives the following props:

```ts
interface CustomQuestionTypeProps {
  // 1. Current field data
  value: any;

  // 2. The callback to update the form's data state. Must be called when user changes value.
  onChange: (newValue: any) => void;

  // 3. Schema parameters. Any non-standard JSON Schema keys are passed here.
  config: Record<string, any>;

  // 4. Validation state for styling error cases
  validation: {
    error: boolean;
    message: string;
  };

  // 5. Context from JSON Forms to access the whole form data/schema
  jsonFormsContext: {
    core: {
      data: any; // The entire form's current data
      schema: any; // The root schema
      errors: any[]; // All validation errors
    };
    // ...other JSONForms state
  };

  // 6. UI properties
  enabled: boolean;
  label: string;
  description?: string;
  fieldPath: string; // The dot-notation path in the data (e.g. "team.ranking")
}
```

### 3. Example Implementation: `renderer.js`

Because the Formplayer evaluates this at runtime within a browser without a bundler, you cannot rely on ES modules (`import/export`). Instead, use CommonJS (`module.exports`) and rely on injected globals like `React` and `MaterialUI`.

```javascript
const { useState, useEffect } = React;
const { Button, Typography, Box } = MaterialUI;

function MyCustomRenderer(props) {
  const { value, onChange, config, validation, label } = props;

  // "config" contains any extra properties from your schema.json
  const maxItems = config.maxItems || 5;

  return (
    <Box
      sx={{
        p: 2,
        border: validation.error ? "1px solid red" : "1px solid #ccc",
      }}
    >
      <Typography variant="h6">{label}</Typography>
      <Typography>Current Value: {JSON.stringify(value)}</Typography>

      <Button variant="contained" onClick={() => onChange("New Value!")}>
        Set Value
      </Button>

      {validation.error && (
        <Typography color="error">{validation.message}</Typography>
      )}
    </Box>
  );
}

// Emulate an ES Module default export for the loader
module.exports = {
  default: MyCustomRenderer,
};
```

---

## Using it in your Form

Once your custom question type is defined, use it in your form's `schema.json`.

By default, standard JSON Schema properties (`type`, `title`, `description`, `required`, etc.) are consumed by the core engine. **Any other custom properties** inside the field definition will be passed to your component inside the `config` prop!

```json
{
  "type": "string",
  "title": "Select a Person",
  "format": "select-person",      <-- Matches the folder name

  "endpoint": "/api/v1/people",   <-- Passed to props.config.endpoint
  "showSearch": true,             <-- Passed to props.config.showSearch
  "theme": "dark"                 <-- Passed to props.config.theme
}
```

### Data Storage

Your component can return complex objects, arrays, or primitive values back to `onChange()`. Just ensure the `"type"` property in your schema matches what you are returning (e.g. `"type": "object"` if returning an object) so that AJV validation passes.

---

## Custom validators (related)

Custom **question types** render UI; custom **validators** (`validators/<name>/index.js` in the app bundle) run on `ui.json` `options.customValidators` and return errors. Validators may also **mutate** the full form `data` object in place (for example assigning sequence numbers on embedded sub-observation arrays). Formplayer detects those mutations and refreshes state so tables and dependent fields update without extra custom question types.

**Per-session scope:** Validators run only in the **active** Formplayer session. Nested sub-observation child forms need their own validators (or parent snapshot init fields) for numbering and cross-row rules — root-only validators are not enough for deep embedded trees.

See [Custom Extensions](https://opendataensemble.org/docs/guides/custom-extensions) on opendataensemble.org for validator packaging, [nested sessions](https://opendataensemble.org/docs/guides/custom-extensions#nested-sessions-and-custom-validators), [parent context](https://opendataensemble.org/docs/guides/custom-extensions#parent-context-across-nesting-levels), and sub-observation configuration (`linkedForm` required; `parentKey` optional).

---

## Error Handling

If your custom component throws an exception or crashes while rendering, Formplayer will catch it and display a red fallback UI in place of your question. This ensures that a bug in one custom question does not break the entire form or block the user from answering other questions.
