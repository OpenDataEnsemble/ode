/**
 * Formulus API Interface (JavaScript Version)
 * 
 * This file provides type information and documentation for the Formulus API
 * that's available in the WebView context as `globalThis.formulus`.
 * 
 * This file is auto-generated from FormulusInterfaceDefinition.ts
 * Last generated: 2025-06-08T11:01:00.321Z
 * 
 * @example
 * // In your JavaScript file:
 * /// <reference path="./formulus-api.js" />
 * 
 * // Now you'll get autocompletion and type hints in IDEs that support JSDoc
 * globalThis.formulus.getVersion().then(version => {
 *   console.log('Formulus version:', version);
 * });
 */

// Type definitions for Formulus API

/** @typedef {Object} FormInfo */
/** @typedef {Object} FormObservation */
/** @typedef {Object} AttachmentData */

/**
 * Formulus API interface
 * @namespace formulus
 */
const FormulusAPI = {
  /**
 * Get the current version of the Formulus API
 * /
 * @returns {Promise<string>} The API version
 */
  getVersion: function() {},

  /**
 * Get a list of available forms
 * /
 * @returns {Promise<FormInfo[]>} Array of form information objects
 */
  getAvailableForms: function() {},

  /**
 * Open Formplayer with the specified form
 * /
 * @param {string} formId - The ID of the form to open
 * @param {Object} params - Additional parameters for form initialization
 * @param {Object} savedData - Previously saved form data (for editing)
 * @returns {Promise<void>} 
 */
  openFormplayer: function(formId, params, savedData) {},

  /**
 * Get observations for a specific form
 * /
 * @param {string} formId - The ID of the form
 * @returns {Promise<FormObservation[]>} Array of form observations
 */
  getObservations: function(formId, isDraft, includeDeleted) {},

  /**
 * Initialize a new form
 * /
 * @returns {Promise<void>} 
 */
  initForm: function() {},

  /**
 * Save partial form data
 * /
 * @param {string} formId - The ID of the form
 * @param {Object} data - The form data to save
 * @returns {Promise<void>} 
 */
  savePartial: function(formId, data) {},

  /**
 * Submit a completed form
 * /
 * @param {string} formId - The ID of the form
 * @param {Object} finalData - The final form data to submit
 * @returns {Promise<void>} 
 */
  submitForm: function(formId, finalData) {},

  /**
 * Request camera access for a field
 * /
 * @param {string} fieldId - The ID of the field
 * @returns {Promise<void>} 
 */
  requestCamera: function(fieldId) {},

  /**
 * Request location for a field
 * /
 * @param {string} fieldId - The ID of the field
 * @returns {Promise<void>} 
 */
  requestLocation: function(fieldId) {},

  /**
 * Request file selection for a field
 * /
 * @param {string} fieldId - The ID of the field
 * @returns {Promise<void>} 
 */
  requestFile: function(fieldId) {},

  /**
 * Launch an external intent
 * /
 * @param {string} fieldId - The ID of the field
 * @param {Object} intentSpec - The intent specification
 * @returns {Promise<void>} 
 */
  launchIntent: function(fieldId, intentSpec) {},

  /**
 * Call a subform
 * /
 * @param {string} fieldId - The ID of the field
 * @param {string} formId - The ID of the subform
 * @param {Object} options - Additional options for the subform
 * @returns {Promise<void>} 
 */
  callSubform: function(fieldId, formId, options) {},

  /**
 * Request audio recording for a field
 * /
 * @param {string} fieldId - The ID of the field
 * @returns {Promise<void>} 
 */
  requestAudio: function(fieldId) {},

  /**
 * Request signature for a field
 * /
 * @param {string} fieldId - The ID of the field
 * @returns {Promise<void>} 
 */
  requestSignature: function(fieldId) {},

  /**
 * Request biometric authentication
 * /
 * @param {string} fieldId - The ID of the field
 * @returns {Promise<void>} 
 */
  requestBiometric: function(fieldId) {},

  /**
 * Request the current connectivity status
 * /
 * @returns {Promise<void>} 
 */
  requestConnectivityStatus: function() {},

  /**
 * Request the current sync status
 * /
 * @returns {Promise<void>} 
 */
  requestSyncStatus: function() {},

  /**
 * Run a local ML model
 * /
 * @param {string} fieldId - The ID of the field
 * @param {string} modelId - The ID of the model to run
 * @param {Object} input - The input data for the model
 * @returns {Promise<void>} 
 */
  runLocalModel: function(fieldId, modelId, input) {},

};

// Make the API available globally in browser environments
if (typeof window !== 'undefined') {
  window.formulus = FormulusAPI;
}

// Export for CommonJS/Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormulusAPI;
}
