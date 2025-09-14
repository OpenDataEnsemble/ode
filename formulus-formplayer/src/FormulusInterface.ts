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
  isCompatibleVersion,
  CameraResult,
  AudioResult,
  SignatureResult,
  QrcodeResult
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

  private constructor() {
    // Initialize and set up event listeners
    this.setupEventListeners().catch(error => {
      console.error('Failed to setup event listeners:', error);
    });
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
   * Save partial form data to the Formulus RN app
   */
  public savePartial(data: Record<string, any>): void {
    if (!this.formData) {
      console.debug('Cannot save partial data: No form data to save yet');
      return;
    }

    console.debug('Saving partial form data', data);
    
    if (this.formulus) {
      this.formulus.savePartial(this.formData.formType, data);
    } else {
      console.warn('Formulus interface not available for savePartial');
    }
  }

  /**
   * Submit form data with proper create/update logic based on context
   * @param formInitData - The form initialization data containing observationId and formType
   * @param finalData - The final form data to submit
   */
  public submitObservationWithContext(formInitData: FormInitData, finalData: Record<string, any>): void {
    console.debug('Submitting form with context:', formInitData);
    console.debug('Final form data:', finalData);
    
    if (!this.formulus) {
      console.warn('Formulus interface not available for form submission');
      return;
    }

    if (formInitData.observationId) {
      console.debug('Updating existing form with observationId:', formInitData.observationId);
      this.formulus.updateObservation(formInitData.observationId, formInitData.formType, finalData);
    } else {
      console.debug('Creating new form of type:', formInitData.formType);
      this.formulus.submitObservation(formInitData.formType, finalData);
    }
  }

  /**
   * Request camera access from the Formulus RN app
   */
  public requestCamera(fieldId: string): Promise<CameraResult> {
    console.debug('Requesting camera for field', fieldId);
    
    if (this.formulus) {
      return this.formulus.requestCamera(fieldId);
    } else {
      console.warn('Formulus interface not available for requestCamera');
      return Promise.reject({
        fieldId,
        status: 'error',
        message: 'Formulus interface not available'
      } as CameraResult);
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
  public requestAudio(fieldId: string): Promise<AudioResult> {
    console.log('Requesting audio for field', fieldId);
    
    if (this.formulus) {
      return this.formulus.requestAudio(fieldId);
    } else {
      console.warn('Formulus interface not available for requestAudio');
      return Promise.reject({
        fieldId,
        status: 'error',
        message: 'Formulus interface not available'
      } as AudioResult);
    }
  }

  /**
   * Request signature capture from the Formulus RN app
   */
  public requestSignature(fieldId: string): Promise<SignatureResult> {
    console.log('Requesting signature for field', fieldId);
    
    if (this.formulus) {
      return this.formulus.requestSignature(fieldId);
    } else {
      console.warn('Formulus interface not available for requestSignature');
      return Promise.reject({
        fieldId,
        status: 'error',
        message: 'Formulus interface not available'
      } as SignatureResult);
    }
  }

  /**
   * Request QR code scanning from the Formulus RN app
   */
  public requestQrcode(fieldId: string): Promise<QrcodeResult> {
    console.log('Requesting QR code scanner for field', fieldId);
    
    if (this.formulus) {
      return this.formulus.requestQrcode(fieldId);
    } else {
      console.warn('Formulus interface not available for requestQrcode');
      return Promise.reject({
        fieldId,
        status: 'error',
        message: 'Formulus interface not available'
      } as QrcodeResult);
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
  public async onFormulusReady(callback: () => void): Promise<void> {
    try {
      // Use the new getFormulus() approach
      if (typeof (window as any).getFormulus === 'function') {
        this.formulus = await (window as any).getFormulus();
        callback();
      } else {
        console.warn('getFormulus() not available, falling back to legacy approach');
        // Legacy fallback
        if (this.formulus) {
          callback();
        } else {
          globalThis.onFormulusReady = () => {
            this.formulus = globalThis.formulus || null;
            callback();
          };
        }
      }
    } catch (error) {
      console.error('Failed to initialize Formulus API:', error);
      // Still try legacy fallback
      if (this.formulus) {
        callback();
      }
    }
  }

  /**
   * Register a callback for when a save partial operation completes
   */
  public onSavePartialComplete(callback: (formId: string, observationId: string | null, success: boolean) => void): void {
    // Set up a global callback that will be called by the Formulus RN app
    globalThis.onSavePartialComplete = (formId: string, observationId: string | null, success: boolean) => {
      callback(formId, observationId, success);
    };
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
   * Set up event listeners for communication with the Formulus RN app
   */
  private async setupEventListeners(): Promise<void> {
    // Set up the global callbacks that will be called by the Formulus RN app
    globalThis.onFormInit = (formId: string, observationId: string | null, params: Record<string, any>, savedData: Record<string, any>) => {
      this.handleFormInit({ formType: formId, observationId, params, savedData });
    };

    // Try to initialize the Formulus interface using the new approach
    try {
      if (typeof (window as any).getFormulus === 'function') {
        this.formulus = await (window as any).getFormulus();
        console.log('Formulus API initialized successfully using getFormulus()');
      } else {
        // Legacy fallback
        if (globalThis.formulus) {
          this.formulus = globalThis.formulus;
          if (typeof globalThis.onFormulusReady === 'function') {
            globalThis.onFormulusReady();
          }
        }
      }
    } catch (error) {
      console.warn('Failed to initialize Formulus API with getFormulus(), using legacy approach:', error);
      // Legacy fallback
      if (globalThis.formulus) {
        this.formulus = globalThis.formulus;
        if (typeof globalThis.onFormulusReady === 'function') {
          globalThis.onFormulusReady();
        }
      }
    }
  }
}

// Note: Global interface extensions are now defined in FormulusInterfaceDefinition.ts

export default FormulusClient;
