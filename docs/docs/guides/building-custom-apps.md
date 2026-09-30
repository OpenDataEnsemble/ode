---
sidebar_position: 5
title: Building Custom Apps
---

# Building Custom Apps

A **custom_app** is a zipped archive containing two folders:

```
custom_app.zip
├── forms/          # Questionnaires (JSONForms specifications)
└── app/            # Application layer (HTML/JavaScript)
```

## What is a custom_app?

In ODE, forms alone are just questionnaires. But custom_apps turn them into rich, interactive data collection experiences. You can:

- **Look up existing observations** (filled-out form responses)
- **Display dashboards and summaries** of collected data
- **Open follow-up forms** with pre-populated values
- **Build longitudinal workflows** (registration → follow-ups)
- **Add helper text, validation, and guidance** for data collectors

The app layer is built with **HTML and JavaScript** — if you can build a web page, you can build a custom_app. Support for frameworks like React, SolidJS, Angular is fully supported.

## When to use custom apps

Use custom_apps when you need:

- **Longitudinal data collection** — follow-up questionnaires linked to initial registrations
- **Context-aware forms** — show relevant forms based on previous answers
- **Dashboards** — visualize or summarize collected data in real-time
- **Offline support** — access and display data on field devices
- **Smart workflows** — complex data collection journeys beyond simple forms

## Key concepts

### Forms vs. Observations

- **Form** — The specification (schema.json + ui.json) that defines what data to collect
- **Observation** — A single filled-out instance of a form (the actual data)

### JSONForms

Custom apps use **JSONForms** extended with ODE-specific question types:
- Standard types: text, number, date, dropdown, radio, checkbox
- ODE extensions: photo, GPS, QR code, signature, **sub-observations** (embedded child payloads as JSON arrays — see [Custom Extensions](./custom-extensions.md#sub-observations-format-sub-observation)), and more

### Data relationships

In longitudinal workflows, observations are linked:
- **One-to-many**: One registered entity → many follow-up observations
  - Example: One coffee bean registration → multiple shots pulled

## Getting started

Ready to build your first custom_app? See the step-by-step guides:

- **[Your First Custom App (v1)](./building-custom-apps-v1.md)** — Learn the fundamentals with the Coffee Tracker example
- **[Longitudinal Data (v2)](./building-custom-apps-v2.md)** — Extend your app with follow-up observations

## Example: Coffee Tracker

Throughout these guides, we'll build **Coffee Tracker** — a simple but complete app for collecting information about roasted coffee beans and tracking espresso shots.

**Version 1.0:** Basic registration form for coffee beans (forms + static landing page)  
**Version 2.0:** Add longitudinal tracking of shots pulled, dashboards, and data injection

## Upload to Synkronus

Once built, upload via:
- **Web UI** — Synkronus Portal → App Bundle page
- **CLI** — `synk app-bundle upload path/to/app.zip -a`

Then users sync by opening Formulus → Sync page → Update App Bundle.

## Next steps

1. Follow the [v1 guide](./building-custom-apps-v1.md) for a complete walkthrough
2. Extend with [v2 guide](./building-custom-apps-v2.md) for longitudinal features
3. Check the [Reference → App Bundle Format](../reference/app-bundle-format.md) for technical details

**Need help?**  
Join our [community forum](https://forum.opendataensemble.org) — we're here to help!
