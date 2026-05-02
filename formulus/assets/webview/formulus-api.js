/**
 * Formulus API Interface (JavaScript Version)
 *
 * This file provides type information and documentation for the Formulus API
 * that's available in the WebView context as `globalThis.formulus`.
 *
 * This file is auto-generated from FormulusInterfaceDefinition.ts
 * Last generated: 2026-05-02T16:43:39.701Z
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
  getVersion: function () {},

  /**
   * Get a list of available forms
   * /
   * @returns {Promise<FormInfo[]>} Array of form information objects
   */
  getAvailableForms: function () {},

  /**
   * Open Formplayer with the specified form
   * /
   * @param {string} formType - The identifier of the formtype to open
   * @param {Object} params - Additional parameters for form initialization
   * @param {Object} savedData - Previously saved form data (for editing)
   * @returns {Promise<FormCompletionResult>} Promise that resolves when the form is completed/closed with result details
   */
  openFormplayer: function (formType, params, savedData, options) {},

  /**
   * Get observations for a specific form
   * /
   * @param {string} formType - The identifier of the formtype
   * @returns {Promise<FormObservation[]>} Array of form observations
   */
  getObservations: function (formType, isDraft, includeDeleted) {},

  /**
   * Get observations with optional WHERE clause filtering (for dynamic choice lists).
   * Supports format: data.field = 'value' AND data.other = 'value'
   * Age filtering via age_from_dob(data.dob) is handled client-side in formplayer.
   * /
   * @returns {Promise<FormObservation[]>} Array of filtered observations
   */
  getObservationsByQuery: function (options) {},

  /**
   * Submit a completed form
   * /
   * @param {string} formType - The identifier of the formtype
   * @param {Object} finalData - The final form data to submit
   * @returns {Promise<string>} The observationId of the submitted form
   */
  submitObservation: function (formType, finalData) {},

  /**
   * Update an existing form
   * /
   * @param {string} observationId - The identifier of the observation
   * @param {string} formType - The identifier of the formtype
   * @param {Object} finalData - The final form data to update
   * @returns {Promise<string>} The observationId of the updated form
   */
  updateObservation: function (observationId, formType, finalData) {},

  /**
   * Request camera access for a field
   * /
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<CameraResult>} Promise that resolves with camera result or rejects on error/cancellation
   */
  requestCamera: function (fieldId) {},

  /**
   * Request location for a field
   * /
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<void>}
   */
  requestLocation: function (fieldId) {},

  /**
   * Request file selection for a field
   * /
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<FileResult>} Promise that resolves with file result or rejects on error/cancellation
   */
  requestFile: function (fieldId) {},

  /**
   * Launch an external intent
   * /
   * @param {string} fieldId - The ID of the field
   * @param {Object} intentSpec - The intent specification
   * @returns {Promise<void>}
   */
  launchIntent: function (fieldId, intentSpec) {},

  /**
   * Call a subform
   * /
   * @param {string} fieldId - The ID of the field
   * @param {string} formType - The ID of the subform
   * @param {Object} options - Additional options for the subform
   * @returns {Promise<void>}
   */
  callSubform: function (fieldId, formType, options) {},

  /**
   * Request audio recording for a field
   * /
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<AudioResult>} Promise that resolves with audio result or rejects on error/cancellation
   */
  requestAudio: function (fieldId) {},

  /**
   * Request QR code scanning for a field
   * /
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<QrcodeResult>} Promise that resolves with QR code result or rejects on error/cancellation
   */
  requestQrcode: function (fieldId) {},

  /**
   * Request biometric authentication
   * /
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<void>}
   */
  requestBiometric: function (fieldId) {},

  /**
   * Request the current connectivity status
   * /
   * @returns {Promise<void>}
   */
  requestConnectivityStatus: function () {},

  /**
   * Request the current sync status
   * /
   * @returns {Promise<void>}
   */
  requestSyncStatus: function () {},

  /**
   * Run a local ML model
   * /
   * @param {string} fieldId - The ID of the field
   * @param {string} modelId - The ID of the model to run
   * @param {Object} input - The input data for the model
   * @returns {Promise<void>}
   */
  runLocalModel: function (fieldId, modelId, input) {},

  /**
   * Get information about the currently authenticated user.
   * When no one is logged in, resolves with `{ username: '' }` (does not reject).
   * /
   * @returns {Promise<{username: string, displayName?: string, role?: 'read-only' | 'read-write' | 'admin'}
   */
  getCurrentUser: function () {},

  /**
   * Get the current theme mode (System / Light / Dark) so custom apps can match the host app.
   * /
   * @returns {Promise<'light' | 'dark' | 'system'>} Current theme mode; 'system' means follow device preference.
   */
  getThemeMode: function () {},

  /**
   * Resolve an attachment to a WebView-loadable URL (`file://`, `http(s):`, or host-specific).
   * **String `fileName`:** basename only (e.g. `photo.filename`). Lookup order, first hit wins:
   * 1. `attachments/draft/<name>`   — unsaved capture (formplayer preview)
   * 2. `attachments/synced/<name>`  — canonical committed / downloaded copy
   * 3. `attachments/pending/<name>` — queued for upload (fallback only)
   * Legacy locations (`attachments/<name>` and `attachments/pending_upload/<name>`) are also checked.
   * Path segments and ".." are rejected.
   * **`AttachmentDisplayDescriptor`:** `{ filename }` basename only (same lookup as a string argument).
   * /
   * @returns {Promise<string | null>} Display URL, or `null` if none
   */
  getAttachmentUri: function (fileName) {},

  /**
   * Base `file://` URL for the canonical attachments directory (trailing slash).
   * Returns the `synced/` subfolder — only committed/downloaded files are
   * iterable from here. Drafts and the upload queue are excluded by design so
   * custom apps can safely list this directory.
   * **Breaking change (v2 layout):** this used to return the `attachments/`
   * parent directory, which mixed committed files with `draft/` and
   * `pending_upload/` subfolders. Custom apps that iterate this URL will now
   * see only fully-committed attachments.
   * /
   * @returns {Promise<string>} e.g. `file:///.../attachments/synced/`
   */
  getAttachmentsUri: function () {},

  /**
   * Base `file://` URL for the custom app bundle root (`DocumentDirectory/app/`, trailing slash).
   * /
   * @returns {Promise<string>} App directory URL for extensions, question_types, etc.
   */
  getCustomAppUri: function () {},

  /**
   * Primary `file://` URL for downloaded form specs (`DocumentDirectory/forms/`, trailing slash).
   * Some bundles also use files under the custom app `forms/` subdirectory.
   * /
   * @returns {Promise<string>} Forms directory URL
   */
  getFormSpecsUri: function () {},
};

// Make the API available globally in browser environments
if (typeof window !== 'undefined') {
  window.formulus = FormulusAPI;
}

// Export for CommonJS/Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormulusAPI;
}
