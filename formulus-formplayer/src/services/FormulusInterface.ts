/**
 * FormulusInterface.ts
 *
 * This module implements the formplayer-side client for communicating with the Formulus React Native app
 * as described in the sequence diagram.
 *
 * It uses the shared interface definition from FormulusInterfaceDefinition.ts.
 */

import {
  AttachmentDisplayDescriptor,
  FormulusInterface,
  CameraResult,
  VideoResult,
  QrcodeResult,
  FileResult,
  AudioResult,
  LocationResult,
  FormCompletionResult,
} from '../types/FormulusInterfaceDefinition';

import {
  FormInitData,
  AttachmentData,
  FormulusCallbacks,
  FORMULUS_INTERFACE_VERSION,
  isCompatibleVersion,
} from '../types/FormulusInterfaceDefinition';

// Re-export the types for convenience
export type {
  FormInitData,
  AttachmentData,
  FormulusInterface,
  FormulusCallbacks,
};

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
   * Drop the cached injected API so the next bridge call re-runs `window.getFormulus()`.
   * Storybook installs a different partial {@link FormulusInterface} per story; without this,
   * navigating from e.g. Photo to File leaves a stale object missing `requestFile`.
   */
  public static clearCachedFormulusApi(): void {
    FormulusClient.instance?.resetCachedFormulusApi();
  }

  private resetCachedFormulusApi(): void {
    this.formulus = null;
  }

  /**
   * Submit form data with proper create/update logic based on context
   * @param formInitData - The form initialization data containing observationId and formType
   * @param finalData - The final form data to submit
   * @returns Promise that resolves with the observationId (or void for legacy implementations)
   */
  public async submitObservationWithContext(
    formInitData: FormInitData,
    finalData: Record<string, any>,
  ): Promise<string | void> {
    console.debug('Submitting form with context:', formInitData);
    console.debug('Final form data:', finalData);
    await this.tryEnsureFormulus();
    if (!this.formulus) {
      console.warn('Formulus interface not available for form submission');
      return Promise.reject(
        new Error('Formulus interface not available for form submission'),
      );
    }

    if (formInitData.observationId) {
      console.debug(
        'Updating existing form with observationId:',
        formInitData.observationId,
      );
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
  public async requestCamera(fieldId: string): Promise<CameraResult> {
    console.debug('Requesting camera for field', fieldId);
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.requestCamera(fieldId);
    }
    console.warn('Formulus interface not available for requestCamera');
    return Promise.reject({
      fieldId,
      status: 'error',
      message: 'Formulus interface not available',
    } as CameraResult);
  }

  /**
   * Resolve an attachment basename or photo descriptor to a WebView-loadable URL.
   */
  public async getAttachmentUri(
    fileRef: string | AttachmentDisplayDescriptor | null | undefined,
  ): Promise<string | null> {
    if (fileRef == null) {
      return null;
    }
    if (typeof fileRef === 'string') {
      if (!fileRef.trim()) {
        return null;
      }
    } else {
      const hasFn =
        typeof fileRef.filename === 'string' && fileRef.filename.trim() !== '';
      if (!hasFn) {
        return null;
      }
    }
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.getAttachmentUri(fileRef);
    }
    console.warn('Formulus interface not available for getAttachmentUri');
    return null;
  }

  /**
   * Request location from the Formulus RN app (native GPS for this field).
   */
  public async requestLocation(fieldId: string): Promise<LocationResult> {
    console.log('Requesting location for field', fieldId);
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.requestLocation(fieldId);
    }
    console.warn('Formulus interface not available for requestLocation');
    return Promise.reject(
      new Error('Formulus interface not available for requestLocation'),
    );
  }

  /**
   * Request file selection from the Formulus RN app
   */
  public async requestFile(fieldId: string): Promise<FileResult> {
    console.log('Requesting file for field', fieldId);
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.requestFile(fieldId);
    }
    console.warn('Formulus interface not available for requestFile');
    return Promise.reject({
      fieldId,
      status: 'error',
      message: 'Formulus interface not available',
    });
  }

  /**
   * Request audio recording from the Formulus RN app
   */
  public async requestAudio(fieldId: string): Promise<AudioResult> {
    console.log('Requesting audio recording for field', fieldId);
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.requestAudio(fieldId);
    }
    console.warn('Formulus interface not available for requestAudio');
    return Promise.reject({
      fieldId,
      status: 'error',
      message: 'Formulus interface not available',
    });
  }

  /**
   * Request video recording from the Formulus RN app
   */
  public async requestVideo(fieldId: string): Promise<VideoResult> {
    console.debug('Requesting video for field', fieldId);
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.requestVideo(fieldId);
    }
    console.warn('Formulus interface not available for requestVideo');
    return Promise.reject({
      fieldId,
      status: 'error',
      message: 'Formulus interface not available',
    });
  }

  /**
   * Launch an Android intent from the Formulus RN app
   */
  public async launchIntent(
    fieldId: string,
    intentSpec: Record<string, any>,
  ): Promise<void> {
    console.log('Launching intent for field', fieldId, intentSpec);
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.launchIntent(fieldId, intentSpec);
    }
    console.warn('Formulus interface not available for launchIntent');
    return Promise.reject(
      new Error('Formulus interface not available for launchIntent'),
    );
  }

  /**
   * Call a subform from the Formulus RN app
   */
  public async callSubform(
    fieldId: string,
    formId: string,
    options: Record<string, any>,
  ): Promise<void> {
    console.log('Calling subform for field', fieldId, formId, options);
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.callSubform(fieldId, formId, options);
    }
    console.warn('Formulus interface not available for callSubform');
    return Promise.reject(
      new Error('Formulus interface not available for callSubform'),
    );
  }

  /**
   * Request QR code scanning from the Formulus RN app
   */
  public async requestQrcode(fieldId: string): Promise<QrcodeResult> {
    console.log('Requesting QR code scanner for field', fieldId);
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.requestQrcode(fieldId);
    }
    console.warn('Formulus interface not available for requestQrcode');
    return Promise.reject({
      fieldId,
      status: 'error',
      message: 'Formulus interface not available',
    } as QrcodeResult);
  }

  /**
   * Request biometric authentication from the Formulus RN app
   */
  public async requestBiometric(fieldId: string): Promise<void> {
    console.log('Requesting biometric authentication for field', fieldId);
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.requestBiometric(fieldId);
    }
    console.warn('Formulus interface not available for requestBiometric');
    return Promise.reject(
      new Error('Formulus interface not available for requestBiometric'),
    );
  }

  /**
   * Request connectivity status from the Formulus RN app
   */
  public async requestConnectivityStatus(): Promise<void> {
    console.log('Requesting connectivity status');
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.requestConnectivityStatus();
    }
    console.warn(
      'Formulus interface not available for requestConnectivityStatus',
    );
    return Promise.reject(
      new Error(
        'Formulus interface not available for requestConnectivityStatus',
      ),
    );
  }

  /**
   * Request sync status from the Formulus RN app
   */
  public async requestSyncStatus(): Promise<void> {
    console.log('Requesting sync status');
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.requestSyncStatus();
    }
    console.warn('Formulus interface not available for requestSyncStatus');
    return Promise.reject(
      new Error('Formulus interface not available for requestSyncStatus'),
    );
  }

  /**
   * Run a local ML model through the Formulus RN app
   */
  public async runLocalModel(
    fieldId: string,
    modelId: string,
    input: Record<string, any>,
  ): Promise<void> {
    console.log(
      'Running local model',
      modelId,
      'for field',
      fieldId,
      'with input',
      input,
    );
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.runLocalModel(fieldId, modelId, input);
    }
    console.warn('Formulus interface not available for runLocalModel');
    return Promise.reject(
      new Error('Formulus interface not available for runLocalModel'),
    );
  }

  /**
   * Open Formplayer from within the formplayer WebView (e.g. sub-observation rows).
   * Forwards to the injected Formulus API.
   */
  public async openFormplayer(
    formType: string,
    params: Record<string, unknown>,
    savedData: Record<string, unknown>,
    options?: { subObservationMode?: boolean; skipFinalize?: boolean },
  ): Promise<FormCompletionResult> {
    await this.tryEnsureFormulus();
    if (this.formulus) {
      return this.formulus.openFormplayer(formType, params, savedData, options);
    }
    console.warn('Formulus interface not available for openFormplayer');
    return Promise.reject(
      new Error('Formulus interface not available for openFormplayer'),
    );
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
    this.onFormInitCallbacks.forEach(callback => callback(data));
  }

  /**
   * Set up event listeners and initialize the Formulus interface
   */
  private async setupEventListeners(): Promise<void> {
    await this.tryEnsureFormulus();
  }

  /**
   * Try to obtain the Formulus interface from window.getFormulus() if not yet set.
   * Used at startup and when a method is called with interface still null (e.g. mock
   * became available after first attempt, or dev testbed loads mock after FormulusClient).
   */
  private async tryEnsureFormulus(): Promise<void> {
    if (this.formulus) return;
    try {
      if (typeof (window as any).getFormulus === 'function') {
        this.formulus = await (window as any).getFormulus();
        console.log(
          'Formulus API initialized successfully using getFormulus()',
        );
      }
    } catch (error) {
      console.error(
        'Failed to initialize Formulus API with getFormulus():',
        error,
      );
    }
  }
}

// Note: Global interface extensions are now defined in FormulusInterfaceDefinition.ts

export default FormulusClient;
