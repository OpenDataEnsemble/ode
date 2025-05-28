// Auto-generated from FormulusInterfaceDefinition.ts
// Do not edit directly - this file will be overwritten
// Last generated: 2025-05-28T12:02:22.021Z

(function() {
  if (typeof globalThis.formulus !== 'undefined') {
    console.warn('Formulus interface already exists. Skipping injection.');
    return;
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
      const data = JSON.parse(event.data);
      
      // Handle callbacks
      if (data.type === 'callback' && data.callbackId && callbacks[data.callbackId]) {
        handleCallback(callbacks[data.callbackId], data.data);
        delete callbacks[data.callbackId];
      }
      
      // Handle specific callbacks like onAttachmentReady, etc.
      if (data.type === 'onAttachmentReady' && globalThis.formulusCallbacks?.onAttachmentReady) {
        handleCallback(globalThis.formulusCallbacks.onAttachmentReady, data.data);
      }
      
      if (data.type === 'onSavePartialComplete' && globalThis.formulusCallbacks?.onSavePartialComplete) {
        handleCallback(globalThis.formulusCallbacks.onSavePartialComplete, data.success, data.formId);
      }
      
      if (data.type === 'onFormulusReady' && globalThis.formulusCallbacks?.onFormulusReady) {
        handleCallback(globalThis.formulusCallbacks.onFormulusReady);
      }
    } catch (e) {
      console.error('Error handling message:', e);
    }
  }
  
  // Set up message listener
  document.addEventListener('message', handleMessage);
  window.addEventListener('message', handleMessage);

  // Initialize the formulus interface
  globalThis.formulus = {
        // getVersion:  => string
        getVersion: function() {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'getVersion_response' && data.messageId === messageId) {
                window.removeEventListener('message', callback);
                if (data.error) {
                  reject(new Error(data.error));
                } else {
                  resolve(data.result);
                }
              }
            } catch (e) {
              console.error('Error handling response:', e);
              reject(e);
            }
          };
          window.addEventListener('message', callback);
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'getVersion',
            messageId,
            
          }));
          
          });
        },

        // getAvailableForms:  => FormInfo[]
        getAvailableForms: function() {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'getAvailableForms_response' && data.messageId === messageId) {
                window.removeEventListener('message', callback);
                if (data.error) {
                  reject(new Error(data.error));
                } else {
                  resolve(data.result);
                }
              }
            } catch (e) {
              console.error('Error handling response:', e);
              reject(e);
            }
          };
          window.addEventListener('message', callback);
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'getAvailableForms',
            messageId,
            
          }));
          
          });
        },

        // openFormplayer: formId: string, params: Record<string, any>, savedData: Record<string, any> => void
        openFormplayer: function(formId, params, savedData) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'openFormplayer',
            
                        formId: formId,
            params: params,
            savedData: savedData
          }));
          
          
        },

        // getObservations: formId: string, isDraft: boolean, includeDeleted: boolean => FormObservation[]
        getObservations: function(formId, isDraft, includeDeleted) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'getObservations_response' && data.messageId === messageId) {
                window.removeEventListener('message', callback);
                if (data.error) {
                  reject(new Error(data.error));
                } else {
                  resolve(data.result);
                }
              }
            } catch (e) {
              console.error('Error handling response:', e);
              reject(e);
            }
          };
          window.addEventListener('message', callback);
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'getObservations',
            messageId,
                        formId: formId,
            isDraft: isDraft,
            includeDeleted: includeDeleted
          }));
          
          });
        },

        // initForm:  => void
        initForm: function() {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'initForm',
            
            
          }));
          
          
        },

        // savePartial: formId: string, data: Record<string, any> => void
        savePartial: function(formId, data) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'savePartial',
            
                        formId: formId,
            data: data
          }));
          
          
        },

        // submitForm: formId: string, finalData: Record<string, any> => void
        submitForm: function(formId, finalData) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'submitForm',
            
                        formId: formId,
            finalData: finalData
          }));
          
          
        },

        // requestCamera: fieldId: string => void
        requestCamera: function(fieldId) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestCamera',
            
                        fieldId: fieldId
          }));
          
          
        },

        // requestLocation: fieldId: string => void
        requestLocation: function(fieldId) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestLocation',
            
                        fieldId: fieldId
          }));
          
          
        },

        // requestFile: fieldId: string => void
        requestFile: function(fieldId) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestFile',
            
                        fieldId: fieldId
          }));
          
          
        },

        // launchIntent: fieldId: string, intentSpec: Record<string, any> => void
        launchIntent: function(fieldId, intentSpec) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'launchIntent',
            
                        fieldId: fieldId,
            intentSpec: intentSpec
          }));
          
          
        },

        // callSubform: fieldId: string, formId: string, options: Record<string, any> => void
        callSubform: function(fieldId, formId, options) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'callSubform',
            
                        fieldId: fieldId,
            formId: formId,
            options: options
          }));
          
          
        },

        // requestAudio: fieldId: string => void
        requestAudio: function(fieldId) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestAudio',
            
                        fieldId: fieldId
          }));
          
          
        },

        // requestSignature: fieldId: string => void
        requestSignature: function(fieldId) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestSignature',
            
                        fieldId: fieldId
          }));
          
          
        },

        // requestBiometric: fieldId: string => void
        requestBiometric: function(fieldId) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestBiometric',
            
                        fieldId: fieldId
          }));
          
          
        },

        // requestConnectivityStatus:  => void
        requestConnectivityStatus: function() {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestConnectivityStatus',
            
            
          }));
          
          
        },

        // requestSyncStatus:  => void
        requestSyncStatus: function() {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestSyncStatus',
            
            
          }));
          
          
        },

        // runLocalModel: fieldId: string, modelId: string, input: Record<string, any> => void
        runLocalModel: function(fieldId, modelId, input) {
          
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          
          // Send the message to React Native
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'runLocalModel',
            
                        fieldId: fieldId,
            modelId: modelId,
            input: input
          }));
          
          
        },
  };
  
  // Register the callback handler with the window object
  globalThis.formulusCallbacks = {};
  
  // Notify that the interface is ready
  console.log('Formulus interface initialized');
  
  // Notify React Native that the interface is ready
  if (globalThis.ReactNativeWebView) {
    globalThis.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'onFormulusReady'
    }));
  }
})();