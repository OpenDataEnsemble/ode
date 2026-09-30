---
sidebar_position: 4
---

# Choice lists

This guide explains how dropdown menus work in ODE custom app forms. You do **not** need to be a programmer to follow the walkthroughs — you only need to edit JSON files in your app bundle and test on a device.

---

## Two kinds of dropdowns

In ODE forms, a “choice list” is any field where the user picks one option from a list.

| Kind | Plain English | When to use it |
|------|---------------|----------------|
| **Shared choice list** | A **fixed menu** you define once (Yes/No, job roles, regions, …) and reuse in many forms | The options are **known in advance** and do not depend on data already collected |
| **Dynamic choice list** | A menu **filled from observations** already saved on the device (sites, participants, visits, …) | The options **come from earlier forms** or other records on the tablet |

**Simple rule:** If the list could be printed on a paper protocol, use a **shared** list. If the list only makes sense after people have entered data in the field, use a **dynamic** list.

**Files you will touch:**

| Kind | Main files |
|------|------------|
| Shared | `forms/shared-choice-defs.schema.json` + each form’s `schema.json` |
| Dynamic | Only the form’s `schema.json` (and `ui.json` for layout) |

**Related guides:** [Observation queries and local indexes](./observation-queries) (optional performance tuning for dynamic lists), [Form design](./form-design), [Custom extensions](./custom-extensions).

---

## Part 1 — Shared choice lists

### What you are building

Imagine a single spreadsheet tab named **“All our dropdown menus”**. Every form can point at a row on that tab instead of copying the same options again and again.

In ODE, that “spreadsheet tab” is one file:

**`forms/shared-choice-defs.schema.json`**

Each menu is a named block inside `$defs`. Forms connect to it with a **`$ref`** link.

### How a shared list is stored

Each option has:

- **`const`** — the value saved in the database (short code, e.g. `yes`)
- **`title`** — the label the user sees (e.g. `Yes`)

Example structure:

```json
{
  "$id": "forms/shared-choice-defs.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$defs": {
    "yes_no": {
      "oneOf": [
        { "const": "yes", "title": "Yes" },
        { "const": "no", "title": "No" }
      ]
    }
  }
}
```

Use **snake_case** names for lists (`yes_no`, `region_list`, `priority_level`).

### How shared lists render on device

By default, a plain `oneOf` / `$ref` field renders as a **native HTML `<select>`** inside outlined styling. This avoids opening the on-screen keyboard on tablets and works reliably inside Formulus WebViews (MUI Menu portals do not).

| Goal | `ui.json` control `options` |
|------|----------------------------|
| Default dropdown (recommended) | Omit `display` — native select is used |
| Searchable long list | `"autocomplete": true` |
| Yes/No as horizontal buttons | `"display": "buttons", "orientation": "horizontal"` |
| Radio list | `"display": "radio"` |
| Localized placeholder | `"placeholder": "Select…"` |

For multi-select array fields, use `"display": "checkboxes"` or `"display": "buttons"`. See [Form design → Control options](./form-design#control-options).

---

### Walkthrough A — Create your first shared list (step by step)

**Goal:** Add a Yes/No question that every form can reuse.

**Step 1 — Open the catalog file**

Open `forms/shared-choice-defs.schema.json` in your bundle.

**Step 2 — Add a new list under `$defs`**

If `yes_no` is not there yet, add:

```json
"yes_no": {
  "oneOf": [
    { "const": "yes", "title": "Yes" },
    { "const": "no", "title": "No" }
  ]
}
```

**Step 3 — Save the file**

**Step 4 — Validate (if your project has a script)**

```powershell
cd app
npm run validate:forms
```

Fix any errors before continuing.

You have now created a shared list. Next, attach it to a form field.

---

### Walkthrough B — Use a shared list on one form field (step by step)

**Goal:** On form `visit`, field `completed_survey`, show the Yes/No menu.

**Step 1 — Open the form schema**

Open `forms/visit/schema.json` (replace `visit` with your form folder name).

**Step 2 — Add or edit the property**

```json
"completed_survey": {
  "type": "string",
  "title": "Was the survey completed?",
  "$ref": "forms/shared-choice-defs.schema.json#/$defs/yes_no"
}
```

**Important:** The `$ref` line must match **exactly**:

```
forms/shared-choice-defs.schema.json#/$defs/<list_name>
```

**Step 3 — Add the control in `ui.json`**

```json
{
  "type": "Control",
  "scope": "#/properties/completed_survey"
}
```

**Step 4 — Validate and test**

Run form validation, sync the bundle to a device, open the form, and confirm both options appear.

---

### Walkthrough C — Add a new list with several options (step by step)

**Goal:** A “Priority” dropdown with Low / Medium / High, used on multiple forms.

**Step 1 — Add the list to the catalog**

In `shared-choice-defs.schema.json`:

```json
"priority_level": {
  "oneOf": [
    { "const": "low", "title": "Low" },
    { "const": "medium", "title": "Medium" },
    { "const": "high", "title": "High" }
  ]
}
```

**Step 2 — Reference it from a form**

In any form `schema.json`:

```json
"task_priority": {
  "type": "string",
  "title": "Priority",
  "$ref": "forms/shared-choice-defs.schema.json#/$defs/priority_level"
}
```

**Step 3 — Validate**

Search your `forms/` folder to ensure no form still points at a deleted list name.

---

### Walkthrough D — “Other, please specify” pattern (step by step)

**Goal:** User picks “Other” and then types a short explanation.

**Step 1 — Include `other` in the shared list**

```json
"region_list": {
  "oneOf": [
    { "const": "north", "title": "North region" },
    { "const": "south", "title": "South region" },
    { "const": "other", "title": "Other" }
  ]
}
```

**Step 2 — Add the main dropdown on the form**

```json
"assigned_region": {
  "type": "string",
  "title": "Assigned region",
  "$ref": "forms/shared-choice-defs.schema.json#/$defs/region_list"
}
```

**Step 3 — Add a free-text field for the explanation**

```json
"assigned_region_other": {
  "type": "string",
  "title": "Other region (please specify)",
  "maxLength": 200
}
```

**Step 4 — In `ui.json`**

Show both controls. Use your form’s usual rules (or JSON Forms rules) to show `assigned_region_other` only when `assigned_region` is `other`.

---

### Changing or removing shared options

| What you want | Steps | Safe for old data? |
|---------------|-------|--------------------|
| Change label only | Edit `title`, keep `const` the same | Yes |
| Add a new option | Add one `oneOf` entry | Yes |
| Rename stored value | Change `const` | **Risky** — old records keep the old code |
| Remove an option | Delete its `oneOf` entry; search forms for that `const` | Only if nothing stored that value |
| Delete whole list | Remove `$defs` entry and every `$ref` to it | Only after forms are updated |

---

### Deploy shared list changes

`shared-choice-defs.schema.json` ships inside your app bundle with the `forms/` folder.

1. Upload a **new bundle version** (Synkronus CLI or your usual process).
2. **Sync** devices so Formulus loads the updated definitions.

---

## Part 2 — Dynamic choice lists

### What you are building

A dynamic dropdown does **not** store its options in `shared-choice-defs.schema.json`. Instead, when the user opens the form, the app:

1. Looks at observations already on the device (e.g. all `participant` records).
2. Applies any filters you configured (e.g. only `status = active`).
3. Builds the dropdown labels from those records.

You configure this on **one field** in `schema.json` using **`x-dynamicEnum`**.

### Before you start — checklist

| Requirement | Why |
|-------------|-----|
| Field type is **`string`** | The saved answer is text (often an observation id or a field value) |
| Form type **`query`** exists | `query` is the folder name under `forms/` (e.g. `forms/participant/`) |
| Data exists on the device | Empty table → empty dropdown |
| Custom app provides **`getDynamicChoiceList`** | Usually in your app extensions; ships with the bundle |

:::tip
Test dynamic fields **after** syncing observations that match your `query` form type. An empty list is often “no data yet,” not a broken config.
:::

---

### The five settings that matter most

Full example first; then each part in plain language.

```json
"selected_participant": {
  "type": "string",
  "title": "Select participant",
  "x-dynamicEnum": {
    "function": "getDynamicChoiceList",
    "query": "participant",
    "params": {
      "status": "active"
    },
    "valueField": "observationId",
    "labelField": "data.display_name",
    "distinct": false
  }
}
```

| Setting | Required? | What it does |
|---------|-----------|--------------|
| **`query`** | **Yes** | Which form type to read (`participant` → folder `forms/participant/`) |
| **`params`** | No | Only show rows where these **data fields** match (equality filters) |
| **`valueField`** | No (default: observation id) | What gets **saved** when the user picks an option |
| **`labelField`** | No | What the user **sees** in the dropdown |
| **`distinct`** | No (default: `false`) | `true` = one row per unique **value** (good for “list all site names”) |
| **`function`** | No | Name of the extension function (almost always `getDynamicChoiceList`) |

**Field names in `params`:** use the name as it appears **inside** observation data (e.g. `site_name`), not `data.site_name`. The platform adds the `data.` prefix when querying.

---

### Walkthrough 1 — Pick one record from a list (participant picker)

**Goal:** User chooses any participant; save the participant’s observation id.

**Assumptions:**

- Form type folder: `forms/participant/`
- Each participant observation has `data.display_name` (e.g. `"Ada Lovelace"`)

**Step 1 — Add the field in `schema.json`**

```json
"participant_id": {
  "type": "string",
  "title": "Participant",
  "x-dynamicEnum": {
    "query": "participant",
    "params": {},
    "valueField": "observationId",
    "labelField": "data.display_name",
    "distinct": false
  }
}
```

**Step 2 — Add `Control` in `ui.json`**

```json
{
  "type": "Control",
  "scope": "#/properties/participant_id"
}
```

**Step 3 — Test on device**

1. Sync so at least one `participant` observation exists.
2. Open the form with this field.
3. Open the dropdown — you should see display names.
4. Save the form and confirm `participant_id` stores an observation id.

**What gets saved:** `observationId` of the chosen row (because `valueField` is `observationId`).

---

### Walkthrough 2 — Show each value only once (distinct site names)

**Goal:** Dropdown lists every **site name** already registered, with no duplicates.

**Assumptions:**

- Form type: `site`
- Field on each site record: `data.site_name`

**Step 1 — Add the field**

```json
"site_name": {
  "type": "string",
  "title": "Site",
  "x-dynamicEnum": {
    "query": "site",
    "params": {},
    "valueField": "data.site_name",
    "labelField": "data.site_name",
    "distinct": true
  }
}
```

**Step 2 — Test**

Create two `site` observations with the same `site_name` — the dropdown should still show that name **once**.

**When to use `distinct: true`:** You care about the **value** (name, code, region), not which observation row it came from.

---

### Walkthrough 3 — Cascading dropdown (district depends on site)

**Goal:** User picks a **site** first; the **district** dropdown only shows districts for that site.

**Assumptions:**

- `site` observations have `data.site_name` and `data.district`
- On the current form, the user already filled `site_name` (same form, earlier question)

**Step 1 — Site field (could be shared list or dynamic — here we assume plain string)**

```json
"site_name": {
  "type": "string",
  "title": "Site name"
}
```

**Step 2 — District field filtered by site**

```json
"district": {
  "type": "string",
  "title": "District",
  "x-dynamicEnum": {
    "query": "site",
    "params": {
      "site_name": "{{data.site_name}}"
    },
    "valueField": "data.district",
    "labelField": "data.district",
    "distinct": true
  }
}
```

**Step 3 — Order fields in `ui.json`**

Put **Site name** **above** **District** so the parent value exists before the child loads.

**How `{{data.site_name}}` works:**

- Text in double curly braces copies a value from the **current form**.
- `data.` means “inside the form answers object.”
- If the parent is empty, that filter is **skipped** (wider list — often confusing; order fields carefully).

**Step 4 — Test**

1. Pick site A → district list should only show districts seen on site A records.
2. Change site → district list should reload.

---

### Walkthrough 4 — Filtered list (active participants at one site)

**Goal:** Only participants who are **active** and belong to the **selected site**.

**Step 1 — Configure `params`**

```json
"participant_at_site": {
  "type": "string",
  "title": "Participant at this site",
  "x-dynamicEnum": {
    "query": "participant",
    "params": {
      "status": "active",
      "site_name": "{{data.site_name}}"
    },
    "valueField": "observationId",
    "labelField": "data.display_name",
    "distinct": false
  }
}
```

**Step 2 — Match real field names**

Open a saved `participant` observation on the device (or in export) and confirm fields are really named `status` and `site_name`. If your project uses `site_id` instead, use that key in `params`.

**Step 3 — Test with edge cases**

| Situation | Expected behavior |
|-----------|-------------------|
| No participants match | Empty dropdown |
| Parent `site_name` empty | `site_name` filter skipped; may show all active participants |
| Wrong param name | Empty or wrong results — fix spelling to match JSON |

---

### Walkthrough 5 — Extra conditions with `whereClause` (optional)

**Goal:** Only adults (age 18+) in the list.

Add inside `params`:

```json
"params": {
  "whereClause": "data.age_years >= 18"
}
```

**Good to know:**

- Simple equalities like `data.status = 'active'` are turned into normal filters when possible.
- Some expressions (e.g. age calculated from date of birth) run **after** the database query in JavaScript — they can be slower on large datasets.
- Prefer equality filters in `params` when you can (see performance below).

---

### Performance — making large lists faster (optional)

When many observations exist, filtering by `params` is much faster if those fields are listed in **`app.config.json`** under **`observationIndexes`**.

Example (your keys and form types will differ):

```json
"observationIndexes": [
  { "key": "site_name", "path": "$.site_name", "formTypes": ["site", "participant"] },
  { "key": "status", "path": "$.status", "formTypes": ["participant"] }
]
```

Param keys in `x-dynamicEnum` should **match** `key` values when possible. Details: [Observation queries and local indexes](./observation-queries).

You do **not** need indexes for small pilots; add them when dropdowns feel slow.

---

### Add, change, or remove a dynamic field — checklist

1. Add `x-dynamicEnum` on the property in `schema.json`.
2. Add a `Control` in `ui.json` with the matching `scope`.
3. Confirm `query` equals a folder name under `forms/`.
4. Validate JSON.
5. Sync test data and try on device.
6. (Optional) Add `observationIndexes` for heavily used filter keys.

---

### Dynamic lists — troubleshooting

| What you see | What to check |
|--------------|----------------|
| Empty dropdown | Any observations for `query`? Filters too strict? Typo in `params` keys? |
| List never updates when parent changes | Parent field must be filled first; check `{{data....}}` path |
| Wrong text in dropdown | `labelField` must match real JSON (`data.display_name`, etc.) |
| Saved value looks wrong | `valueField` — `observationId` vs `data.some_code` |
| `Function not found` | Rebuild/sync bundle with custom app extensions |
| Slow on large projects | Add `observationIndexes` for hot `params` keys |

---

## Which type should I use?

| Your situation | Use |
|----------------|-----|
| Options are fixed in the study protocol | **Shared** list + `$ref` |
| Options come from data already on the tablet | **Dynamic** list + `x-dynamicEnum` |
| Same labels in 10 forms | **Shared** list (one catalog file) |
| “Pick a person who was registered earlier” | **Dynamic** list |

---

## Before you release

- [ ] Form validation passes (`validate:forms` or your project equivalent)
- [ ] **Shared:** new stored values (`const`) agreed with analysis / exports
- [ ] **Dynamic:** `query` form exists; `params` names match real observation fields
- [ ] **Dynamic:** tested on device with realistic synced data
- [ ] **Dynamic (optional):** indexes added for large deployments

---

## For developers (short reference)

| Layer | Role |
|-------|------|
| Shared `$ref` | Resolved when forms load (Formulus / validation) |
| `x-dynamicEnum` | Formplayer `DynamicEnumControl` |
| Data fetch | `getDynamicChoiceList` → structured filter → `getObservationsByQuery` |
| Fast filters | `observationIndexes` in `app.config.json` |

Legacy URL: [Dynamic choice lists](./dynamic-choice-lists) redirects to this page.
