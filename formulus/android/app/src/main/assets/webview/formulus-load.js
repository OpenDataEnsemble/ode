/**
 * Formulus Load Script
 *
 * This is a standalone script that client code must include to access the Formulus API.
 * It handles complete injection failure and recovery.
 *
 * Usage:
 *   <script src="formulus-load.js"></script>
 *   <script>
 *     const api = await getFormulus();
 *     const version = await api.getVersion();
 *     console.log(version);
 *   </script>
 */

(function () {
  'use strict';

  // Prevent multiple inclusions
  if (window.getFormulus) {
    return;
  }

  /**
   * The ONLY function client code should use to access Formulus API
   * This function is completely self-contained and can recover from any injection failure
   */
  window.getFormulus = function () {
    return new Promise((resolve, reject) => {
      console.log('getFormulus: Starting API load...');

      // Step 1: Check if we already have a working API from injection
      if (checkExistingAPI()) {
        console.log('getFormulus: Found existing working API');
        resolve(getExistingAPI());
        return;
      }

      // Step 2: No API found, initiate recovery
      console.log('getFormulus: No API found, initiating recovery...');
      initiateRecovery();

      function checkExistingAPI() {
        const api = window.formulus || window.globalThis?.formulus;
        return (
          api && typeof api === 'object' && typeof api.getVersion === 'function'
        );
      }

      function getExistingAPI() {
        return window.formulus || window.globalThis?.formulus;
      }

      function initiateRecovery() {
        // Request re-injection from React Native host
        if (window.ReactNativeWebView) {
          console.log('getFormulus: Requesting API re-injection from host...');
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: 'requestApiReinjection',
              timestamp: Date.now(),
              reason: 'api_load_recovery',
            }),
          );
        } else {
          console.warn(
            'getFormulus: ReactNativeWebView not available, cannot request re-injection',
          );
        }

        // Wait for re-injection to complete
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds with 100ms intervals

        const checkForRecovery = () => {
          attempts++;

          console.log(
            `getFormulus: Recovery attempt ${attempts}/${maxAttempts}`,
          );

          // Check if we now have a working API
          if (checkExistingAPI()) {
            console.log('getFormulus: API recovery successful');
            resolve(getExistingAPI());
            return;
          }

          if (attempts >= maxAttempts) {
            const errorMsg =
              'Formulus API load failed: No API available after maximum recovery attempts';
            console.error('getFormulus:', errorMsg);
            reject(new Error(errorMsg));
          } else {
            setTimeout(checkForRecovery, 100);
          }
        };

        // Start checking immediately
        checkForRecovery();
      }
    });
  };

  // Also expose a synchronous check function for quick availability testing
  window.formulusAvailable = function () {
    const api = window.formulus || window.globalThis?.formulus;
    return (
      api && typeof api === 'object' && typeof api.getVersion === 'function'
    );
  };

  console.log('getFormulus: Load script ready');
})();
