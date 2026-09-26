# Custom Question Types

Custom question types let you render your own UI for a single question — drag-and-drop ranking, a signature pad, a person picker with server-side search. They ship inside an [app bundle](/docs/guides/custom-applications), are loaded at runtime, and need no changes to Formulus or Formplayer.

Custom question types are matched by the **`format`** property in your schema, not `type`. Built-in formats such as `photo`, `gps`, `signature`, `likert`, `duration`, and `sub-observation` already ship inside Formplayer — pick a new format name rather than shadowing one of those.

## How it works

1. **Package** — add a folder named after your format under `question_types/` in the app bundle, containing `renderer.js`.
2. **Declare** — set `"format": "<folder name>"` on the field in `schema.json`.
3. **Scan** — when Formulus opens the form, it reads each renderer file and passes the **source text** to the Formplayer WebView in a manifest.
4. **Evaluate** — Formplayer evaluates the source in a sandbox where `React` and `MaterialUI` are provided as globals, then registers the component as a JSON Forms renderer for that format.
5. **Wrap** — every custom question type is wrapped in a shared question shell (label, description, required marker, validation message) and an error boundary, so your component only renders the input itself.

## Where renderers live

Formulus scans these directories, in order, and the **first** one to define a given folder name wins:

| Order | Path | Notes |
|-------|------|-------|
| 1 | `app/question_types/` | **Current location.** Use this. |
| 2 | `app/forms/question_types/` | Legacy — still scanned, but shadowed by the path above |
| 3 | `<profile>/forms/question_types/` | Profile-local forms directory |

Inside each format folder, Formulus looks for **`renderer.js`** first and falls back to **`index.js`**. A folder with neither is skipped with a warning and that format will not render.

```
app-bundle.zip
└── app/
    ├── manifest.json
    ├── forms/
    │   └── household.json
    └── question_types/
        ├── rating-stars/
        │   └── renderer.js      <-- matched by "format": "rating-stars"
        └── select-person/
            └── renderer.js      <-- matched by "format": "select-person"
```

## Module format

There is no bundler and no ES module support — the file is evaluated as a plain script with CommonJS shims. `React` and `MaterialUI` are injected as function parameters, so you can destructure them at the top of the file.

The module must resolve to a **function**. Both of these work:

```javascript
const { useState } = React;
const { Box, Typography } = MaterialUI;

function RatingStars(props) {
  return Box(null, String(props.value ?? ''));
}

module.exports = { default: RatingStars };
```

```javascript
module.exports = function RatingStars(props) {
  return React.createElement('div', null, String(props.value ?? ''));
};
```

If the module does not resolve to a function, that one format fails to load and is reported in the console; every other format in the bundle still loads.

## Props reference

| Prop | Type | Description |
|------|------|-------------|
| `value` | `unknown` | Current field value. The type follows the field's JSON Schema `type`. |
| `onChange` | `(newValue: unknown) => void` | Updates the field value. Pass a real JSON value, never a display string. |
| `config` | `Record<string, unknown>` | Your custom schema properties (see below). |
| `options` | `Record<string, unknown>` | Display settings from the `ui.json` `Control.options`, after locale preprocessing. |
| `validation.error` | `boolean` | Whether the field currently has a validation error. Use for styling only. |
| `validation.message` | `string` | **Always empty.** The shell renders the error copy — do not render this. |
| `enabled` | `boolean` | Whether the field is editable. |
| `visible` | `boolean` | JSON Forms relevance (SHOW/HIDE) result. The adapter already hides the component when this is `false`; it is exposed so renderers can react. |
| `fieldPath` | `string` | The field's JSON Pointer path, e.g. `#/properties/rating`. |
| `label` | `string` | The raw schema `title`. The shell renders the localized label — do not render it again. |
| `description` | `string` | The schema `description`, if present. Also rendered by the shell. |
| `jsonFormsContext` | `any` | JSON Forms context, including `core.data` (all form values), `core.schema` (root schema), and `core.errors`. |

### What the shell already does

Your component is rendered inside a shared shell, so **do not** re-implement any of this or it will appear twice:

- the localized **label** and **description**
- the **required** marker
- the **validation error message**
- hiding the question when `visible` is `false`

Use `validation.error` for a red border or similar affordance, and leave the text to the shell.

### `config`: your schema properties

Every schema property that is **not** reserved JSON Schema is passed through in `config`. Reserved keys are:

`type`, `title`, `description`, `format`, `enum`, `const`, `default`, `required`, `properties`, `items`, `oneOf`, `anyOf`, `allOf`, `$ref`, `$schema`, `additionalProperties`, `pattern`, `minLength`, `maxLength`, `minimum`, `maximum`, `minItems`, `maxItems`

Anything else — including keys starting with `_` or `x-` — arrives in `config`.

### Numeric fields

For numeric fields, **do not clamp to `minimum`/`maximum` on every keystroke.** Keep the in-progress text as local draft state while the field is focused, and commit the typed number (temporarily out of range values included) through `onChange`. AJV then reports the range violation through the normal error channel. Clamping as you type makes it impossible to clear or retype a value.

## Example: `rating-stars`

```javascript
const { useState, useEffect } = React;
const { Box, Typography, IconButton } = MaterialUI;

function RatingStars(props) {
  const { value, onChange, config, options, enabled } = props;
  const maxStars = config.maxStars || 5;
  const hint = options && options.hint ? options.hint : '';

  const [draft, setDraft] = useState(null);
  useEffect(function () {
    setDraft(null);
  }, [value]);

  const current = draft !== null ? draft : value;
  const stars = [];
  for (let n = 1; n <= maxStars; n++) {
    stars.push(
      IconButton(
        {
          key: n,
          disabled: !enabled,
          color: n <= (current || 0) ? 'primary' : 'default',
          onClick: function () {
            setDraft(null);
            onChange(value === n ? null : n);
          },
        },
        '*',
      ),
    );
  }

  return Box(
    null,
    Typography({ variant: 'body2', color: 'textSecondary' }, hint),
    Box({ display: 'flex' }, stars),
  );
}

module.exports = { default: RatingStars };
```

## Using it in your form

Set `format` to the folder name and add any parameters your component reads from `config`:

```json
{
  "type": "object",
  "title": "Rate this visit",
  "format": "rating-stars",
  "maxStars": 5
}
```

With that schema, `props.config.maxStars === 5`.

The field's JSON Schema `type` must match what you pass to `onChange()` — return an object for `"type": "object"`, an array for `"type": "array"` — so AJV validation passes.

## Internationalization

Custom question types use the **same** `ui.json` `translations` pattern as built-in controls. Put user-visible strings in `label`, `description`, and `Control.options` rather than hardcoding them in `renderer.js`:

```json
{
  "type": "Control",
  "scope": "#/properties/rating",
  "label": "Rate this",
  "options": { "hint": "Tap a star" },
  "translations": {
    "pt": {
      "label": "Avalie",
      "options": { "hint": "Toque numa estrela" }
    }
  }
}
```

The renderer reads `props.options.hint`. Behavioural settings such as `maxStars` stay in `schema.json` and arrive in `config`. See [Form translations](/docs/guides/form-translations).

## Loading media in the WebView

Inside the WebView, `<img src>` cannot load legacy relative paths such as `/default/data/tables/...`. Use the injected `getFormulus()` API (see `FormulusInterfaceDefinition.ts` in Formulus / Formplayer):

- **`getAttachmentUri(fileName)`** — returns a `file://` URL if that basename exists under the app attachments directory (or `pending_upload`), else `null`. Use the observation media `filename` / `photo.filename` basename.
- **`getAttachmentsUri()`** — base `file://` URL for the attachments folder (trailing slash).
- **`getCustomAppUri()`** — base `file://` URL for the app directory.
- **`getFormSpecsUri()`** — base `file://` URL for the form specs directory.

## Error handling

If your component throws while rendering, an error boundary catches it and shows a labelled fallback **in place of that question only**. The form keeps working and the remaining questions stay answerable, but the affected field cannot be edited until the component is fixed. The boundary's own text is translated by Formplayer.

## Related: custom validators

Custom **question types** render UI; custom **validators** (`validators/<name>/index.js` in the app bundle) run from `ui.json` `options.customValidators` and return errors. Validators may also **mutate** the full form `data` object in place — for example assigning sequence numbers on embedded sub-observation arrays — and Formplayer detects those mutations and refreshes state so tables and dependent fields update without extra custom question types.

**Per-session scope:** Validators run only in the **active** Formplayer session. Nested sub-observation child forms need their own validators (or parent snapshot init fields) for numbering and cross-row rules; root-only validators are not enough for deep embedded trees.

See [Custom Extensions](/docs/guides/custom-extensions) for validator packaging, [nested sessions](/docs/guides/custom-extensions#nested-sessions-and-custom-validators), [parent context](/docs/guides/custom-extensions#parent-context-across-nesting-levels), and sub-observation configuration (`linkedForm` required; `parentKey` optional).
