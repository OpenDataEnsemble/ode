/**
 * FormulusInterface.ts
 *
 * This module implements the formplayer-side client for communicating with the Formulus React Native app
 * as described in the sequence diagram.
 *
 * It uses the shared interface definition from FormulusInterfaceDefinition.ts.
 */

import {
  FormulusInterface,
  CameraResult,
  QrcodeResult,
  SignatureResult,
  FileResult,
  AudioResult,
} from './FormulusInterfaceDefinition';

import {
  FormInitData,
  AttachmentData,
  FormulusCallbacks,
  FORMULUS_INTERFACE_VERSION,
  isCompatibleVersion,
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
    this.setupEventListeners().catch((error) => {
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
   * Submit form data with proper create/update logic based on context
   * @param formInitData - The form initialization data containing observationId and formType
   * @param finalData - The final form data to submit
   * @returns Promise that resolves with the observationId (or void for legacy implementations)
   */
  public submitObservationWithContext(
    formInitData: FormInitData,
    finalData: Record<string, any>,
  ): Promise<string | void> {
    console.debug('Submitting form with context:', formInitData);
    console.debug('Final form data:', finalData);

    if (!this.formulus) {
      console.warn('Formulus interface not available for form submission');
      return Promise.reject(new Error('Formulus interface not available for form submission'));
    }

    if (formInitData.observationId) {
      console.debug('Updating existing form with observationId:', formInitData.observationId);
      return this.formulus.updateObservation(
        formInitData.observationId,
        formInitData.formType,
        finalData,
      );
    } else {
      console.debug('Creating new form of type:', formInitData.formType);
      return this.formulus.submitObservation(formInitData.formType, finalData);
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
        message: 'Formulus interface not available',
      } as CameraResult);
    }
  }

  /**
   * Request location from the Formulus RN app.
   * The shared interface no longer returns a typed LocationResult; this
   * simply forwards the request and returns the underlying Promise<void>.
   */
  public requestLocation(fieldId: string): Promise<void> {
    console.log('Requesting location for field', fieldId);

    if (this.formulus) {
      return this.formulus.requestLocation(fieldId);
    }

    console.warn('Formulus interface not available for requestLocation');
    return Promise.reject(new Error('Formulus interface not available for requestLocation'));
  }

  /**
   * Request file selection from the Formulus RN app
   */
  public requestFile(fieldId: string): Promise<FileResult> {
    console.log('Requesting file for field', fieldId);

    if (this.formulus) {
      return this.formulus.requestFile(fieldId);
    } else {
      console.warn('Formulus interface not available for requestFile');
      return Promise.reject({
        fieldId,
        status: 'error',
        message: 'Formulus interface not available',
      });
    }
  }

  /**
   * Request audio recording from the Formulus RN app
   */
  public requestAudio(fieldId: string): Promise<AudioResult> {
    console.log('Requesting audio recording for field', fieldId);

    if (this.formulus) {
      return this.formulus.requestAudio(fieldId);
    } else {
      console.warn('Formulus interface not available for requestAudio');
      return Promise.reject({
        fieldId,
        status: 'error',
        message: 'Formulus interface not available',
      });
    }
  }

  /**
   * Launch an Android intent from the Formulus RN app
   */
  public launchIntent(fieldId: string, intentSpec: Record<string, any>): Promise<void> {
    console.log('Launching intent for field', fieldId, intentSpec);

    if (this.formulus) {
      return this.formulus.launchIntent(fieldId, intentSpec);
    }

    console.warn('Formulus interface not available for launchIntent');
    return Promise.reject(new Error('Formulus interface not available for launchIntent'));
  }

  /**
   * Call a subform from the Formulus RN app
   */
  public callSubform(fieldId: string, formId: string, options: Record<string, any>): Promise<void> {
    console.log('Calling subform for field', fieldId, formId, options);

    if (this.formulus) {
      return this.formulus.callSubform(fieldId, formId, options);
    }

    console.warn('Formulus interface not available for callSubform');
    return Promise.reject(new Error('Formulus interface not available for callSubform'));
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
        message: 'Formulus interface not available',
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
        message: 'Formulus interface not available',
      } as QrcodeResult);
    }
  }

  /**
   * Request biometric authentication from the Formulus RN app
   */
  public requestBiometric(fieldId: string): Promise<void> {
    console.log('Requesting biometric authentication for field', fieldId);

    if (this.formulus) {
      return this.formulus.requestBiometric(fieldId);
    }

    console.warn('Formulus interface not available for requestBiometric');
    return Promise.reject(new Error('Formulus interface not available for requestBiometric'));
  }

  /**
   * Request connectivity status from the Formulus RN app
   */
  public requestConnectivityStatus(): Promise<void> {
    console.log('Requesting connectivity status');

    if (this.formulus) {
      return this.formulus.requestConnectivityStatus();
    }

    console.warn('Formulus interface not available for requestConnectivityStatus');
    return Promise.reject(
      new Error('Formulus interface not available for requestConnectivityStatus'),
    );
  }

  /**
   * Request sync status from the Formulus RN app
   */
  public requestSyncStatus(): Promise<void> {
    console.log('Requesting sync status');

    if (this.formulus) {
      return this.formulus.requestSyncStatus();
    }

    console.warn('Formulus interface not available for requestSyncStatus');
    return Promise.reject(new Error('Formulus interface not available for requestSyncStatus'));
  }

  /**
   * Run a local ML model through the Formulus RN app
   */
  public runLocalModel(
    fieldId: string,
    modelId: string,
    input: Record<string, any>,
  ): Promise<void> {
    console.log('Running local model', modelId, 'for field', fieldId, 'with input', input);

    if (this.formulus) {
      return this.formulus.runLocalModel(fieldId, modelId, input);
    }

    console.warn('Formulus interface not available for runLocalModel');
    return Promise.reject(new Error('Formulus interface not available for runLocalModel'));
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
   * Handle form initialization data from the Formulus RN app
   */
  private handleFormInit(data: FormInitData): void {
    console.log('Form initialized with data', data);
    this.formData = data;

    // Notify all registered callbacks
    this.onFormInitCallbacks.forEach((callback) => callback(data));
  }

  /**
   * Set up event listeners and initialize the Formulus interface
   */
  private async setupEventListeners(): Promise<void> {
    // Initialize the Formulus interface using the modern getFormulus() approach only
    try {
      if (typeof (window as any).getFormulus === 'function') {
        this.formulus = await (window as any).getFormulus();
        console.log('Formulus API initialized successfully using getFormulus()');
      } else {
        console.error(
          'getFormulus() is not available on window. Formulus API will not be available.',
        );
      }
    } catch (error) {
      console.error('Failed to initialize Formulus API with getFormulus():', error);
    }
  }
}

// Note: Global interface extensions are now defined in FormulusInterfaceDefinition.ts

export default FormulusClient;
