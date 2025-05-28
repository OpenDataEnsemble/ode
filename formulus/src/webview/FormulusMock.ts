import { 
  FormulusInterface, 
  FormInfo, 
  FormObservation, 
  DataPoint,
  AttachmentData
} from './FormulusInterfaceDefinition';

// Extend the Window interface
declare global {
  interface Window {
    formulus?: any;
    formulusCallbacks?: Record<string, (...args: any[]) => void>;
    registerFormulusCallback?: (eventName: string, callback: (...args: any[]) => void) => void;
  }
  // This allows using the global window object in Node.js environment
  const window: Window & typeof globalThis;
}

export class FormulusMock implements FormulusInterface {
  private mockData: Record<string, any> = {};
  private forms: FormInfo[] = [
    {
      formId: "mock-form",
      name: "Mock Form",
      version: "1.0.0",
      coreFields: ["field1", "field2"],
      auxiliaryFields: ["notes"]
    }
  ];

  // Basic info
  getVersion(): string {
    return "mock-1.0.0";
  }

  getAvailableForms(): FormInfo[] {
    return this.forms;
  }

  // Form operations
  openFormplayer(formId: string, params: Record<string, any>, savedData: Record<string, any>): void {
    console.log(`[FormulusMock] Opening form ${formId}`, { params, savedData });
    this.mockData[formId] = savedData || {};
  }

  getObservations(formId: string, isDraft = false, includeDeleted = false): FormObservation[] {
    console.log(`[FormulusMock] Getting observations for form ${formId}`, { isDraft, includeDeleted });
    return [{
      observationId: `obs-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date(),
      isDraft,
      deleted: false,
      formId,
      formVersion: "1.0.0",
      dataPoints: Object.entries(this.mockData[formId] || {}).map(([fieldName, fieldValue]) => ({
        fieldName,
        fieldValue,
        isCore: this.forms.some(f => f.coreFields?.includes(fieldName)) || false
      }))
    }];
  }

  // Form actions
  initForm(): void {
    console.log('[FormulusMock] Initializing form');
    this.triggerCallback('onFormulusReady');
  }

  savePartial(formId: string, data: Record<string, any>): void {
    console.log(`[FormulusMock] Saving partial data for form ${formId}`, data);
    this.mockData[formId] = { ...(this.mockData[formId] || {}), ...data };
    this.triggerCallback('onSavePartialComplete', formId, true);
  }

  submitForm(formId: string, finalData: Record<string, any>): void {
    console.log(`[FormulusMock] Submitting form ${formId}`, finalData);
    this.mockData[formId] = finalData;
  }

  // Native feature mocks
  requestCamera(fieldId: string): void {
    console.log(`[FormulusMock] Requesting camera for field ${fieldId}`);
    // Simulate camera response after a delay
    setTimeout(() => {
      const mockResponse: AttachmentData = {
        fieldId,
        type: 'image',
        uri: 'mock-image-uri.jpg',
        width: 800,
        height: 600
      };
      this.triggerCallback('onAttachmentReady', mockResponse);
    }, 1000);
  }

  requestLocation(fieldId: string): void {
    console.log(`[FormulusMock] Requesting location for field ${fieldId}`);
    setTimeout(() => {
      const mockResponse: AttachmentData = {
        fieldId,
        type: 'location',
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10
      };
      this.triggerCallback('onAttachmentReady', mockResponse);
    }, 1000);
  }

  // Stub implementations for other methods
  requestFile(fieldId: string): void {
    console.log(`[FormulusMock] Requesting file for field ${fieldId}`);
    setTimeout(() => {
      const mockResponse: AttachmentData = {
        fieldId,
        type: 'file',
        uri: 'mock-file.pdf',
        name: 'document.pdf',
        size: 1024
      };
      this.triggerCallback('onAttachmentReady', mockResponse);
    }, 1000);
  }

  launchIntent(fieldId: string, intentSpec: Record<string, any>): void {
    console.log(`[FormulusMock] Launching intent for field ${fieldId}`, intentSpec);
    setTimeout(() => {
      this.triggerCallback('onAttachmentReady', {
        fieldId,
        type: 'intent',
        result: { status: 'completed', data: { result: 'mock result' } }
      });
    }, 1000);
  }

  // Implement remaining required methods
  callSubform(fieldId: string, formId: string, options: Record<string, any>): void {
    console.log(`[FormulusMock] Calling subform ${formId} for field ${fieldId}`, options);
    setTimeout(() => {
      this.triggerCallback('onAttachmentReady', {
        fieldId,
        type: 'subform',
        result: { status: 'completed', data: { fieldId, formId } }
      });
    }, 1000);
  }

  requestAudio(fieldId: string): void {
    console.log(`[FormulusMock] Requesting audio for field ${fieldId}`);
    setTimeout(() => {
      this.triggerCallback('onAttachmentReady', {
        fieldId,
        type: 'audio',
        uri: 'mock-audio.mp3',
        duration: 30
      });
    }, 1000);
  }

  requestSignature(fieldId: string): void {
    console.log(`[FormulusMock] Requesting signature for field ${fieldId}`);
    setTimeout(() => {
      this.triggerCallback('onAttachmentReady', {
        fieldId,
        type: 'signature',
        uri: 'mock-signature.png'
      });
    }, 1000);
  }

  requestBiometric(fieldId: string): void {
    console.log(`[FormulusMock] Requesting biometric for field ${fieldId}`);
    setTimeout(() => {
      this.triggerCallback('onAttachmentReady', {
        fieldId,
        type: 'biometric',
        success: true
      });
    }, 1000);
  }

  requestConnectivityStatus(): void {
    console.log('[FormulusMock] Requesting connectivity status');
    setTimeout(() => {
      this.triggerCallback('onAttachmentReady', {
        type: 'connectivity',
        isConnected: true,
        connectionType: 'wifi'
      });
    }, 500);
  }

  requestSyncStatus(): void {
    console.log('[FormulusMock] Requesting sync status');
    setTimeout(() => {
      this.triggerCallback('onAttachmentReady', {
        type: 'sync',
        lastSync: new Date().toISOString(),
        status: 'up-to-date'
      });
    }, 500);
  }

  runLocalModel(fieldId: string, modelId: string, input: Record<string, any>): void {
    console.log(`[FormulusMock] Running model ${modelId} for field ${fieldId}`, input);
    setTimeout(() => {
      this.triggerCallback('onAttachmentReady', {
        fieldId,
        type: 'ml_result',
        modelId,
        result: { prediction: 'mock-prediction' }
      });
    }, 1500);
  }

  // Helper to trigger callbacks
  private triggerCallback(callbackName: string, ...args: any[]) {
    if (typeof window !== 'undefined' && window.formulusCallbacks?.[callbackName]) {
      window.formulusCallbacks[callbackName](...args);
    }
  }
}

// For direct browser usage
if (typeof window !== 'undefined' && !window.formulus) {
  console.log('[FormulusMock] Initializing mock interface');
  const mock = new FormulusMock();
  
  // Initialize callbacks object if it doesn't exist
  if (!window.formulusCallbacks) {
    window.formulusCallbacks = {};
  }
  
  // Set up the formulus instance
  window.formulus = mock;
  
  // Helper for custom app developers to register callbacks
  window.registerFormulusCallback = (eventName: string, callback: (...args: any[]) => void) => {
    if (!window.formulusCallbacks) {
      window.formulusCallbacks = {};
    }
    window.formulusCallbacks[eventName] = callback;
  };
}

export default FormulusMock;
