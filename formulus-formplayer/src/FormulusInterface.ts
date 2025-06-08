/**
 * FormulusInterface.ts
 * 
 * This module implements the formplayer-side client for communicating with the Formulus React Native app
 * as described in the sequence diagram.
 * 
 * It uses the shared interface definition from FormulusInterfaceDefinition.ts.
 */

import { 
  FormInitData, 
  AttachmentData, 
  FormulusInterface,
  FormulusCallbacks,
  FORMULUS_INTERFACE_VERSION,
  isCompatibleVersion
} from './FormulusInterfaceDefinition';

// Re-export the types for convenience
export type { FormInitData, AttachmentData, FormulusInterface, FormulusCallbacks };

// Class to handle the Formulus interface
class FormulusClient {
  /**
   * The current version of the interface
   */
  public static readonly VERSION = FORMULUS_INTERFACE_VERSION;
  
  private static instance: FormulusClient;
  private formulus: FormulusInterface | null = null;
  private formData: FormInitData | null = null;
  private onFormInitCallbacks: Array<(data: FormInitData) => void> = [];
  private onAttachmentReadyCallbacks: Array<(data: AttachmentData) => void> = [];

  private constructor() {
    // Initialize and set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Check if the current interface version is compatible with the required version
   * @param requiredVersion The minimum version required
   * @returns True if compatible, false otherwise
   */
  public static isCompatibleVersion(requiredVersion: string): boolean {
    return isCompatibleVersion(requiredVersion);
  }

  public static getInstance(): FormulusClient {
    if (!FormulusClient.instance) {
      FormulusClient.instance = new FormulusClient();
    }
    return FormulusClient.instance;
  }

  /**
   * Initialize the interface with the Formulus RN app
   */
  public initForm(): void {
    console.error('SHOUD NOT BE CALLED: Initializing form and requesting form data from Formulus RN app');
    
    // Check if the Formulus interface is available in the global scope
    if (globalThis.formulus) {
      this.formulus = globalThis.formulus || null;
      
      // Call the native initForm method if it exists
      if (this.formulus && typeof this.formulus.initForm === 'function') {
        // The RN app will call back with form data
        this.formulus.initForm();
      } else {
        console.error('formulus.initForm is not a function');
      }
    } else {
      console.error('Formulus interface not found. Running in standalone mode or development environment.');
    }
  }

  /**
   * Save partial form data to the Formulus RN app
   */
  public savePartial(data: Record<string, any>): void {
    if (!this.formData) {
      console.debug('Cannot save partial data: No form data to save yet');
      return;
    }

    console.debug('Saving partial form data', data);
    
    if (this.formulus) {
      this.formulus.savePartial(this.formData.formId, data);
    } else {
      console.warn('Formulus interface not available for savePartial');
    }
  }

  /**
   * Submit the final form data to the Formulus RN app
   */
  public submitForm(finalData: Record<string, any>): void {
    if (!this.formData?.formId) {
      console.debug('This is a new form instance');
      this.formData = {
        formId: finalData.formId || 'GENERATE-GUID-HERE',
        params: {},
        savedData: {}
      };
    }

    console.log('Submitting final form data', finalData);
    
    if (this.formulus) {
      this.formulus.submitForm(this.formData.formId, finalData);
    } else {
      console.warn('Formulus interface not available for submitForm');
    }
  }

  /**
   * Request camera access from the Formulus RN app
   */
  public requestCamera(fieldId: string): void {
    console.log('Requesting camera for field', fieldId);
    
    if (this.formulus) {
      this.formulus.requestCamera(fieldId);
    } else {
      console.warn('Formulus interface not available for requestCamera');
    }
  }

  /**
   * Request location from the Formulus RN app
   */
  public requestLocation(fieldId: string): void {
    console.log('Requesting location for field', fieldId);
    
    if (this.formulus) {
      this.formulus.requestLocation(fieldId);
    } else {
      console.warn('Formulus interface not available for requestLocation');
    }
  }

  /**
   * Request file picker from the Formulus RN app
   */
  public requestFile(fieldId: string): void {
    console.log('Requesting file for field', fieldId);
    
    if (this.formulus) {
      this.formulus.requestFile(fieldId);
    } else {
      console.warn('Formulus interface not available for requestFile');
    }
  }

  /**
   * Launch an Android intent from the Formulus RN app
   */
  public launchIntent(fieldId: string, intentSpec: Record<string, any>): void {
    console.log('Launching intent for field', fieldId, intentSpec);
    
    if (this.formulus) {
      this.formulus.launchIntent(fieldId, intentSpec);
    } else {
      console.warn('Formulus interface not available for launchIntent');
    }
  }

  /**
   * Call a subform from the Formulus RN app
   */
  public callSubform(fieldId: string, formId: string, options: Record<string, any>): void {
    console.log('Calling subform for field', fieldId, formId, options);
    
    if (this.formulus) {
      this.formulus.callSubform(fieldId, formId, options);
    } else {
      console.warn('Formulus interface not available for callSubform');
    }
  }

  /**
   * Request audio recording from the Formulus RN app
   */
  public requestAudio(fieldId: string): void {
    console.log('Requesting audio for field', fieldId);
    
    if (this.formulus) {
      this.formulus.requestAudio(fieldId);
    } else {
      console.warn('Formulus interface not available for requestAudio');
    }
  }

  /**
   * Request signature capture from the Formulus RN app
   */
  public requestSignature(fieldId: string): void {
    console.log('Requesting signature for field', fieldId);
    
    if (this.formulus) {
      this.formulus.requestSignature(fieldId);
    } else {
      console.warn('Formulus interface not available for requestSignature');
    }
  }

  /**
   * Request biometric authentication from the Formulus RN app
   */
  public requestBiometric(fieldId: string): void {
    console.log('Requesting biometric authentication for field', fieldId);
    
    if (this.formulus) {
      this.formulus.requestBiometric(fieldId);
    } else {
      console.warn('Formulus interface not available for requestBiometric');
    }
  }

  /**
   * Request connectivity status from the Formulus RN app
   */
  public requestConnectivityStatus(): void {
    console.log('Requesting connectivity status');
    
    if (this.formulus) {
      this.formulus.requestConnectivityStatus();
    } else {
      console.warn('Formulus interface not available for requestConnectivityStatus');
    }
  }

  /**
   * Request sync status from the Formulus RN app
   */
  public requestSyncStatus(): void {
    console.log('Requesting sync status');
    
    if (this.formulus) {
      this.formulus.requestSyncStatus();
    } else {
      console.warn('Formulus interface not available for requestSyncStatus');
    }
  }

  /**
   * Run a local ML model through the Formulus RN app
   */
  public runLocalModel(fieldId: string, modelId: string, input: Record<string, any>): void {
    console.log('Running local model', modelId, 'for field', fieldId, 'with input', input);
    
    if (this.formulus) {
      this.formulus.runLocalModel(fieldId, modelId, input);
    } else {
      console.warn('Formulus interface not available for runLocalModel');
    }
  }
  /**
   * Register a callback for when the form is initialized
   */
  public onFormInit(callback: (data: FormInitData) => void): void {
    this.onFormInitCallbacks.push(callback);
    
    // If we already have form data, call the callback immediately
    if (this.formData) {
      callback(this.formData);
    }
  }

  /**
   * Register a callback for when the Formulus interface is ready
   */
  public onFormulusReady(callback: () => void): void {
    if (this.formulus) {
      callback();
    } else {
      // Set up a global callback that will be called by the Formulus RN app
      globalThis.onFormulusReady = () => {
        this.formulus = globalThis.formulus || null;
        callback();
      };
    }
  }

  /**
   * Register a callback for when a save partial operation completes
   */
  public onSavePartialComplete(callback: (formId: string, success: boolean) => void): void {
    // Set up a global callback that will be called by the Formulus RN app
    globalThis.onSavePartialComplete = (formId: string, success: boolean) => {
      callback(formId, success);
    };
  }

  /**
   * Register a callback for when an attachment is ready
   */
  public onAttachmentReady(callback: (data: AttachmentData) => void): void {
    this.onAttachmentReadyCallbacks.push(callback);
  }

  /**
   * Handle form initialization data from the Formulus RN app
   */
  private handleFormInit(data: FormInitData): void {
    console.log('Form initialized with data', data);
    this.formData = data;
    
    // Notify all registered callbacks
    this.onFormInitCallbacks.forEach(callback => callback(data));
  }

  /**
   * Handle attachment ready event from the Formulus RN app
   */
  private handleAttachmentReady(data: AttachmentData): void {
    console.log('Attachment ready', data);
    
    // Notify all registered callbacks
    this.onAttachmentReadyCallbacks.forEach(callback => callback(data));
  }

  /**
   * Set up event listeners for communication with the Formulus RN app
   */
  private setupEventListeners(): void {
    // Set up the global callbacks that will be called by the Formulus RN app
    globalThis.onFormInit = (formId: string, params: Record<string, any>, savedData: Record<string, any>) => {
      this.handleFormInit({ formId, params, savedData });
    };
    
    globalThis.onAttachmentReady = (data: AttachmentData) => {
      this.handleAttachmentReady(data);
    };

    // Check if the Formulus interface is already available
    if (globalThis.formulus) {
      this.formulus = globalThis.formulus;
      if (typeof globalThis.onFormulusReady === 'function') {
        globalThis.onFormulusReady();
      }
    }
  }
}

// Note: Global interface extensions are now defined in FormulusInterfaceDefinition.ts

export default FormulusClient;
