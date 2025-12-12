// Auto-generated from FormulusInterfaceDefinition.ts
// Do not edit directly - this file will be overwritten
// Last generated: 2025-11-23T17:39:01.171Z

(function () {
  // Enhanced API availability detection and recovery
  function getFormulus() {
    // Check multiple locations where the API might exist
    return (
      globalThis.formulus ||
      window.formulus ||
      (typeof formulus !== 'undefined' ? formulus : undefined)
    );
  }

  function isFormulusAvailable() {
    const api = getFormulus();
    return (
      api && typeof api === 'object' && typeof api.getVersion === 'function'
    );
  }

  // Idempotent guard to avoid double-initialization when scripts are reinjected
  if (globalThis.__formulusBridgeInitialized) {
    if (isFormulusAvailable()) {
      console.debug(
        'Formulus bridge already initialized and functional. Skipping duplicate injection.',
      );
      return;
    } else {
      console.warn(
        'Formulus bridge flag is set but API is not functional. Proceeding with re-injection...',
      );
    }
  }

  // If API already exists and is functional, skip injection
  if (isFormulusAvailable()) {
    console.debug(
      'Formulus interface already exists and is functional. Skipping injection.',
    );
    return;
  }

  // If API exists but is not functional, log warning and proceed with re-injection
  if (getFormulus()) {
    console.warn(
      'Formulus interface exists but appears non-functional. Re-injecting...',
    );
  }

  // Helper function to handle callbacks
  function handleCallback(callback, data) {
    try {
      if (typeof callback === 'function') {
        callback(data);
      }
    } catch (e) {
      console.error('Error in callback:', e);
    }
  }

  // Initialize callbacks
  const callbacks = {};

  // Global function to handle responses from React Native
  function handleMessage(event) {
    try {
      let data;
      if (typeof event.data === 'string') {
        data = JSON.parse(event.data);
      } else if (typeof event.data === 'object' && event.data !== null) {
        data = event.data; // Already an object
      } else {
        // console.warn('Global handleMessage: Received message with unexpected data type:', typeof event.data, event.data);
        return; // Or handle error, but for now, just return to avoid breaking others.
      }

      // Handle callbacks
      if (
        data.type === 'callback' &&
        data.callbackId &&
        callbacks[data.callbackId]
      ) {
        handleCallback(callbacks[data.callbackId], data.data);
        delete callbacks[data.callbackId];
      }

      // Handle specific callbacks

      if (
        data.type === 'onFormulusReady' &&
        globalThis.formulusCallbacks?.onFormulusReady
      ) {
        handleCallback(globalThis.formulusCallbacks.onFormulusReady);
      }
    } catch (e) {
      console.error(
        'Global handleMessage: Error processing message:',
        e,
        'Raw event.data:',
        event.data,
      );
    }
  }

  // Set up message listener
  document.addEventListener('message', handleMessage);
  window.addEventListener('message', handleMessage);

  // Initialize the formulus interface
  globalThis.formulus = {
    // getVersion:  => Promise<string>
    getVersion: function () {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('getVersion callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'getVersion callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'getVersion_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'getVersion' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'getVersion',
            messageId,
          }),
        );
      });
    },

    // getAvailableForms:  => Promise<FormInfo[]>
    getAvailableForms: function () {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('getAvailableForms callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'getAvailableForms callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'getAvailableForms_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'getAvailableForms' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'getAvailableForms',
            messageId,
          }),
        );
      });
    },

    // openFormplayer: formType: string, params: Record<string, any>, savedData: Record<string, any> => Promise<FormCompletionResult>
    openFormplayer: function (formType, params, savedData) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('openFormplayer callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'openFormplayer callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'openFormplayer_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'openFormplayer' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'openFormplayer',
            messageId,
            formType: formType,
            params: params,
            savedData: savedData,
          }),
        );
      });
    },

    // getObservations: formType: string, isDraft: boolean, includeDeleted: boolean => Promise<FormObservation[]>
    getObservations: function (formType, isDraft, includeDeleted) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('getObservations callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'getObservations callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'getObservations_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'getObservations' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'getObservations',
            messageId,
            formType: formType,
            isDraft: isDraft,
            includeDeleted: includeDeleted,
          }),
        );
      });
    },

    // submitObservation: formType: string, finalData: Record<string, any> => Promise<string>
    submitObservation: function (formType, finalData) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('submitObservation callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'submitObservation callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'submitObservation_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'submitObservation' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'submitObservation',
            messageId,
            formType: formType,
            finalData: finalData,
          }),
        );
      });
    },

    // updateObservation: observationId: string, formType: string, finalData: Record<string, any> => Promise<string>
    updateObservation: function (observationId, formType, finalData) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('updateObservation callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'updateObservation callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'updateObservation_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'updateObservation' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'updateObservation',
            messageId,
            observationId: observationId,
            formType: formType,
            finalData: finalData,
          }),
        );
      });
    },

    // requestCamera: fieldId: string => Promise<CameraResult>
    requestCamera: function (fieldId) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('requestCamera callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'requestCamera callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'requestCamera_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'requestCamera' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'requestCamera',
            messageId,
            fieldId: fieldId,
          }),
        );
      });
    },

    // requestLocation: fieldId: string => Promise<void>
    requestLocation: function (fieldId) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('requestLocation callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'requestLocation callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'requestLocation_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'requestLocation' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'requestLocation',
            messageId,
            fieldId: fieldId,
          }),
        );
      });
    },

    // requestFile: fieldId: string => Promise<FileResult>
    requestFile: function (fieldId) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('requestFile callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'requestFile callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'requestFile_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'requestFile' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'requestFile',
            messageId,
            fieldId: fieldId,
          }),
        );
      });
    },

    // launchIntent: fieldId: string, intentSpec: Record<string, any> => Promise<void>
    launchIntent: function (fieldId, intentSpec) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('launchIntent callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'launchIntent callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'launchIntent_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'launchIntent' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'launchIntent',
            messageId,
            fieldId: fieldId,
            intentSpec: intentSpec,
          }),
        );
      });
    },

    // callSubform: fieldId: string, formType: string, options: Record<string, any> => Promise<void>
    callSubform: function (fieldId, formType, options) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('callSubform callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'callSubform callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'callSubform_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'callSubform' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'callSubform',
            messageId,
            fieldId: fieldId,
            formType: formType,
            options: options,
          }),
        );
      });
    },

    // requestAudio: fieldId: string => Promise<AudioResult>
    requestAudio: function (fieldId) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('requestAudio callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'requestAudio callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'requestAudio_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'requestAudio' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'requestAudio',
            messageId,
            fieldId: fieldId,
          }),
        );
      });
    },

    // requestSignature: fieldId: string => Promise<SignatureResult>
    requestSignature: function (fieldId) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('requestSignature callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'requestSignature callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'requestSignature_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'requestSignature' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'requestSignature',
            messageId,
            fieldId: fieldId,
          }),
        );
      });
    },

    // requestQrcode: fieldId: string => Promise<QrcodeResult>
    requestQrcode: function (fieldId) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('requestQrcode callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'requestQrcode callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'requestQrcode_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'requestQrcode' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'requestQrcode',
            messageId,
            fieldId: fieldId,
          }),
        );
      });
    },

    // requestBiometric: fieldId: string => Promise<void>
    requestBiometric: function (fieldId) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('requestBiometric callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'requestBiometric callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'requestBiometric_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'requestBiometric' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'requestBiometric',
            messageId,
            fieldId: fieldId,
          }),
        );
      });
    },

    // requestConnectivityStatus:  => Promise<void>
    requestConnectivityStatus: function () {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('requestConnectivityStatus callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'requestConnectivityStatus callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'requestConnectivityStatus_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'requestConnectivityStatus' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'requestConnectivityStatus',
            messageId,
          }),
        );
      });
    },

    // requestSyncStatus:  => Promise<void>
    requestSyncStatus: function () {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('requestSyncStatus callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'requestSyncStatus callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'requestSyncStatus_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'requestSyncStatus' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'requestSyncStatus',
            messageId,
          }),
        );
      });
    },

    // runLocalModel: fieldId: string, modelId: string, input: Record<string, any> => Promise<void>
    runLocalModel: function (fieldId, modelId, input) {
      return new Promise((resolve, reject) => {
        const messageId =
          'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

        // Add response handler for methods that return values

        const callback = event => {
          try {
            let data;
            if (typeof event.data === 'string') {
              data = JSON.parse(event.data);
            } else if (typeof event.data === 'object' && event.data !== null) {
              data = event.data; // Already an object
            } else {
              // console.warn('runLocalModel callback: Received response with unexpected data type:', typeof event.data, event.data);
              window.removeEventListener('message', callback); // Clean up listener
              reject(
                new Error(
                  'runLocalModel callback: Received response with unexpected data type. Raw: ' +
                    String(event.data),
                ),
              );
              return;
            }
            if (
              data.type === 'runLocalModel_response' &&
              data.messageId === messageId
            ) {
              window.removeEventListener('message', callback);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          } catch (e) {
            console.error(
              "'runLocalModel' callback: Error processing response:",
              e,
              'Raw event.data:',
              event.data,
            );
            window.removeEventListener('message', callback); // Ensure listener is removed on error too
            reject(e);
          }
        };
        window.addEventListener('message', callback);

        // Send the message to React Native
        globalThis.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: 'runLocalModel',
            messageId,
            fieldId: fieldId,
            modelId: modelId,
            input: input,
          }),
        );
      });
    },
  };

  // Register the callback handler with the window object
  globalThis.formulusCallbacks = {};

  // Notify that the interface is ready
  console.log('Formulus interface initialized');
  globalThis.__formulusBridgeInitialized = true;

  // Simple API availability check for internal use
  function requestApiReinjection() {
    console.log('Formulus: Requesting re-injection from host...');
    if (globalThis.ReactNativeWebView) {
      globalThis.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'requestApiReinjection',
          timestamp: Date.now(),
        }),
      );
    }
  }

  // Notify React Native that the interface is ready
  if (globalThis.ReactNativeWebView) {
    globalThis.ReactNativeWebView.postMessage(
      JSON.stringify({
        type: 'onFormulusReady',
      }),
    );
  }

  // Add TypeScript type information

  // Make the API available globally in browser environments
  if (typeof window !== 'undefined') {
    window.formulus = globalThis.formulus;
  }
})();
