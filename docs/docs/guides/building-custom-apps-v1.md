---
sidebar_position: 6
title: Your First Custom App (v1)
---

# Your First Custom App: Coffee Tracker v1

## Overview

In this guide, we'll build **Coffee Tracker v1** — our first custom_app for registering roasted coffee beans.

You'll learn:
- How forms (schema.json + ui.json) work together
- How to structure a custom_app bundle
- How to upload and test your app in Formulus

**Time to complete:** 30–45 minutes  
**Prerequisites:**
- Comfortable editing JSON and HTML
- Access to a Synkronus server and Formulus app
- (Recommended) [Synkronus Quickstart](../getting-started/synkronus-quickstart.md) for a test server

---

## What is a custom_app?

A `custom_app` is a zipped archive with two folders:

```
coffee_tracker-v1.0.0.zip
├── app/                    # HTML + JavaScript for the UI
│   ├── index.html
│   └── style.css
└── forms/                  # Questionnaire specifications
    └── register_coffee/
        ├── schema.json     # Data shape
        └── ui.json         # Form layout
```

---

## Part 1: Create the forms

### The form specification

A form is defined by **two files**:
- **schema.json** — What data is collected (data shape, types, required fields)
- **ui.json** — How the form looks and flows (screens, layout, field order)

### Coffee registration form

We'll collect:
- Photo of the beans
- Bean variety name
- Country of origin
- Roaster name
- Roasting date
- Roast level

**Folder structure:**
```
forms/
└── register_coffee/
    ├── schema.json
    └── ui.json
```

### schema.json

Create `forms/register_coffee/schema.json`:

```json
{
  "type": "object",
  "properties": {
    "photo": {
      "type": "object",
      "format": "photo",
      "title": "Bean photo",
      "description": "Take a picture of the beans in portrait mode"
    },
    "name": {
      "type": "string",
      "title": "Bean variety",
      "description": "Name of the coffee variety"
    },
    "origin": {
      "type": "string",
      "title": "Country of Origin"
    },
    "roaster": {
      "type": "string",
      "title": "Roaster",
      "description": "Who roasted the coffee"
    },
    "roast_date": {
      "type": "string",
      "format": "date-time",
      "title": "Roasting date",
      "description": "Date and time when this batch was roasted"
    },
    "roast_profile": {
      "type": "string",
      "title": "Roast Profile",
      "enum": ["dark", "medium", "medium-light", "light"]
    }
  },
  "required": ["name", "roast_date"]
}
```

### ui.json

Create `forms/register_coffee/ui.json`:

```json
{
  "type": "SwipeLayout",
  "options": {
    "headerTitle": "Register Coffee",
    "headerFields": ["name"]
  },
  "elements": [
    {
      "type": "Label",
      "text": "<h2 style='background: #9C2C07; padding: 16px; border-radius: 8px; margin-bottom: 16px; color: cream'>Mmmm... Coffee...</h2>",
      "options": {
        "html": true
      }
    },
    {
      "type": "Control",
      "scope": "#/properties/photo"
    },
    {
      "type": "Control",
      "scope": "#/properties/name"
    },
    {
      "type": "Control",
      "scope": "#/properties/origin"
    },
    {
      "type": "Control",
      "scope": "#/properties/roaster"
    },
    {
      "type": "Control",
      "scope": "#/properties/roast_profile"
    },
    {
      "type": "Control",
      "scope": "#/properties/roast_date"
    }
  ]
}
```

> **Note:** ODE extends JSONForms with types like `photo`, `gps`, `qr-code`, and more. For details, see [Form Specifications](../reference/form-specifications.md).

---

## Part 2: Create the app

For v1, we'll keep the app simple — just a static HTML page. Imagine you'd welcome users or show instructions here.

**Folder structure:**
```
app/
├── index.html
├── style.css
└── coffee_cup.png
```

### index.html

Create `app/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Coffee Tracker v1.0</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>Coffee Tracker</h1>
    <h2>v1.0</h2>
    <p>A simple app for registering roasted coffee beans.</p>
    <img src="coffee_cup.png" alt="Coffee cup" class="image">
    <p><em>Start by registering a new coffee to begin tracking!</em></p>
  </div>
</body>
</html>
```

### style.css

Create `app/style.css`:

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #6B4423 0%, #9C2C07 100%);
  color: #333;
  margin: 0;
  padding: 16px;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  background: white;
  padding: 32px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-align: center;
}

h1 {
  color: #9C2C07;
  margin: 0 0 16px;
}

h2 {
  color: #666;
  margin: 0 0 24px;
  font-size: 18px;
}

p {
  color: #555;
  line-height: 1.6;
  margin: 12px 0;
}

.image {
  max-width: 200px;
  margin: 24px 0;
}

em {
  color: #9C2C07;
}
```

---

## Part 3: Bundle and upload

### Create the zip archive

Ensure your folder structure is:

```
coffee_tracker-v1.0.0/
├── app/
│   ├── index.html
│   ├── style.css
│   └── coffee_cup.png
└── forms/
    └── register_coffee/
        ├── schema.json
        └── ui.json
```

**On macOS/Linux:**
```bash
zip -r coffee_tracker-v1.0.0.zip app/ forms/
```

**On Windows (PowerShell):**
```powershell
Compress-Archive -Path app/, forms/ -DestinationPath coffee_tracker-v1.0.0.zip
```

### Upload to Synkronus

**Option 1: Web Portal**
1. Log in to Synkronus Portal
2. Go to **App Bundle** page
3. Upload `coffee_tracker-v1.0.0.zip`

**Option 2: CLI**
```bash
./synk app-bundle upload ./coffee_tracker-v1.0.0.zip -a
```

Download the CLI from [ODE releases](https://github.com/OpenDataEnsemble/ode/releases).

---

## Part 4: Test in Formulus

1. Install Formulus on your device
2. Configure the server (point to your Synkronus instance)
3. Log in
4. Go to **Sync** page → **Update App Bundle**
5. Open the **Coffee Tracker** app

You should see your HTML page with the welcome message.

---

## Troubleshooting

**App doesn't appear after sync:**
- Check Synkronus logs: `podman logs synkronus`
- Verify the upload succeeded in the Portal
- Ensure `app/` and `forms/` are at the root of your zip file

**Form validation errors:**
- Check JSON syntax (use an online validator)
- Verify required fields in schema match the form

**Photos not saving:**
- Ensure device has camera permissions
- Check Synkronus attachments directory

---

## Next steps

Congratulations! Your first custom_app is live. Ready to add more power?

**In v2**, we'll add:
- Follow-up form for "shots pulled"
- Dashboard showing registered coffees
- Data injection to link observations
- Formulus API integration

→ [Go to v2: Longitudinal Data](./building-custom-apps-v2.md)

---

## Reference

- **[JSONForms Spec](../reference/form-specifications.md)** — Full form configuration
- **[App Bundle Format](../reference/app-bundle-format.md)** — Technical bundle spec
- **[Synkronus Quickstart](../getting-started/synkronus-quickstart.md)** — Set up a test server
- **[Forum](https://forum.opendataensemble.org)** — Get help from the community

---

**Coffee status:** ☕ Registered. Ready to brew!
