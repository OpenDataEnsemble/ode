---
sidebar_position: 7
title: Longitudinal Data & Formulus API (v2)
---

# Longitudinal Data Collection: Coffee Tracker v2

## Overview

In this guide, we extend Coffee Tracker with **longitudinal data** — the ability to follow up on initial registrations with related observations.

You'll learn:
- How to link forms (one-to-many relationships)
- How to use the Formulus API to query and open forms
- How to inject data across linked forms
- How to build dashboards around collected data

**Time to complete:** 60–90 minutes  
**Prerequisites:**
- Completed [v1 guide](./building-custom-apps-v1.md)
- Basic JavaScript knowledge
- Access to Synkronus and Formulus

---

## What is longitudinal data?

**Longitudinal data** means following up on an entity over time:

```
Register Coffee (v1.0)
    ↓
    ├→ Pull Shot (first follow-up)
    ├→ Pull Shot (second follow-up)
    └→ Pull Shot (third follow-up)
```

In ODE terms:
- **One-to-many relationship** between `register_coffee` and `pull_shot` observations
- Follow-ups include a reference to the original (e.g., `bean: "Prainema"`)
- The app queries and displays related data

Some projects instead embed related **child payloads** **inside** the parent observation using **`format: sub-observation`** (a JSON array on one observation). That pattern is documented under [Custom Extensions](./custom-extensions.md#sub-observations-format-sub-observation); this guide focuses on **separate** follow-up observations linked by queries and IDs.

---

## Part 1: Create the follow-up form

### Add pull_shot form

Create a new form for "shots pulled" (espresso shots). Folder structure:

```
forms/
├── register_coffee/
│   ├── schema.json
│   └── ui.json
└── pull_shot/          # NEW
    ├── schema.json
    └── ui.json
```

### pull_shot/schema.json

```json
{
  "type": "object",
  "properties": {
    "bean": {
      "type": "string",
      "title": "Bean name",
      "description": "Which coffee bean is this shot from?"
    },
    "yield": {
      "type": "number",
      "title": "Yield (grams)",
      "description": "Output weight in grams"
    },
    "time": {
      "type": "number",
      "title": "Time (seconds)",
      "description": "How long the shot took"
    },
    "rating": {
      "type": "string",
      "title": "Rating",
      "enum": ["poor", "fair", "good", "excellent"]
    },
    "notes": {
      "type": "string",
      "title": "Notes",
      "description": "Optional tasting notes"
    }
  },
  "required": ["bean", "yield", "time"]
}
```

### pull_shot/ui.json

```json
{
  "type": "SwipeLayout",
  "options": {
    "headerTitle": "Pull Shot",
    "headerFields": ["bean"]
  },
  "elements": [
    {
      "type": "Control",
      "scope": "#/properties/bean",
      "options": {
        "readOnly": true
      }
    },
    {
      "type": "Control",
      "scope": "#/properties/yield"
    },
    {
      "type": "Control",
      "scope": "#/properties/time"
    },
    {
      "type": "Control",
      "scope": "#/properties/rating"
    },
    {
      "type": "Control",
      "scope": "#/properties/notes"
    }
  ]
}
```

**Key detail:** The `bean` field is `readOnly` — we'll inject the value from the app, so users don't enter it manually.

---

## Part 2: Build the app with data access

### New app structure

```
app/
├── index.html
├── index.js
├── details.html
├── details.js
├── style.css
├── formulus-load.js      # Helper to access Formulus API
└── coffee_cup.png
```

### Get the Formulus API helper

Download `formulus-load.js` from [ODE repo](https://github.com/OpenDataEnsemble/ode/blob/dev/formulus/android/app/src/main/assets/formplayer_dist/formulus-load.js) and save it in your `app/` folder.

### index.html — Coffee list

Create `app/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Coffee Tracker v2.0</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>Coffee Tracker</h1>
    <h2>v2.0 — Longitudinal Data</h2>
    
    <table id="beans-table" class="beans-list">
      <thead>
        <tr>
          <th>Bean</th>
          <th>Country</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    </table>
    <p id="loading">Loading registered coffees...</p>
  </div>
  
  <script src="formulus-load.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

### index.js — Query and display coffees

Create `app/index.js`:

```javascript
/**
 * Display registered coffees in a table
 * @param {Array} beans - Array of coffee observations
 */
async function updateBeans(beans) {
  const beansTable = document.getElementById('beans-table').querySelector('tbody');
  const loading = document.getElementById('loading');
  
  loading.style.display = 'none';
  
  if (beans.length === 0) {
    beansTable.innerHTML = '<tr><td colspan="3">No coffees registered yet.</td></tr>';
    return;
  }
  
  beans.forEach(bean => {
    const data = bean.data || {};
    beansTable.innerHTML += `
      <tr>
        <td><strong>${data.name || 'Unknown'}</strong></td>
        <td>${data.origin || '—'}</td>
        <td>
          <button onclick="goToDetails('${data.name}')">Details</button>
        </td>
      </tr>
    `;
  });
}

/**
 * Navigate to details page
 */
function goToDetails(beanName) {
  window.location.href = `details.html?bean=${encodeURIComponent(beanName)}`;
}

/**
 * Initialize: fetch coffees and display
 */
async function init() {
  try {
    const api = await getFormulus();
    const observations = await api.getObservations('register_coffee');
    updateBeans(observations);
  } catch (err) {
    console.error('Error loading coffees:', err);
    document.getElementById('loading').textContent = 'Error loading coffees. See console.';
  }
}

// Start when page loads
document.addEventListener('DOMContentLoaded', init);
```

### details.html — Coffee details + shots

Create `app/details.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Coffee Details - Coffee Tracker v2</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <button onclick="history.back()" class="back-btn">← Back</button>
    
    <div id="coffee-details" class="details">
      <!-- Coffee details will be inserted here -->
    </div>
    
    <div id="shots">
      <h3>Shots Pulled</h3>
      <button onclick="addShot()" class="btn-primary">+ Pull Shot</button>
      <table id="shots-table" class="shots-list">
        <thead>
          <tr>
            <th>Yield</th>
            <th>Time</th>
            <th>Rating</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>
  </div>
  
  <script src="formulus-load.js"></script>
  <script src="details.js"></script>
</body>
</html>
```

### details.js — Display linked data

Create `app/details.js`:

```javascript
/**
 * Get query parameter from URL
 */
function getQueryParam(name) {
  const url = new URL(window.location);
  return url.searchParams.get(name);
}

/**
 * Display coffee details
 */
async function displayCoffee(beanName) {
  try {
    const api = await getFormulus();
    
    // Fetch all registered coffees
    const coffees = await api.getObservations('register_coffee');
    const match = coffees.find(obs => (obs.data || {}).name === beanName);
    
    if (!match) {
      document.getElementById('coffee-details').innerHTML = '<p>Coffee not found.</p>';
      return;
    }
    
    const data = match.data || {};
    const detailsDiv = document.getElementById('coffee-details');
    
    detailsDiv.innerHTML = `
      <h2>${data.name || 'Unknown'}</h2>
      <dl>
        <dt>Origin</dt>
        <dd>${data.origin || '—'}</dd>
        <dt>Roaster</dt>
        <dd>${data.roaster || '—'}</dd>
        <dt>Roast Level</dt>
        <dd>${data.roast_profile || '—'}</dd>
        <dt>Roasted</dt>
        <dd>${data.roast_date ? new Date(data.roast_date).toLocaleDateString() : '—'}</dd>
      </dl>
    `;
    
    // Fetch and display shots pulled for this coffee
    displayShots(api, beanName);
    
    // Store bean name for adding shots
    window.currentBeanName = beanName;
    
  } catch (err) {
    console.error('Error loading coffee details:', err);
  }
}

/**
 * Display shots pulled for this coffee
 */
async function displayShots(api, beanName) {
  const shots = await api.getObservations('pull_shot');
  const relatedShots = shots.filter(obs => (obs.data || {}).bean === beanName);
  
  const table = document.getElementById('shots-table').querySelector('tbody');
  
  if (relatedShots.length === 0) {
    table.innerHTML = '<tr><td colspan="3">No shots pulled yet.</td></tr>';
    return;
  }
  
  relatedShots.forEach(shot => {
    const data = shot.data || {};
    table.innerHTML += `
      <tr>
        <td>${data.yield || '—'} g</td>
        <td>${data.time || '—'} s</td>
        <td>${data.rating || '—'}</td>
      </tr>
    `;
  });
}

/**
 * Open form to pull a new shot (with data injection)
 */
async function addShot() {
  const beanName = window.currentBeanName;
  if (!beanName) {
    alert('Please select a coffee first.');
    return;
  }
  
  try {
    const api = await getFormulus();
    
    // Open pull_shot form and inject the bean name
    await api.openFormplayer(
      'pull_shot',
      { bean: beanName },  // Injected values
      {}                   // Additional options
    );
    
    // Refresh the page after user closes the form
    location.reload();
    
  } catch (err) {
    console.error('Error opening form:', err);
    alert('Failed to open form. See console.');
  }
}

/**
 * Initialize: get bean name from URL and load details
 */
document.addEventListener('DOMContentLoaded', () => {
  const beanName = getQueryParam('bean');
  if (beanName) {
    displayCoffee(decodeURIComponent(beanName));
  }
});
```

### Updated style.css

Update `app/style.css`:

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #6B4423 0%, #9C2C07 100%);
  color: #333;
  margin: 0;
  padding: 16px;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  padding: 32px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

h1 {
  color: #9C2C07;
  margin: 0 0 8px;
}

h2 {
  color: #333;
  margin: 0 0 24px;
  font-size: 24px;
}

h3 {
  color: #9C2C07;
  margin-top: 32px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

th {
  background: #f5f5f5;
  font-weight: bold;
  color: #9C2C07;
}

button {
  background: #9C2C07;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

button:hover {
  background: #7a2306;
}

.btn-primary {
  margin: 16px 0;
  padding: 12px 24px;
  font-size: 16px;
}

.back-btn {
  margin-bottom: 16px;
  background: #666;
  padding: 8px 12px;
}

.back-btn:hover {
  background: #444;
}

dl {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 12px;
  margin: 16px 0;
}

dt {
  font-weight: bold;
  color: #9C2C07;
}

dd {
  margin: 0;
  color: #555;
}

#loading {
  text-align: center;
  color: #666;
  padding: 32px;
}
```

---

## Part 3: Bundle and upload

Same as v1, but now with more files:

```bash
zip -r coffee_tracker-v2.0.0.zip app/ forms/
```

Upload to Synkronus:
```bash
./synk app-bundle upload ./coffee_tracker-v2.0.0.zip -a
```

---

## Part 4: Test in Formulus

1. Sync the new app in Formulus
2. Open Coffee Tracker
3. Register a few coffees
4. Click "Details" to see the details page
5. Click "+ Pull Shot" to open the follow-up form
   - Notice the bean name is pre-filled
6. Complete multiple shots for the same coffee
7. Return to details — see all related shots listed

---

## How it works: Data injection

Prefer `defaultData` (keys must match schema root properties):

```javascript
await api.openFormplayer(
  'pull_shot',
  { defaultData: { bean: beanName } },
  {}
)
```

Legacy flat keys on the params object (other than reserved bridge keys) are still accepted when `defaultData` is omitted.

The Formulus API:
1. Opens the `pull_shot` form
2. Prefills matching schema fields from `defaultData`
3. User fills in the rest (yield, time, rating)
4. When submitted, the observation includes the injected value

**Important — visibility vs injection:** Formplayer **clears** a field when its Control is hidden by a `SHOW`/`HIDE` rule. Injected stamps must live in the **schema** (and `defaultData`) and must **not** be bound to a Control that starts hidden. To show the value read-only, use SwipeLayout `headerFields` or a separate computed / `lbl_*` display field—not a hidden Control on the real property. See [Form design — Conditional Logic](./form-design.md#conditional-logic-in-ode-forms).

---

## API reference

### getObservations(formName)

```javascript
const observations = await api.getObservations('register_coffee');
// Returns array of observation objects: [{ id, data, ... }, ...]
```

### openFormplayer(formName, injection, options)

```javascript
await api.openFormplayer(
  'pull_shot',
  { bean: 'Prainema', roaster: 'Local' },
  { readOnly: ['roaster'] }  // Optional: make fields read-only
);
```

---

## Troubleshooting

**API not available:**
- Ensure `formulus-load.js` is included
- Check browser console for errors

**Data not injecting:**
- Verify field name matches schema
- Check `readOnly` in ui.json matches intended read-only fields

**Shots not appearing:**
- Verify `bean` field value matches exactly (case-sensitive)
- Check Synkronus logs for form submission errors

---

## Next steps

You've built a complete longitudinal data collection app! Next:

1. **Add dashboards** — Visualize shot results with charts
2. **Use a framework** — Upgrade from vanilla JS to React/SolidJS
3. **Set up CI/CD** — Auto-deploy on code changes
4. **Scale it** — Add more forms, more data relationships

---

## Reference

- **[Formulus API Docs](../reference/formulus.md)** — Full API reference
- **[JSONForms Spec](../reference/form-specifications.md)** — Form details
- **[App Bundle Format](../reference/app-bundle-format.md)** — Bundle structure
- **[Forum](https://forum.opendataensemble.org)** — Get help

---

**Congratulations!** You've mastered longitudinal data. Time to pour that espresso! ☕
