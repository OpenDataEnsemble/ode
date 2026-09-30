---
sidebar_position: 3
---

# Custom Applications

Custom applications are web-based interfaces that run within the Formulus mobile app, providing specialized workflows and user experiences.

## Overview

Custom applications allow you to:

- Create custom navigation and user interfaces
- Integrate with the ODE form system
- Access observation data through the Formulus JavaScript interface
- Build specialized workflows for specific use cases

## How Custom Applications Work

Custom applications are defined in app bundles, which include:

- HTML, CSS, and JavaScript files
- Form specifications
- Custom renderers
- Configuration files

The app bundle is uploaded to the Synkronus server and downloaded by mobile devices during synchronization. When a user opens a custom application, it runs in a WebView within the Formulus app.

## Formulus JavaScript Interface

Custom applications interact with Formulus through a JavaScript interface:

```javascript
// Create a new observation
window.formulus.addObservation(formType, initializationData);

// Edit an existing observation
window.formulus.editObservation(formType, observationId);

// Delete an observation
window.formulus.deleteObservation(formType, observationId);
```

Once the bridge is ready (`const api = await getFormulus()`), `api.getProfileId()` identifies the active host profile for this WebView and `api.getLocalStorageRef()` provides synchronous profile-scoped `getItem`, `setItem`, `removeItem`, and `clear` methods. Prefer this to raw `localStorage` for custom-app state. The host remounts the WebView on an in-app **Profiles** switch; shared `file://` raw storage is not isolated from other profiles or third-party scripts. See [profile-aware browser storage](/docs/guides/custom-applications#profile-aware-browser-storage) for the API and security caveats.

## Creating a Custom Application

Custom applications are web-based interfaces that run within the Formulus mobile app. They integrate with ODE through the Formulus JavaScript interface.

### Basic Structure

A custom application consists of:

1. **HTML file**: Main entry point (typically `index.html`)
2. **JavaScript**: Application logic using the Formulus API
3. **CSS**: Styling for the application
4. **Manifest**: Bundle metadata

### Getting Started

1. **Include Formulus Load Script**:

```html
<script src="formulus-load.js"></script>
```

2. **Initialize the API**:

```javascript
async function init() {
  const api = await getFormulus();
  // Use the API
}
```

3. **Use Formulus Methods**:

```javascript
// Create observation
await api.addObservation('form-type', {});

// Edit observation
await api.editObservation('form-type', 'observation-id');
```

### Packaging

Package your application as a ZIP file with:
- `index.html` (or your entry point)
- `manifest.json`
- All assets (CSS, JS, images)

### Deployment

Upload the bundle to your Synkronus server:

```bash
synk app-bundle upload bundle.zip --activate
```

See the [Custom Applications guide](/guides/custom-applications) for detailed instructions on building and deploying custom applications.

## Use Cases

Custom applications are suitable for:

- Specialized data collection workflows
- Custom user interfaces that match organizational branding
- Integration with external systems
- Complex navigation requirements

## Testing locally with ODE Desktop

[Install ODE Desktop](/docs/getting-started/installation/installing-ode-desktop) and use [developer mode](/docs/guides/ode-desktop-developer-mode) to load a local build (folder with `index.html`) in the Workbench **Custom app** page against a profile's observations, then refresh after each build.

See also [Custom app (Workbench)](/docs/using/ode-desktop/workbench-custom-app) and the [ODE Desktop user guide](/docs/using/ode-desktop/).

## Next Steps

- Read the [Custom Applications guide](/guides/custom-apps/overview) for detailed information
- Learn about [app bundle structure](/guides/custom-apps/app-bundle-structure)
- Explore [custom renderers](/guides/custom-apps/custom-renderers)

