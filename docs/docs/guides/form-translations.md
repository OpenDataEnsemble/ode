# Form translations (ui.json)

ODE supports **two independent i18n layers**:

1. **ODE i18n** — Formulus shell and Formplayer chrome (buttons, validation messages, loading text). Managed via ODE locale catalogs (`en`, `pt`, `fr` in v1) and **Settings → Language** in Formulus.
2. **Form i18n** — Labels and display strings **authored in your form bundle**, embedded directly in `ui.json`. No external translation files per form.

This guide covers **form i18n** (layer 2).

## Schema `title` vs UI `label`

ODE forms use **two** places where a field can get a human-readable name. They are not interchangeable for multi-locale forms.

| | `schema.json` → `properties.<field>.title` | `ui.json` → `Control.label` (+ `translations`) |
|---|---------------------------------------------|------------------------------------------------|
| **Purpose** | Data contract, validation messages, exports, tooling | What the user sees on screen |
| **Translated at runtime?** | No | Yes — merged once at form init from `params.locale` |
| **When Formplayer uses it** | Fallback when no `Control.label` is set | Primary display label (all locales) |
| **Authoring for multi-locale** | Keep stable; one language is fine (e.g. PT for a PT study) | Put **every** locale the user should see here |

**Rule of thumb:** for any field the user reads in the form, set `Control.label` in `ui.json`. Use `schema.title` for schema semantics and as a last-resort fallback only.

### How Formplayer picks the displayed label

At form init, `applyFormUiTranslations()` merges `translations.<locale>` into the UI schema for the active locale. At render time, Formplayer resolves labels in this order:

1. **`Control.label`** on the UI schema node (after translation merge)
2. JsonForms-derived label (often mirrors `schema.title` when step 1 is missing)
3. **`schema.title`** for that property
4. Field key

All built-in renderers, SwipeLayout **`headerFields`**, Finalize summaries, and sub-observation column headers use this same resolution — not ad-hoc `schema.title` reads in each widget.

**Why this matters:** if locale A gets its copy from `ui.label` but locale B falls back to `schema.title` (because base `label` was omitted), you get **different text and sometimes different layout** (inline vs block spacing) even though the form “looks translated.” Always set a base `label` on controls you translate.

### Layout and label length

SwipeLayout forms often use **inline** rows (label left, control right). **Block** controls (QR scan, photo, signature, etc.) sit below inline neighbours with top padding to align with the row grid.

Row height follows label and value content. A longer label on the row above a block control (even on a single line) increases vertical space before the next field. That is normal layout rhythm, not a sign that translation used a different code path.

## Why embedded `translations` (not JsonForms `i18n` keys)

JSON Forms supports an `i18n` prop with translation **keys** and external catalogs. ODE form translations intentionally use inline locale blocks instead:

- **Portability** — a form zip is self-contained.
- **Offline-first** — no dependency on bundle-wide catalogs for field copy.
- **Performance** — translations are merged **once at form init**, not on every render.
- **Partial coverage** — translate only the fields you need; others fall back to defaults.

ODE platform chrome **does** use JsonForms `i18n` internally.

## Basic shape

On any `ui.json` element, add an optional `translations` object keyed by locale (BCP-47, e.g. `en`, `pt`, `fr`, `pt-BR`):

```json
{
  "type": "Control",
  "scope": "#/properties/participant_name",
  "label": "Participant name",
  "description": "Enter the participant's full name",
  "translations": {
    "fr": {
      "label": "Nom du participant",
      "description": "Saisissez le nom complet"
    }
  }
}
```

**Authoring tip:** always set a base `label` on `Control` elements you translate — in **any** authoring language (English, Portuguese, etc.). The base string is used when the active UI locale has no matching block in `translations`. If only `translations.<locale>.label` is set and base `label` is missing, some locales fall back to `schema.title` while others use `ui.label`, which produces inconsistent copy and layout.

`translations.<locale>.title` is accepted as an alias for `label` when `label` is omitted in that locale block (legacy / migration convenience).

### English base + Portuguese override

```json
{
  "type": "Control",
  "scope": "#/properties/codigo",
  "label": "Scan the envelope code",
  "translations": {
    "pt": { "label": "Digitalizar código do envelope" }
  }
}
```

### Portuguese base + English override

The merge logic is **symmetric** — base locale is whatever you put on `label`; `translations` keys are independent of that choice.

```json
{
  "type": "Control",
  "scope": "#/properties/codigo",
  "label": "Digitalizar código do envelope",
  "translations": {
    "en": { "label": "Scan the envelope code" }
  }
}
```

| Active UI locale | Displayed label |
|------------------|-----------------|
| `pt` | Base PT (`label`) |
| `en` | `translations.en.label` |
| `fr` (no `translations.fr`) | Base PT (`label`) |

For a Portuguese-primary study, set `"defaultLocale": "pt"` in `app.config.json` so **Settings → Language → Auto** prefers PT when the device language is not in the ODE catalog (`en`, `pt`, `fr`).

**Rules:**

- `translations` is optional — forms without it behave exactly as before.
- Keys under `translations[<locale>]` are **partial** — only listed properties are overridden.
- Unknown locale → default strings are used (no error).
- Locale lookup tries the full tag then the language subtag (`pt-BR` → `pt`).

## Translatable properties (v1)

| Element | Properties |
|---------|------------|
| `Control` | `label`, `description`; nested `options.*` for widget copy |
| `Group`, `Category` | `label` |
| `Label` | `text` |
| `SwipeLayout` (root) | `options.headerTitle`, `options.nextButtonLabel`, `options.finalizeButtonLabel` |
| Sub-observation | `options.addButtonLabel`; optional static `options.columns[].label` override |

When `addButtonLabel` is omitted, Formplayer composes the add button from the schema `itemLabel` using ODE locale strings (`subObservation.addItem`, `subObservation.addingItem`). Override per locale with `translations.<locale>.addButtonLabel` (merged into `options`) or `translations.<locale>.options.addButtonLabel`.

`schema.json` titles are **not** mutated at runtime. They remain the fallback when no `Control.label` override exists. For multi-locale forms, put display strings in `ui.json`.

### Sub-observation table columns

In `schema.json`, list columns by `key` only:

```json
"columns": [{ "key": "quarto_num" }, { "key": "quarto_display" }]
```

Formplayer resolves headers from the **linked child form** (loaded at init as `linkedFormSpecs`): child `ui.json` `Control.label` (after translation), then child `schema.title`. Optional `column.label` in schema or `options.columns` is a static override for all locales.

Swipe layout `options.headerFields` chips use the same resolution order as on-screen controls.

## Custom question types

Use the **same** `Control` + `translations` pattern. Put widget-specific copy in `Control.options`; the renderer receives it via the `options` prop:

```json
{
  "type": "Control",
  "scope": "#/properties/confidence",
  "label": "How confident are you?",
  "options": {
    "lowLabel": "Not at all",
    "oneOf": [{ "const": "yes", "title": "Yes" }]
  },
  "translations": {
    "pt": {
      "label": "Qual é a sua confiança?",
      "options": {
        "lowLabel": "Nada",
        "oneOf": [{ "const": "yes", "title": "Sim" }]
      }
    }
  }
}
```

Do not hardcode user-visible strings in `renderer.js`. Behavioral config (`maxStars`, filters) stays in `schema.json` as `config`.

## HTML and handlebars

- HTML in translated strings is allowed; sanitization runs at **render time** (unchanged).
- If the default uses `{{data.village}}`, repeat placeholders in each locale that needs interpolation.

## Active UI locale

Resolved in Formulus **Settings → Language** (Auto / English / Português / Français):

1. Explicit setting, or **Auto** → device language
2. Bundle `defaultLocale` in `app.config.json` (when Auto and device unsupported)
3. Fallback `en`

Formplayer receives `params.locale` from the host. ODE Desktop Form Preview uses the same preference (shared `@ode/uiLocale` storage key).

## Migration from schema-only labels

Studies that author Portuguese (or other languages) in `schema.json` `title` keep working for **single-locale** forms with no `ui.json` `Control` entries.

To add multi-locale support:

1. Add a `Control` for each visible field in `ui.json` (if not already present).
2. Set **`label`** to your authoring language (the default when no `translations` block matches).
3. Add **`translations`** for other ODE UI locales (`en`, `pt`, `fr`).
4. Leave `schema.title` in place for validation/export; do not rely on it for on-screen copy.

**Checklist — avoid mixed label sources:**

- [ ] Every user-visible field has `Control.label` in `ui.json`
- [ ] Base `label` is set (not only `translations.<locale>.label`)
- [ ] SwipeLayout chrome (`headerTitle`, button labels) uses base + `translations` where needed
- [ ] Sub-obs columns use `key` only; labels come from linked child forms
- [ ] Custom question type copy lives in `Control.options`, not hardcoded in `renderer.js`
