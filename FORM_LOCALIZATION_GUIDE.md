# Form localization guide

How **user-defined forms** (JSON Schema + `ui.json` in custom app bundles) support multiple languages in ODE.

**Audience:** platform developers editing Formplayer/Formulus, and custom app authors shipping forms in app bundles.

**Published user guide:** [Form translations](https://opendataensemble.org/docs/guides/form-translations) on opendataensemble.org (kept in sync conceptually; this file is the monorepo implementation reference).

---

## Two i18n layers (do not mix them up)

| Layer | Who owns it | Where strings live | When it applies |
|-------|-------------|-------------------|-----------------|
| **ODE chrome** | ODE platform | `formulus-formplayer/src/locales/{en,pt,fr}.json`, Formulus i18n catalogs | Next/Back, validation errors, sub-obs “+ Add …” template, loading text |
| **Form copy** | Form / app author | `ui.json` base fields + optional `translations` blocks | Field labels, descriptions, SwipeLayout headers, custom widget copy |

Form authors **do not** edit ODE locale JSON. They embed translations in each form’s `ui.json`. ODE developers extend chrome strings when adding new platform UI.

---

## How form locale is chosen

1. User setting in Formulus **Settings → Language** (`auto`, `en`, `pt`, `fr`)
2. **Auto** → device language; if unsupported, bundle `defaultLocale` from `app.config.json`
3. Fallback `en`

The host passes the resolved tag as **`params.locale`** when opening Formplayer. Formplayer merges form translations **once at init** (`applyFormUiTranslations()` in `formulus-formplayer/src/i18n/applyFormUiTranslations.ts`).

```json
// app/public/app.config.json (custom app bundle)
{
  "defaultLocale": "pt"
}
```

Use `defaultLocale` when the study’s primary language is not English so **Auto** prefers the right default on devices whose language ODE does not ship.

---

## Authoring pattern: base string + `translations`

Put the **default** copy on the element (`label`, `description`, `text`, …). Add **`translations.<locale>`** only for locales that differ.

```json
{
  "type": "Control",
  "scope": "#/properties/participant_name",
  "label": "Participant name",
  "description": "Full legal name",
  "translations": {
    "pt": {
      "label": "Nome do participante",
      "description": "Nome legal completo"
    },
    "fr": {
      "label": "Nom du participant"
    }
  }
}
```

**Rules:**

- Base `label` is required for every user-visible control — do not rely on `schema.json` `title` for display text in multi-locale forms.
- `translations` keys are **partial**; missing keys fall back to the base string.
- Locale lookup tries the full BCP-47 tag then the language subtag (`pt-BR` → `pt`).
- `translations.<locale>.title` is accepted as an alias for `label` in that block (legacy convenience).

### Portuguese-primary study with English override

Base language can be anything; merge logic is symmetric.

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

| Active UI locale | Shown label |
|------------------|-------------|
| `pt` | Base (`label`) |
| `en` | `translations.en.label` |
| `fr` (no block) | Base (`label`) |

---

## `schema.title` vs `ui.json` `label`

| | `schema.json` → `properties.*.title` | `ui.json` → `Control.label` |
|---|--------------------------------------|-----------------------------|
| Translated at runtime? | No | Yes |
| Primary on-screen label? | Fallback only | Yes |

```json
// schema.json — keep for validation / exports; not your i18n source of truth
{
  "properties": {
    "codigo": { "type": "string", "title": "Código" }
  }
}
```

```json
// ui.json — what the user actually reads
{
  "type": "Control",
  "scope": "#/properties/codigo",
  "label": "Digitalizar código do envelope",
  "translations": { "en": { "label": "Scan the envelope code" } }
}
```

Formplayer resolves labels in order: **`Control.label`** (after translation merge) → JsonForms default → **`schema.title`** → field key. All built-in renderers, SwipeLayout header chips, Finalize summaries, and sub-observation column headers use this path (`controlDisplayText.ts`).

---

## SwipeLayout chrome

Put button and header copy in **`options`**. Override per locale via top-level keys in the translation block (merged into `options`) or nested `translations.<locale>.options`:

```json
{
  "type": "SwipeLayout",
  "elements": [],
  "options": {
    "headerTitle": "Household interview",
    "nextButtonLabel": "Next",
    "finalizeButtonLabel": "Finish"
  },
  "translations": {
    "pt": {
      "headerTitle": "Entrevista ao agregado",
      "nextButtonLabel": "Seguinte",
      "finalizeButtonLabel": "Concluir"
    }
  }
}
```

---

## Sub-observations

**Add button:** if `options.addButtonLabel` is omitted, Formplayer composes `+ Add {itemLabel}` from schema `itemLabel` using ODE chrome strings (`subObservation.addItem`). Override when you need custom wording:

```json
{
  "type": "Control",
  "scope": "#/properties/quartos",
  "label": "Quartos",
  "options": {
    "addButtonLabel": "+ Adicionar quarto"
  },
  "translations": {
    "en": {
      "addButtonLabel": "+ Add room"
    }
  }
}
```

**Table columns:** list columns by **`key` only** in `schema.json`. Headers come from the **linked child form**’s `ui.json` labels (after translation), not from hardcoded schema column titles:

```json
"x-subObservation": {
  "formType": "censo_milda_quarto",
  "itemLabel": "quarto",
  "columns": [{ "key": "quarto_num" }, { "key": "quarto_display" }]
}
```

Child forms need their own `Control.label` + `translations` for those fields. Optional static `column.label` / `options.columns[].label` overrides all locales.

---

## Custom question types

Widget-specific copy belongs in **`Control.options`**, not hardcoded in `question_types/.../renderer.js`:

```json
{
  "type": "Control",
  "scope": "#/properties/confidence",
  "label": "How confident are you?",
  "options": {
    "lowLabel": "Not at all",
    "highLabel": "Very",
    "oneOf": [{ "const": "yes", "title": "Yes" }]
  },
  "translations": {
    "pt": {
      "label": "Qual é a sua confiança?",
      "options": {
        "lowLabel": "Nada",
        "highLabel": "Muito",
        "oneOf": [{ "const": "yes", "title": "Sim" }]
      }
    }
  }
}
```

Behavioral config (`maxStars`, filters, …) stays in **`schema.json`** (`config` / validation), not in translated UI copy.

---

## Translatable properties (v1)

| Element | Properties |
|---------|------------|
| `Control` | `label`, `description`; nested `options.*` |
| `Group`, `Category` | `label` |
| `Label` | `text` |
| `SwipeLayout` (root) | `options.headerTitle`, `options.nextButtonLabel`, `options.finalizeButtonLabel` |
| Sub-observation | `options.addButtonLabel`; optional `options.columns[].label` |

---

## Platform implementation map

| Concern | Location |
|---------|----------|
| Merge `translations` into UI schema at init | `formulus-formplayer/src/i18n/applyFormUiTranslations.ts` |
| Label resolution at render time | `formulus-formplayer/src/utils/controlDisplayText.ts` |
| Form init + `params.locale` | `formulus-formplayer/src/App.tsx` |
| ODE chrome catalogs | `formulus-formplayer/src/locales/*.json` |
| UI locale preference (host) | `formulus/src/lib/locale.ts`, Settings → Language |
| Linked child specs for sub-obs columns | `FormInitData.linkedFormSpecs` (built in Formulus / ODE Desktop) |

When changing merge rules or label resolution, update **`applyFormUiTranslations.test.ts`**, affected renderers, and the [published form translations guide](https://opendataensemble.org/docs/guides/form-translations) in **ode-docs**.

---

## Author checklist

- [ ] Every visible field has `Control.label` in `ui.json` (not only `schema.title`)
- [ ] Base `label` set; `translations` added for other ODE UI locales you ship (`en`, `pt`, `fr`)
- [ ] SwipeLayout headers/buttons translated where needed
- [ ] Sub-obs columns use `key` only; labels live on linked child forms
- [ ] Custom question type strings in `options`, not in renderer JS
- [ ] `defaultLocale` in `app.config.json` when the study default is not English
