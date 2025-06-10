/**
 * FormulusInterfaceDefinition.ts
 * 
 * This module defines the shared interface between the Formulus React Native app and the Formplayer WebView.
 * It serves as the single source of truth for the interface definition.
 * 
 * NOTE: This file should be manually copied to client projects that need to interact with the Formulus app.
 * TODO: Package this interface into a shared npm package for better maintainability and versioning.
 * 
 * Current Version: 1.0.16
 */

// Type definitions for the interface
export interface FormInitData {
  formType: string;
  params: Record<string, any>;
  savedData: Record<string, any>;
}

export interface AttachmentData {
  fieldId: string;
  type: 'image' | 'location' | 'file' | 'intent' | 'subform' | 'audio' | 'signature' | 'biometric' | 'connectivity' | 'sync' | 'ml_result';
  [key: string]: any; // Additional properties based on type
}

export interface FormInfo {
  formId: string;
  name: string;
  version: string;
  coreFields: string[];
  auxiliaryFields: string[];
}

export interface FormObservation {
  observationId: string;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
  isDraft: boolean;
  deleted: boolean;
  formId: string;
  formVersion: string;
  dataPoints: Record<string, any>;
}

/**
 * Interface for the Formulus app methods that will be injected into the WebViews for custom_app and FormPlayer
 * @namespace formulus
 */
export interface FormulusInterface {
  /**
   * Get the current version of the Formulus API
   * @returns {Promise<string>} The API version
   */
  getVersion(): Promise<string>;

  /**
   * Get a list of available forms
   * @returns {Promise<FormInfo[]>} Array of form information objects
   */
  getAvailableForms(): Promise<FormInfo[]>;

  /**
   * Open Formplayer with the specified form
   * @param {string} formId - The ID of the form to open
   * @param {Object} params - Additional parameters for form initialization
   * @param {Object} savedData - Previously saved form data (for editing)
   * @returns {Promise<void>}
   */
  openFormplayer(formId: string, params: Record<string, any>, savedData: Record<string, any>): Promise<void>;

  /**
   * Get observations for a specific form
   * @param {string} formId - The ID of the form
   * @param {boolean} [isDraft=false] - Whether to include draft observations
   * @param {boolean} [includeDeleted=false] - Whether to include deleted observations
   * @returns {Promise<FormObservation[]>} Array of form observations
   */
  getObservations(formId: string, isDraft?: boolean, includeDeleted?: boolean): Promise<FormObservation[]>;

  /**
   * Initialize a new form
   * @returns {Promise<void>}
   */
  initForm(): Promise<void>;

  /**
   * Save partial form data
   * @param {string} formId - The ID of the form
   * @param {Object} data - The form data to save
   * @returns {Promise<void>}
   */
  savePartial(formId: string, data: Record<string, any>): Promise<void>;

  /**
   * Submit a completed form
   * @param {string} formId - The ID of the form
   * @param {Object} finalData - The final form data to submit
   * @returns {Promise<void>}
   */
  submitForm(formId: string, finalData: Record<string, any>): Promise<void>;

  /**
   * Request camera access for a field
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<void>}
   */
  requestCamera(fieldId: string): Promise<void>;

  /**
   * Request location for a field
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<void>}
   */
  requestLocation(fieldId: string): Promise<void>;

  /**
   * Request file selection for a field
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<void>}
   */
  requestFile(fieldId: string): Promise<void>;

  /**
   * Launch an external intent
   * @param {string} fieldId - The ID of the field
   * @param {Object} intentSpec - The intent specification
   * @returns {Promise<void>}
   */
  launchIntent(fieldId: string, intentSpec: Record<string, any>): Promise<void>;

  /**
   * Call a subform
   * @param {string} fieldId - The ID of the field
   * @param {string} formId - The ID of the subform
   * @param {Object} options - Additional options for the subform
   * @returns {Promise<void>}
   */
  callSubform(fieldId: string, formId: string, options: Record<string, any>): Promise<void>;

  /**
   * Request audio recording for a field
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<void>}
   */
  requestAudio(fieldId: string): Promise<void>;

  /**
   * Request signature for a field
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<void>}
   */
  requestSignature(fieldId: string): Promise<void>;

  /**
   * Request biometric authentication
   * @param {string} fieldId - The ID of the field
   * @returns {Promise<void>}
   */
  requestBiometric(fieldId: string): Promise<void>;

  /**
   * Request the current connectivity status
   * @returns {Promise<void>}
   */
  requestConnectivityStatus(): Promise<void>;

  /**
   * Request the current sync status
   * @returns {Promise<void>}
   */
  requestSyncStatus(): Promise<void>;

  /**
   * Run a local ML model
   * @param {string} fieldId - The ID of the field
   * @param {string} modelId - The ID of the model to run
   * @param {Object} input - The input data for the model
   * @returns {Promise<void>}
   */
  runLocalModel(fieldId: string, modelId: string, input: Record<string, any>): Promise<void>;
}

/**
 * Interface for callback methods that the Formplayer WebView implements
 */
export interface FormulusCallbacks {
  onFormInit?: (formId: string, params: Record<string, any>, savedData: Record<string, any>) => void;
  onAttachmentReady?: (data: AttachmentData) => void;
  onSavePartialComplete?: (formId: string, success: boolean) => void;
  onFormulusReady?: () => void;
}

/**
 * Current version of the interface
 */
export const FORMULUS_INTERFACE_VERSION = "1.0.1";

/**
 * Check if the current interface version is compatible with the required version
 */
export function isCompatibleVersion(requiredVersion: string): boolean {
  // Simple version comparison - can be enhanced for semantic versioning
  return FORMULUS_INTERFACE_VERSION >= requiredVersion;
}

// Extend the global interface to include the Formulus interface
declare global {
  var formulus: FormulusInterface | undefined;
  var onFormInit: FormulusCallbacks['onFormInit'];
  var onAttachmentReady: FormulusCallbacks['onAttachmentReady'];
  var onSavePartialComplete: FormulusCallbacks['onSavePartialComplete'];
  var onFormulusReady: FormulusCallbacks['onFormulusReady'];
}
