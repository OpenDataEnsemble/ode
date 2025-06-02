// Auto-generated from FormulusInterfaceDefinition.ts
// Do not edit directly - this file will be overwritten
// Last generated: 2025-06-02T14:02:12.662Z

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
        // getVersion:  => Promise<string>
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

        // getAvailableForms:  => Promise<FormInfo[]>
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

        // openFormplayer: formId: string, params: Record<string, any>, savedData: Record<string, any> => Promise<void>
        openFormplayer: function(formId, params, savedData) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'openFormplayer_response' && data.messageId === messageId) {
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
            type: 'openFormplayer',
            messageId,
                        formId: formId,
            params: params,
            savedData: savedData
          }));
          
          });
        },

        // getObservations: formId: string, isDraft: boolean, includeDeleted: boolean => Promise<FormObservation[]>
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

        // initForm:  => Promise<void>
        initForm: function() {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'initForm_response' && data.messageId === messageId) {
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
            type: 'initForm',
            messageId,
            
          }));
          
          });
        },

        // savePartial: formId: string, data: Record<string, any> => Promise<void>
        savePartial: function(formId, data) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'savePartial_response' && data.messageId === messageId) {
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
            type: 'savePartial',
            messageId,
                        formId: formId,
            data: data
          }));
          
          });
        },

        // submitForm: formId: string, finalData: Record<string, any> => Promise<void>
        submitForm: function(formId, finalData) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'submitForm_response' && data.messageId === messageId) {
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
            type: 'submitForm',
            messageId,
                        formId: formId,
            finalData: finalData
          }));
          
          });
        },

        // requestCamera: fieldId: string => Promise<void>
        requestCamera: function(fieldId) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'requestCamera_response' && data.messageId === messageId) {
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
            type: 'requestCamera',
            messageId,
                        fieldId: fieldId
          }));
          
          });
        },

        // requestLocation: fieldId: string => Promise<void>
        requestLocation: function(fieldId) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'requestLocation_response' && data.messageId === messageId) {
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
            type: 'requestLocation',
            messageId,
                        fieldId: fieldId
          }));
          
          });
        },

        // requestFile: fieldId: string => Promise<void>
        requestFile: function(fieldId) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'requestFile_response' && data.messageId === messageId) {
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
            type: 'requestFile',
            messageId,
                        fieldId: fieldId
          }));
          
          });
        },

        // launchIntent: fieldId: string, intentSpec: Record<string, any> => Promise<void>
        launchIntent: function(fieldId, intentSpec) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'launchIntent_response' && data.messageId === messageId) {
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
            type: 'launchIntent',
            messageId,
                        fieldId: fieldId,
            intentSpec: intentSpec
          }));
          
          });
        },

        // callSubform: fieldId: string, formId: string, options: Record<string, any> => Promise<void>
        callSubform: function(fieldId, formId, options) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'callSubform_response' && data.messageId === messageId) {
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
            type: 'callSubform',
            messageId,
                        fieldId: fieldId,
            formId: formId,
            options: options
          }));
          
          });
        },

        // requestAudio: fieldId: string => Promise<void>
        requestAudio: function(fieldId) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'requestAudio_response' && data.messageId === messageId) {
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
            type: 'requestAudio',
            messageId,
                        fieldId: fieldId
          }));
          
          });
        },

        // requestSignature: fieldId: string => Promise<void>
        requestSignature: function(fieldId) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'requestSignature_response' && data.messageId === messageId) {
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
            type: 'requestSignature',
            messageId,
                        fieldId: fieldId
          }));
          
          });
        },

        // requestBiometric: fieldId: string => Promise<void>
        requestBiometric: function(fieldId) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'requestBiometric_response' && data.messageId === messageId) {
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
            type: 'requestBiometric',
            messageId,
                        fieldId: fieldId
          }));
          
          });
        },

        // requestConnectivityStatus:  => Promise<void>
        requestConnectivityStatus: function() {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'requestConnectivityStatus_response' && data.messageId === messageId) {
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
            type: 'requestConnectivityStatus',
            messageId,
            
          }));
          
          });
        },

        // requestSyncStatus:  => Promise<void>
        requestSyncStatus: function() {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'requestSyncStatus_response' && data.messageId === messageId) {
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
            type: 'requestSyncStatus',
            messageId,
            
          }));
          
          });
        },

        // runLocalModel: fieldId: string, modelId: string, input: Record<string, any> => Promise<void>
        runLocalModel: function(fieldId, modelId, input) {
          return new Promise((resolve, reject) => {
          const messageId = 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
          
          // Add response handler for methods that return values
          
          const callback = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'runLocalModel_response' && data.messageId === messageId) {
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
            type: 'runLocalModel',
            messageId,
                        fieldId: fieldId,
            modelId: modelId,
            input: input
          }));
          
          });
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
  
  // Add TypeScript type information
  
  
  // Make the API available globally in browser environments
  if (typeof window !== 'undefined') {
    window.formulus = globalThis.formulus;
  }
  
  // Export for CommonJS/Node.js environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalThis.formulus;
  }
})();
