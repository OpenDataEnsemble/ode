# Dynamic Choice Lists Documentation

> **Production Ready** ✅ | Version 1.0 | Complete Reference & Quick Guide

## Table of Contents

- [Quick Start](#quick-start)
- [Overview](#overview)
- [Basic Usage](#basic-usage)
- [Real-World Examples](#real-world-examples)
- [Query Reference](#query-reference)
- [Troubleshooting](#troubleshooting)
- [Production Checklist](#production-checklist)

---

## Quick Start

### What Are Dynamic Choice Lists?

Transform static dropdowns into dynamic, data-driven selections:

```json
// ❌ Static (gets outdated)
{
  "village": {
    "type": "string",
    "enum": ["kopria", "lorenkacho", "chare"]
  }
}

// ✅ Dynamic (always current)
{
  "village": {
    "type": "string",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "household",
      "params": {},
      "valueField": "data.hh_village_name",
      "labelField": "data.hh_village_name",
      "distinct": true
    }
  }
}
```

### Quick Syntax

```json
{
  "fieldName": {
    "type": "string",
    "title": "Display Title",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",     // Always this value
      "query": "formType",                    // Form to query (e.g., "household", "hh_person")
      "params": {},                           // Filters (see below)
      "valueField": "data.fieldName",         // Path to value in observations
      "labelField": "data.fieldName",         // Path to display label
      "distinct": true                        // true = unique values only
    }
  }
}
```

### Common Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `function` | string | ✅ Yes | Must be `"getDynamicChoiceList"` | `"getDynamicChoiceList"` |
| `query` | string | ✅ Yes | Form type to query | `"household"`, `"hh_person"` |
| `valueField` | string | ✅ Yes | Path to value (use `data.` prefix) | `"data.hh_village_name"` |
| `labelField` | string | No | Path to label (defaults to valueField) | `"data.names"` |
| `params` | object | No | Filter parameters | `{"sex": "male"}` |
| `distinct` | boolean | No | Return only unique values | `true` or `false` |

---

## Overview

Dynamic Choice Lists enable:

✅ **Data-driven dropdowns** - Load from existing observations  
✅ **Filtered queries** - Filter by static parameters  
✅ **ODK-X parity** - Replaces linked tables and "select person"  

**Note:** Cascading dropdowns (template parameters like `{{data.field}}`) are not supported. Use static filters only.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Form Schema (JSON)                                      │
│ - x-dynamicEnum configuration                           │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ DynamicEnumControl (React Component)                    │
│ - Resolves templates: {{data.field}}                    │
│ - Calls getDynamicChoiceList                            │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ builtinExtensions.ts (formulus-formplayer)              │
│ - Builds WHERE clause from params + whereClause          │
│ - Handles age_from_dob() via JS filtering                │
│ - Calls window.formulus.getObservationsByQuery           │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ WebView Bridge (formulus-load.js / FormulusInjection)   │
│ - getObservationsByQuery sends message to native host   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ FormulusMessageHandlers → FormService                   │
│ - filterObservationsByWhereClause supports:              │
│   - data.field = 'value' (builtinExtensions)             │
│   - json_extract(data, '$.field') = 'value' (extensions) │
│ - Queries WatermelonDB, returns filtered observations   │
└─────────────────────────────────────────────────────────┘
```

---

## Basic Usage

### Example 1: Simple Dropdown (All Villages)

```json
{
  "village": {
    "type": "string",
    "title": "Select Village",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "household",
      "params": {},
      "valueField": "data.hh_village_name",
      "labelField": "data.hh_village_name",
      "distinct": true
    }
  }
}
```

**Result:** Shows all unique villages from household observations.

### Example 2: Filtered Dropdown (Males Only)

```json
{
  "male_person": {
    "type": "string",
    "title": "Select Male Participant",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {
        "sex": "male"
      },
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

**Result:** Shows only males from hh_person observations.

---

## Real-World Examples

### Location Selection (Static Filters)

```json
{
  "village": {
    "type": "string",
    "title": "Select Village",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "household",
      "params": {},
      "valueField": "data.hh_village_name",
      "labelField": "data.hh_village_name",
      "distinct": true
    }
  },
  "subvillage": {
    "type": "string",
    "title": "Select Subvillage",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "household",
      "params": {
        "hh_village_name": "kopria"
      },
      "valueField": "data.hh_subvillage",
      "labelField": "data.hh_subvillage",
      "distinct": true
    }
  }
}
```

**Note:** Template parameters (`{{data.field}}`) are not supported. Use static filter values.

### Select Person (ODK-X Pattern)

**Basic - All Persons:**
```json
{
  "person_id": {
    "type": "string",
    "title": "Select Person",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {},
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

**Filtered by Village (Static):**
```json
{
  "person_id": {
    "type": "string",
    "title": "Select Person from Village",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {
        "p_hh_res_validation": "kopria"
      },
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

**Note:** Template parameters are not supported. Use static values.

**Filtered by Sex:**
```json
{
  "female_participant": {
    "type": "string",
    "title": "Select Female Participant",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {
        "sex": "female"
      },
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

**Multiple Filters:**
```json
{
  "participant": {
    "type": "string",
    "title": "Select Female from Kopria",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {
        "sex": "female",
        "p_hh_res_validation": "kopria"
      },
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

### Ranking Survey

```json
{
  "rank_1": {
    "type": "string",
    "title": "Most Influential Person (Rank #1)",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {
        "sex": "male"
      },
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  },
  "rank_2": {
    "type": "string",
    "title": "Rank #2",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {
        "sex": "male"
      },
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

**Note:** Template parameters are not supported. Use static filters only.

### Kinship Survey

```json
{
  "p_kin_sibling_id": {
    "type": "string",
    "title": "Select Sibling",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {},
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

**With Sex Filter (for mother/father):**
```json
{
  "p_kin_mother_id": {
    "type": "string",
    "title": "Select Mother",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {
        "sex": "female"
      },
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

### Age-Based Filtering

**Adults Only (18+) - Using age_from_dob():**
```json
{
  "adult_participant": {
    "type": "string",
    "title": "Select Adult (18+)",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {
        "whereClause": "age_from_dob(data.dob) >= 18"
      },
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

**Age Range - Using age_from_dob():**
```json
{
  "working_age": {
    "type": "string",
    "title": "Select Working Age Adult (18-65)",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {
        "whereClause": "age_from_dob(data.dob) >= 18 AND age_from_dob(data.dob) <= 65"
      },
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

**Using p_age_participant_estimate (if available):**
```json
{
  "adult_participant": {
    "type": "string",
    "title": "Select Adult (18+)",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {
        "whereClause": "data.p_age_participant_estimate >= 18"
      },
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

**Combined Filters (Static + WHERE clause):**
```json
{
  "adult_male": {
    "type": "string",
    "title": "Select Adult Male (18+)",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "hh_person",
      "params": {
        "sex": "male",
        "whereClause": "age_from_dob(data.dob) >= 18"
      },
      "valueField": "observationId",
      "labelField": "data.names",
      "distinct": false
    }
  }
}
```

**Note:** `age_from_dob(data.dob)` calculates age from date of birth in JavaScript. Use this when you need accurate age calculations. Static age fields like `p_age_participant_estimate` can also be used directly in WHERE clauses.

---

## Query Reference

### Field Path Syntax

**Form Fields:** `data.fieldName`
```
data.hh_village_name      // Village name from household
data.names                // Person name from hh_person
data.sex                  // Sex from hh_person
data.p_age_participant_estimate  // Age
```

**Metadata Fields:**
```
observationId    // Unique ID
formType         // Form type (e.g., "household")
createdAt        // Creation timestamp
updatedAt        // Update timestamp
isDraft          // Is draft?
isDeleted        // Is deleted?
```

### WHERE Clause Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `data.sex = 'male'` |
| `!=` or `<>` | Not equals | `data.sex != 'male'` |
| `<` | Less than | `age_from_dob(data.dob) < 18` |
| `>` | Greater than | `age_from_dob(data.dob) > 65` |
| `<=` | Less than or equal | `age_from_dob(data.dob) <= 18` |
| `>=` | Greater than or equal | `age_from_dob(data.dob) >= 18` |
| `AND` | Logical AND | `age_from_dob(data.dob) >= 18 AND age_from_dob(data.dob) <= 65` |
| `OR` | Logical OR | `data.hh_village_name = 'kopria' OR data.hh_village_name = 'chare'` |
| `NOT` | Logical NOT | `NOT (age_from_dob(data.dob) >= 18 AND age_from_dob(data.dob) <= 65)` |
| `()` | Grouping | `(age_from_dob(data.dob) >= 18 AND age_from_dob(data.dob) <= 30) OR age_from_dob(data.dob) >= 50` |

**Special Functions:**
- `age_from_dob(data.dob)` - Calculates age from date of birth field. Use for accurate age filtering.

### Parameter Filtering vs WHERE Clauses

**Parameter Filtering (Simple Equality):**
```json
{
  "params": {
    "sex": "male",
    "p_hh_res_validation": "kopria"
  }
}
```
Equivalent to: `WHERE data.sex = 'male' AND data.p_hh_res_validation = 'kopria'`

**WHERE Clause (Complex Logic):**
```json
{
  "params": {
    "whereClause": "data.p_age_participant_estimate >= 18 AND data.p_age_participant_estimate <= 65"
  }
}
```

**Combined (Static Filters + WHERE Clause):**
```json
{
  "params": {
    "sex": "female",
    "whereClause": "age_from_dob(data.dob) >= 18"
  }
}
```
Equivalent to: `WHERE data.sex = 'female' AND age_from_dob(data.dob) >= 18`

**WHERE Clause Format:**
- WHERE clauses using `data.field = 'value'` format are automatically converted to `json_extract(data, '$.field') = 'value'` format internally.
- `age_from_dob()` conditions are filtered in JavaScript after fetching observations.
- Static filter parameters (like `sex: "male"`) are automatically converted to the correct SQL format.

**Note:** Template syntax (`{{data.fieldName}}`) is not supported. Use static filter values only.

### Query Optimization Tips

✅ **Use `distinct: true` for unique values:**
```json
{"distinct": true}  // Returns ["kopria", "chare"] instead of 100 duplicates
```

✅ **Filter at query level:**
```json
// Good - filters at query level
{"params": {"p_hh_res_validation": "kopria"}}

// Bad - loads all then filters in UI
{"params": {}}
```

✅ **Combine filters for precision:**
```json
{
  "params": {
    "sex": "female",
    "p_hh_res_validation": "kopria",
    "whereClause": "data.p_age_participant_estimate >= 18"
  }
}
```

---

## Troubleshooting

### Problem: Dropdown is Empty

**Possible Causes:**

1. **No observations exist**
   - Check: Do saved observations exist for the queried form type?
   - Solution: Create at least one observation

2. **Field path doesn't exist**
   - Check: Is `valueField` spelled correctly? Does it match the form schema?
   - Solution: Verify field name in form schema, use correct `data.` prefix

3. **All values are null/empty**
   - Check: Are observations actually filled in for this field?
   - Solution: Edit observations to populate the field

4. **Filter too restrictive**
   - Check: Remove filters temporarily - do results appear?
   - Solution: Relax filters or add observations that match

**Debug:**
1. Open Chrome DevTools (`chrome://inspect`) and inspect the Formulus WebView
2. Verify observations exist for the queried form type in the database
3. If dropdown is empty: check valueField/labelField paths match observation structure

### Problem: Filtered Dropdown Shows All Items

**Possible Causes:**

1. **Filter field name mismatch**
   - Check: Does param name match database field?
   - Example: Using `village_name` but database has `hh_village_name`
   - Solution: Use correct field name from form schema

2. **Value mismatch (case-sensitive)**
   - Check: Do values match exactly?
   - Example: "Kopria" vs "kopria"
   - Solution: Ensure consistent casing

3. **Filter value not matching any records**
   - Check: Do any observations have this exact value?
   - Solution: Verify filter value exists in database

**Debug:**
Verify param names match database field names (e.g. `hh_village_name` not `village_name`).

### Problem: "Failed to load form" Error

**Possible Causes:**

1. **JSON syntax error**
   - Check: Missing comma, extra comma, wrong quotes?
   - Solution: Validate JSON (use online validator)

2. **Function name wrong**
   - Check: Is `function` exactly `"getDynamicChoiceList"`?
   - Solution: Use correct function name (case-sensitive)

3. **Missing required fields**
   - Check: Are `function`, `query`, `valueField` present?
   - Solution: Add all required fields

### Problem: Dropdown Shows IDs Instead of Names

**Solution:** Set `labelField` to a human-readable field:
```json
{
  "valueField": "observationId",
  "labelField": "data.names"
}
```

### Problem: Slow Loading

**Solutions:**
1. Add filters to reduce dataset size
2. Use `distinct: true` for categorical fields
3. Simplify WHERE clause

### Debug Tools

**Chrome DevTools:**
```
1. Connect device via USB
2. Chrome → chrome://inspect
3. Click "Inspect" on Formulus WebView
4. Check Console tab
```

**Metro Bundler:**
```bash
cd formulus
npx react-native start
```


---

## Production Checklist

### Before Deployment

- [ ] `function` is `"getDynamicChoiceList"`
- [ ] `query` matches existing form type
- [ ] `valueField` path exists in observations
- [ ] `labelField` is human-readable
- [ ] `distinct` set appropriately
- [ ] `params` filter fields exist
- [ ] Tested with real data
- [ ] Dropdown populates with expected choices
- [ ] Performance < 1 second load time

### Best Practices

✅ **Do:**
- Use `distinct: true` for unique values
- Use parameter filtering for simple cases
- Use meaningful `labelField`
- Test with actual data
- Use `valueField: "observationId"` for record references
- Use static filter values

❌ **Don't:**
- Query all observations without filtering
- Use `distinct: true` for record IDs
- Forget `data.` prefix in field paths
- Use typos in field names
- Query non-existent form types
- Use template parameters (`{{data.field}}`) - not supported

### Migration from Static Enums

**Before:**
```json
{
  "village": {
    "type": "string",
    "enum": ["kopria", "lorenkacho", "chare"]
  }
}
```

**After:**
```json
{
  "village": {
    "type": "string",
    "x-dynamicEnum": {
      "function": "getDynamicChoiceList",
      "query": "household",
      "params": {},
      "valueField": "data.hh_village_name",
      "labelField": "data.hh_village_name",
      "distinct": true
    }
  }
}
```

**Benefits:**
- Automatically updated as data changes
- No schema redeployment needed
- Always reflects current data

### ODK-X Feature Mapping

| ODK-X Feature | Formulus Equivalent |
|---------------|---------------------|
| Linked tables with SQL | `x-dynamicEnum` with `query` |
| Select person prompt | `query: "hh_person"` with filters |
| Choice filters | `params` or `whereClause` |
| `query()` function | `getDynamicChoiceList` |
| `_id` column | `observationId` field |

**Note:** Cascading selects (template parameters) are not supported.

---

## Summary

Dynamic Choice Lists provide:

✅ Data-driven dropdowns from local observations  
✅ Filtered queries with static parameters  
✅ ODK-X feature parity (select person, ranking)  
✅ Production-ready with error handling  

**Note:** Cascading dropdowns (template parameters) are not supported.  

### Key Files

**Implementation:**
- `formulus-formplayer/src/DynamicEnumControl.tsx` - Renderer
- `formulus-formplayer/src/builtinExtensions.ts` - Query logic, WHERE clause building, age_from_dob filtering
- `formulus-formplayer/public/formulus-load.js` - getObservationsByQuery polyfill (ensures correct message routing)
- `formulus/src/webview/FormulusMessageHandlers.ts` - onGetObservationsByQuery handler
- `formulus/src/services/FormService.ts` - getObservationsByQuery, filterObservationsByWhereClause

**Documentation:**
- This file - Complete reference

### Getting Help

1. Check examples above for similar use case
2. Review troubleshooting section
3. Check console logs for errors
4. Test with simplified schema

---

*Version 1.0 - Production Ready*  
*Last Updated: 2026-02-06*
