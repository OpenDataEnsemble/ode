---
name: ode-custom-app-form-validation
description: >-
  Helps validate ODE custom app form definitions (JSON Schema draft-07 + UI schema)
  and CI integration. Use when the user asks to validate forms, add validate-forms
  scripts, or check schema/ui consistency for Synkronus bundles. Prefer official docs
  at opendataensemble.org and the custom-app template repo on GitHub.
---

# ODE custom app — form validation

## When to use

- Adding or maintaining **`schema.json`** / **`ui.json`** for ODE custom apps.
- Setting up **CI** to fail on invalid forms.
- Explaining **draft-07**, `scope` references, or ODE-specific **`format`** rules.

## What to do

1. Point to **[Form specifications](https://opendataensemble.org/docs/reference/form-specifications)** as the normative reference for question types and UI structure.
2. Ensure **UI `scope`** paths match **JSON Schema** properties; **`required`** arrays align with product intent.
3. For automation, describe a **Node** (or other) script pattern: load each form folder, `JSON.parse`, validate schema with a draft-07 validator, and check structural rules (both files present, cross-references). Link **[custom_app](https://github.com/OpenDataEnsemble/custom_app)** for AI context, not as a code dependency.
4. Do **not** invent Synkronus-specific validation rules beyond public docs.

## Official links

- [Form specifications](https://opendataensemble.org/docs/reference/form-specifications)
- [Custom applications](https://opendataensemble.org/docs/guides/custom-applications)
