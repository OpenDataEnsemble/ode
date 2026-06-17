---
name: ode-custom-jsonforms-extension
description: >-
  Guides adding ODE custom JSON Forms extensions (custom renderers, testers, ext.json,
  dynamic functions). Use when extending forms with non-standard controls or wiring
  extension manifests. Official behavior is documented on opendataensemble.org.
---

# ODE custom JSON Forms extensions

## When to use

- Custom **control** rendering (tester + renderer pattern).
- **`ext.json`** (or app-level extension manifest) and module paths.
- **Dynamic choice lists** or helper **functions** referenced from the UI schema.

## What to do

1. Read **[Custom extensions](https://opendataensemble.org/docs/guides/custom-extensions)** and **[Dynamic choice lists](https://opendataensemble.org/docs/guides/dynamic-choice-lists)** on the docs site.
2. Keep **bundled JS** compatible with the Formulus WebView (no Node-only APIs in runtime code).
3. Align **`format`** in schema with the renderer contract described in docs.
4. For AI-only context summaries, **[CONTEXT_ODE_FORMS.md](https://github.com/OpenDataEnsemble/custom_app/blob/main/CONTEXT_ODE_FORMS.md)** in **custom_app** may help — still verify against **opendataensemble.org**.

## Do not

- Assume vanilla **jsonforms.io** examples work without checking ODE’s registered renderers and extension loading rules.
