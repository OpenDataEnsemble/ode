/**
 * FormulusInjectionScript.ts
 * 
 * This module generates the JavaScript injection script for the Formulus interface
 * based on the interface definition. This ensures consistency between the TypeScript
 * interface and the actual JavaScript implementation injected into the WebView.
 */

import { FORMULUS_INTERFACE_VERSION } from './FormulusInterfaceDefinition';

/**
 * Generates the JavaScript code to inject the Formulus interface into a WebView
 * @returns JavaScript code as a string
 */
export function generateFormulusInjectionScript(): string {
  return `
    (function() {
      // Create the formulus interface
      globalThis.formulus = {
        // Basic form operations
        // =====================
        
        // Called by Formplayer to initialize a form
        initForm: function() {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'initForm'
          }));
        },
        
        // Called by Formplayer to save partial form data (on change/autosave)
        savePartial: function(formId, data) {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'savePartial',
            formId: formId,
            data: data
          }));
        },
        
        // Called by Formplayer to submit the completed form
        submitObservation: function(formId, finalData) {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'submitObservation',
            formId: formId,
            finalData: finalData
          }));
        },
        
        // Native feature calls
        // =====================
        
        // Request camera access
        requestCamera: function(fieldId) {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestCamera',
            fieldId: fieldId
          }));
        },
        
        // Request location
        requestLocation: function(fieldId) {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestLocation',
            fieldId: fieldId
          }));
        },
        
        // Request file picker
        requestFile: function(fieldId) {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestFile',
            fieldId: fieldId
          }));
        },
        
        // Launch Android intent
        launchIntent: function(fieldId, intentSpec) {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'launchIntent',
            fieldId: fieldId,
            intentSpec: intentSpec
          }));
        },
        
        // Call a subform
        callSubform: function(fieldId, formId, options) {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'callSubform',
            fieldId: fieldId,
            formId: formId,
            options: options
          }));
        },
        
        // Request audio recording
        requestAudio: function(fieldId) {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestAudio',
            fieldId: fieldId
          }));
        },
        
        // Request signature capture
        requestSignature: function(fieldId) {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestSignature',
            fieldId: fieldId
          }));
        },
        
        // Request biometric authentication
        requestBiometric: function(fieldId) {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestBiometric',
            fieldId: fieldId
          }));
        },
        
        // Request connectivity status
        requestConnectivityStatus: function() {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestConnectivityStatus'
          }));
        },
        
        // Request sync status
        requestSyncStatus: function() {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'requestSyncStatus'
          }));
        },
        
        // Run local ML model
        runLocalModel: function(fieldId, modelId, input) {
          globalThis.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'runLocalModel',
            fieldId: fieldId,
            modelId: modelId,
            input: input
          }));
        },
        
        // Callbacks from React Native to Formplayer
        // ========================================
        
        // Called by React Native to send form initialization data to Formplayer
        receiveFormInit: function(initData) {
          if (typeof globalThis.onFormInit === 'function') {
            globalThis.onFormInit(initData.formId, initData.params, initData.savedData);
          } else {
            console.warn('Formplayer: onFormInit handler not found');
          }
        },
        
        // Called by React Native to confirm partial save completion
        onSavePartialComplete: function(result) {
          if (typeof globalThis.onSavePartialComplete === 'function') {
            globalThis.onSavePartialComplete(result.formId, result.success);
          }
        },
        
        // Called by React Native when attachment data is ready
        onAttachmentReady: function(data) {
          if (typeof globalThis.onAttachmentReady === 'function') {
            globalThis.onAttachmentReady(data);
          } else {
            console.warn('Formplayer: onAttachmentReady handler not found');
          }
        },
        
        // Version information
        getVersion: function() {
          return "${FORMULUS_INTERFACE_VERSION}";
        }
      };
      
      // Notify when the interface is ready
      console.log('formulus interface initialized (version ${FORMULUS_INTERFACE_VERSION})');
      
      // If there's a global event to fire when the interface is ready
      if (typeof globalThis.onFormulusReady === 'function') {
        globalThis.onFormulusReady();
      }
    })();
  `;
}
