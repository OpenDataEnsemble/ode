/**
 * Formulus API Interface (JavaScript Version)
 * 
 * This file provides type information and documentation for the Formulus API
 * that's available in the WebView context as `window.formulus`.
 * 
 * This file is auto-generated from FormulusInterfaceDefinition.ts
 * Last generated: 2025-05-28T13:03:31.631Z
 * 
 * @example
 * // In your JavaScript file:
 * /// <reference path="./formulus-api.js" />
 * 
 * // Now you'll get autocompletion and type hints in IDEs that support JSDoc
 * window.formulus.getVersion().then(version => {
 *   console.log('Formulus version:', version);
 * });
 */

/** @typedef {import('./types').FormInfo} FormInfo */
/** @typedef {import('./types').FormObservation} FormObservation */
/** @typedef {import('./types').AttachmentData} AttachmentData */

/**
 * Formulus API interface
 * @namespace formulus
 */
const FormulusAPI = {
  /**
   * Get the current version of the Formulus API
   
   * @returns {Promise<string> The API version}
   */
  getVersion: function() {},

  /**
   * Get a list of available forms
   
   * @returns {Promise<FormInfo[]> Array of form information objects}
   */
  getAvailableForms: function() {},

  /**
   * Open Formplayer with the specified form
   * @param {string} formId - The ID of the form to open
   * @param {Object} params - Additional parameters for form initialization
   * @param {Object} savedData - Previously saved form data (for editing)
   * @returns {void}
   */
  openFormplayer: function(formId: string, params: Object, savedData: Object) {},

  /**
   * Get observations for a specific form
   * @param {string} formId - The ID of the form
   * @param {boolean} isDraft - Whether to include draft observations
   * @param {boolean} includeDeleted - Whether to include deleted observations
   * @returns {Promise<FormObservation[]> Array of form observations}
   */
  getObservations: function(formId: string, isDraft: boolean, includeDeleted: boolean) {},

  /**
   * Initialize a new form
   
   * @returns {void}
   */
  initForm: function() {},

  /**
   * Save partial form data
   * @param {string} formId - The ID of the form
   * @param {Object} data - The form data to save
   * @returns {void}
   */
  savePartial: function(formId: string, data: Object) {},

  /**
   * Submit a completed form
   * @param {string} formId - The ID of the form
   * @param {Object} finalData - The final form data to submit
   * @returns {void}
   */
  submitForm: function(formId: string, finalData: Object) {},

  /**
   * Request camera access for a field
   * @param {string} fieldId - The ID of the field
   * @returns {void}
   */
  requestCamera: function(fieldId: string) {},

  /**
   * Request location for a field
   * @param {string} fieldId - The ID of the field
   * @returns {void}
   */
  requestLocation: function(fieldId: string) {},

  /**
   * Request file selection for a field
   * @param {string} fieldId - The ID of the field
   * @returns {void}
   */
  requestFile: function(fieldId: string) {},

  /**
   * Launch an external intent
   * @param {string} fieldId - The ID of the field
   * @param {Object} intentSpec - The intent specification
   * @returns {void}
   */
  launchIntent: function(fieldId: string, intentSpec: Object) {},

  /**
   * Call a subform
   * @param {string} fieldId - The ID of the field
   * @param {string} formId - The ID of the subform
   * @param {Object} options - Additional options for the subform
   * @returns {void}
   */
  callSubform: function(fieldId: string, formId: string, options: Object) {},

  /**
   * Request audio recording for a field
   * @param {string} fieldId - The ID of the field
   * @returns {void}
   */
  requestAudio: function(fieldId: string) {},

  /**
   * Request signature for a field
   * @param {string} fieldId - The ID of the field
   * @returns {void}
   */
  requestSignature: function(fieldId: string) {},

  /**
   * Request biometric authentication
   * @param {string} fieldId - The ID of the field
   * @returns {void}
   */
  requestBiometric: function(fieldId: string) {},

  /**
   * Request the current connectivity status
   
   * @returns {void}
   */
  requestConnectivityStatus: function() {},

  /**
   * Request the current sync status
   
   * @returns {void}
   */
  requestSyncStatus: function() {},

  /**
   * Run a local ML model
   * @param {string} fieldId - The ID of the field
   * @param {string} modelId - The ID of the model to run
   * @param {Object} input - The input data for the model
   * @returns {void}
   */
  runLocalModel: function(fieldId: string, modelId: string, input: Object) {},

};

// Make the API available globally in browser environments
if (typeof window !== 'undefined') {
  window.formulus = FormulusAPI;
}

// Export for CommonJS/Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormulusAPI;
}
