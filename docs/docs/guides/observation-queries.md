# Observation queries and local indexes

Custom apps query local observations through **`getObservationsByQuery`** using a **structured filter AST** (Abstract Syntax Tree). Formulus and ODE Desktop compile that AST to SQLite (`json_extract` plus a local **observation index** table). Indexes are declared in **`app.config.json`** and are **never synced** to Synkronus.

## API

```javascript
const people = await formulus.getObservationsByQuery({
  formType: 'register_person',
  includeDeleted: false,
  filter: {
    op: 'and',
    conditions: [
      { field: 'data.village', op: 'eq', value: 'London' },
      { field: 'data.sex', op: 'eq', value: 'female' },
    ],
  },
});
```

### Filter shape

| Node | Fields | Notes |
|------|--------|-------|
| Condition | `field`, `op`, `value` | `field` is `data.*` or a top-level column (`observation_id`, `deleted`, …) |
| Logical | `op: 'and' \| 'or'`, `conditions[]` | Parentheses via nesting |
| Quantifier | `op: 'any'`, `path`, `as`, `where` | Array members via `json_each` |

Supported comparison ops: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`.

**Age from date of birth** (`age_from_dob(...)`) is **not** compiled to SQL. Formplayer evaluates age in JavaScript after fetching (see [Choice lists — dynamic filters](./choice-lists#dynamic-choice-lists)).

Invalid filters **fail closed** (structured error; no unfiltered fallback).

## Declaring indexes (`app.config.json`)

```json
{
  "observationIndexes": [
    { "key": "p_id", "path": "$.p_id", "formTypes": ["hh_person", "p_*"] },
    { "key": "hh_id", "path": "$.hh_id", "formTypes": ["household", "hh_*"] },
    { "key": "age", "path": "$.age", "valueType": "number" }
  ]
}
```

| Property | Purpose |
|----------|---------|
| `key` | Stable index name; matches `data.<key>` in filters |
| `path` | JSON path under observation `data` (e.g. `$.p_id`) |
| `formTypes` | Optional patterns (`*` suffix = prefix match) |
| `valueType` | `"number"` stores `value_num` for numeric comparisons |

Indexes rebuild automatically when the app bundle updates. On **ODE Desktop**, use **Sync → Re-create index** after changing `observationIndexes` or bulk imports.

## Examples

**Person visits (OR on several fields):**

```javascript
filter: {
  op: 'or',
  conditions: [
    { field: 'data.p_id', op: 'eq', value: personId },
    { field: 'data.names', op: 'eq', value: personName },
  ],
}
```

**Household list:**

```javascript
filter: {
  op: 'or',
  conditions: [
    { field: 'data.hh_id', op: 'eq', value: hhId },
    { field: 'data.hh_number', op: 'eq', value: hhNumber },
  ],
}
```

## Performance notes

- One **`formType`** per call; use `Promise.all` for multiple types.
- Declared `data.*` paths use the **index table**; undeclared paths use **`json_extract`** with a dev warning.
- Expression indexes on `observations(data)` may be created for declared paths to speed fallback queries.

## Platform mapping

| Concept | Formulus | ODE Desktop |
|---------|----------|-------------|
| JSON payload | `observations.data` | `observations.payload` |
| Soft delete | `deleted` column | `observation_extras.deleted` |
| Observation id | `observation_id` | `id` |

The AST always uses **`data.*`** for JSON fields; each platform compiler maps to the correct column.

## ODE Desktop developer mode

When [ODE Desktop developer mode](./ode-desktop-developer-mode) is on, `app.config.json` and observation indexes are read from the **mirrored** app under `bundles/dev-local/app/`. After you change index declarations in your local project, mirror again with **Refresh app** so the desktop workspace picks up the new config.
