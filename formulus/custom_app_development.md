# Formulus Custom Web App Integration Guide

Welcome to developing custom web apps for the Formulus platform! This guide explains how your web app can seamlessly communicate with the Formulus host application using a modern, Promise-based JavaScript API.

## I. How Formulus-Web App Communication Works (High-Level Overview)

Formulus provides a powerful yet easy-to-use JavaScript API, `globalThis.formulus`, that your web app can use to interact with the native capabilities of the Formulus application (e.g., accessing forms, device hardware, saving data).

Here's a breakdown of the key components involved:

1.  **The API Contract (`FormulusInterfaceDefinition.ts`):**

    - **Location (Formulus Host Codebase):** `src/webview/FormulusInterfaceDefinition.ts`
    - **Purpose:** This TypeScript file is the single source of truth that defines all available functions, their parameters, and what they return. It dictates the "shape" of the `globalThis.formulus` API.

2.  **The JSDoc Interface for Web Apps (`formulus-api.js`):**

    - **Location (Provided to Web App Developers):** `assets/webview/formulus-api.js`
    - **Purpose:** This file is **auto-generated** from `FormulusInterfaceDefinition.ts`. It provides JSDoc annotations that enable autocompletion and type-hinting in your IDE when you're writing JavaScript for your custom web app. It _describes_ the API but doesn't contain the actual communication logic.
    - **How it helps you:** By referencing this file in your project, you get a much better development experience.

3.  **The Magic: Injection Script (`FormulusInjectionScript.js`):**

    - **Location (Formulus Host Codebase, Injected into your WebView):** `assets/webview/FormulusInjectionScript.js`
    - **Purpose:** This is the core script that Formulus automatically injects into your web app when it loads in a `CustomAppWebView`. It's also **auto-generated** from `FormulusInterfaceDefinition.ts`.
    - **What it does:**
      - It creates the `globalThis.formulus` object and populates it with actual, working JavaScript functions.
      - When your web app calls a function like `globalThis.formulus.getVersion()`, this script handles all the complex asynchronous messaging with the host and gives you back a Promise you can `await`.

4.  **The Formulus Host (React Native Side):**
    - **Key Files (Formulus Host Codebase):** `src/webview/FormulusWebViewHandler.ts`, `src/webview/FormulusMessageHandlers.ts`
    - **Purpose:** These components within the Formulus application listen for messages sent from your web app and process them.
    - **What it does:**
      - When a message arrives, it determines what action to take.
      - It processes the request (e.g., fetches data from a database).
      - It then sends a response message back to your web app's WebView, which resolves the corresponding Promise.

## II. How to Develop Your Custom Web App

Developing a custom web app that integrates with Formulus is straightforward.

**1. Setting Up Your Development Environment:**

- **Reference `formulus-api.js`:**
  - Copy `formulus-api.js` (from `assets/webview/formulus-api.js`) into your web app's project.
  - In your JavaScript files, add a reference to enable IntelliSense/autocompletion:
    ```javascript
    /// <reference path="path/to/your/formulus-api.js" />
    ```

**2. Ensuring Formulus API is Ready Before Use (Best Practice)**

The `globalThis.formulus` API object is injected asynchronously. To handle this gracefully and avoid race conditions, we recommend using a helper function to get the Formulus API.

- **The `getFormulus()` Helper Function:**
  This function waits for the Formulus API to be fully ready before resolving.

  ```javascript
  // **Recommended:** Add this utility function to your project
  function getFormulus() {
    return new Promise((resolve, reject) => {
      const timeout = 5000; // 5 seconds
      let M_formulusIsReady = false; // Local flag to track readiness

      // Check if Formulus is already available and ready
      if (globalThis.formulus && globalThis.formulus.__HOST_IS_READY__) {
        resolve(globalThis.formulus);
        return;
      }

      // If not immediately ready, wait for the onFormulusReady callback
      const originalOnReady = globalThis.formulusCallbacks?.onFormulusReady;

      globalThis.formulusCallbacks = {
        ...globalThis.formulusCallbacks,
        onFormulusReady: () => {
          M_formulusIsReady = true;
          globalThis.formulus.__HOST_IS_READY__ = true; // Mark as ready globally
          if (typeof originalOnReady === 'function') {
            originalOnReady(); // Call the user's original onFormulusReady
          }
          resolve(globalThis.formulus);
          clearTimeout(timerId); // Clear the timeout
        },
      };

      // Fallback check in case onFormulusReady was already set up and fired
      if (globalThis.formulus && globalThis.formulus.__HOST_IS_READY__) {
        resolve(globalThis.formulus);
        return;
      }

      // Set a timeout
      const timerId = setTimeout(() => {
        if (!M_formulusIsReady) {
          // Restore original onFormulusReady if it existed, before rejecting
          if (globalThis.formulusCallbacks) {
            globalThis.formulusCallbacks.onFormulusReady = originalOnReady;
          }
          reject(
            new Error('Formulus API did not become ready within 5 seconds.'),
          );
        }
      }, timeout);

      // If formulus object itself isn't even there yet (less likely but possible)
      if (!globalThis.formulus) {
        let attemptCount = 0;
        const intervalId = setInterval(() => {
          attemptCount++;
          if (globalThis.formulus) {
            clearInterval(intervalId);
            if (globalThis.formulus.__HOST_IS_READY__) {
              M_formulusIsReady = true;
              resolve(globalThis.formulus);
              clearTimeout(timerId);
            }
            return;
          }
          if (attemptCount * 100 > timeout && !M_formulusIsReady) {
            clearInterval(intervalId);
          }
        }, 100);
      }
    });
  }
  ```

- **Using `getFormulus()`:**
  Always call and `await` this function before trying to use any `formulus` API methods.

  ```javascript
  async function initializeMyApp() {
    try {
      const formulusApi = await getFormulus();
      // Now it's safe to use formulusApi
      const version = await formulusApi.getVersion();
      console.log('Formulus Host Version:', version);
    } catch (error) {
      console.error('Failed to initialize app with Formulus:', error);
    }
  }

  initializeMyApp();
  ```

  **REQUIRED APPROACH: Use `getFormulus()` with formulus-load.js**

  Client code must include the formulus-load.js script and use the getFormulus() function. This is the only supported way to access the Formulus API:

  ```html
  <!-- Include the load script -->
  <script src="formulus-load.js"></script>

  <script>
    async function initializeMyApp() {
      try {
        // This is the way to get the API
        const api = await getFormulus();

        // Now it's safe to use the API
        const version = await api.getVersion();
        console.log('Formulus Host Version:', version);
      } catch (error) {
        console.error('Failed to load Formulus API:', error);
        // Handle graceful degradation here
      }
    }

    initializeMyApp();
  </script>
  ```

**3. Handling Host Readiness and Other Callbacks (`globalThis.formulusCallbacks`)**

The Formulus host can send event-like messages to your web app. You can listen for these by defining functions on the `globalThis.formulusCallbacks` object.

- **`onFormulusReady` (Crucial for Initialization):**

  - **Purpose:** The Formulus host calls your `globalThis.formulusCallbacks.onFormulusReady()` function when the `globalThis.formulus` API is fully injected _and_ the Formulus host itself is ready to handle API requests.
  - **Usage:** The `getFormulus()` function internally uses this callback. You can also define your own `onFormulusReady` for app-level initialization logic, and `getFormulus()` will ensure it's still called.

  ```javascript
  // In your web app's main setup:
  if (!globalThis.formulusCallbacks) {
    globalThis.formulusCallbacks = {};
  }

  globalThis.formulusCallbacks.onFormulusReady = function () {
    console.log('Formulus host is now fully ready!');
  };
  ```

- **Other Callbacks:**
  - **Important:** Check `formulus-api.js` for the exact names and signatures of available callbacks.

**4. Making API Calls**

Once you have the `formulusApi` object from `await getFormulus()`, you can call its methods.

```javascript
async function loadAndDisplayForms() {
  try {
    const formulusApi = await getFormulus(); // Ensures API is ready
    const forms = await formulusApi.getAvailableForms();
    console.log('Available forms:', forms);
  } catch (error) {
    console.error('Error getting available forms:', error);
  }
}
```

**5. Signaling Web App Readiness (If Required by Host)**

Your web app might need to inform Formulus when it's fully loaded. Consult the Formulus host integration details for the exact mechanism expected. A common pattern is to send a specific message:

```javascript
function signalMyAppIsReady() {
  if (
    globalThis.ReactNativeWebView &&
    globalThis.ReactNativeWebView.postMessage
  ) {
    globalThis.ReactNativeWebView.postMessage(
      JSON.stringify({
        type: 'customAppReady', // Or whatever type Formulus expects
      }),
    );
  }
}
```

**6. Debugging**

- Use your browser's developer tools or the WebView debugging tools provided by the Formulus environment.
- `console.log()` statements in your web app's JavaScript will output to the debugging console.
