/**
 * FormulusInterfaceDefinition.ts
 * 
 * This module defines the shared interface between the Formulus React Native app and the Formplayer WebView.
 * It serves as the single source of truth for the interface definition.
 * 
 * NOTE: This file should be manually copied to client projects that need to interact with the Formulus app.
 * TODO: Package this interface into a shared npm package for better maintainability and versioning.
 * 
 * Current Version: 1.0.0
 */

// Type definitions for the interface
export interface FormInitData {
  formId: string;
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
  dataPoints: DataPoint[];
}

export interface DataPoint {
  fieldName: string;
  fieldValue: any;
  isCore: boolean;
}

/**
 * Interface for the Formulus app methods that will be injected into the WebViews for custom_app and FormPlayer
 */
export interface FormulusInterface {
  getVersion: () => string;
  getAvailableForms: () => FormInfo[];
  openFormplayer: (formId: string, params: Record<string, any>, savedData: Record<string, any>) => void;
  getObservations: (formId: string, isDraft?: boolean, includeDeleted?: boolean) => FormObservation[]; // TODO: Update to support paging

  // Basic form operations
  initForm: () => void;
  savePartial: (formId: string, data: Record<string, any>) => void;
  submitForm: (formId: string, finalData: Record<string, any>) => void;
  
  // Native feature calls // TODO: Clean-up
  requestCamera: (fieldId: string) => void;
  requestLocation: (fieldId: string) => void;
  requestFile: (fieldId: string) => void;
  launchIntent: (fieldId: string, intentSpec: Record<string, any>) => void;
  callSubform: (fieldId: string, formId: string, options: Record<string, any>) => void;
  requestAudio: (fieldId: string) => void;
  requestSignature: (fieldId: string) => void;
  requestBiometric: (fieldId: string) => void;
  requestConnectivityStatus: () => void;
  requestSyncStatus: () => void;
  runLocalModel: (fieldId: string, modelId: string, input: Record<string, any>) => void;
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
export const FORMULUS_INTERFACE_VERSION = "1.0.0";

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
