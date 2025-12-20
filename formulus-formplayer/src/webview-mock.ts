// Mock implementation of ReactNativeWebView for development testing
import {
  FormulusInterface,
  FormInitData,
  AttachmentData,
  CameraResult,
  QrcodeResult,
  SignatureResult,
  FileResult,
  AudioResult,
} from './FormulusInterfaceDefinition';

// Local lightweight types for location/video results used only in the
// development mock. The shared Formulus interface no longer exposes
// these, but the mock helpers still refer to them.
type LocationResult = {
  fieldId: string;
  status: 'success' | 'cancelled' | 'error';
  message?: string;
  data?: any;
};

type VideoResult = {
  fieldId: string;
  status: 'success' | 'cancelled' | 'error';
  message?: string;
  data?: any;
};

interface MockWebView {
  postMessage: (message: string) => void;
}

interface MockFormulus {
  submitObservation: (formType: string, finalData: Record<string, any>) => Promise<void>;
  updateObservation: (
    observationId: string,
    formType: string,
    finalData: Record<string, any>,
  ) => Promise<void>;
  requestCamera: (fieldId: string) => Promise<CameraResult>;
  requestQrcode: (fieldId: string) => Promise<QrcodeResult>;
  requestSignature: (fieldId: string) => Promise<SignatureResult>;
  requestLocation: (fieldId: string) => Promise<LocationResult>;
  requestVideo: (fieldId: string) => Promise<VideoResult>;
  requestFile: (fieldId: string) => Promise<FileResult>;
  requestAudio: (fieldId: string) => Promise<AudioResult>;
  launchIntent: (fieldId: string, intentSpec: Record<string, any>) => Promise<void>;
}

type MockWindow = Window & {
  ReactNativeWebView?: MockWebView;
  onFormInit?: (data: FormInitData) => void;
};

type MockGlobalThis = typeof globalThis & {
  formulus?: MockFormulus;
};

class WebViewMock {
  private messageListeners: ((message: any) => void)[] = [];
  private isActive = false;
  private pendingCameraPromises = new Map<
    string,
    { resolve: (result: CameraResult) => void; reject: (result: CameraResult) => void }
  >();
  private pendingQrcodePromises = new Map<
    string,
    { resolve: (result: QrcodeResult) => void; reject: (result: QrcodeResult) => void }
  >();
  private pendingSignaturePromises = new Map<
    string,
    { resolve: (result: SignatureResult) => void; reject: (result: SignatureResult) => void }
  >();
  private pendingFilePromises = new Map<
    string,
    { resolve: (result: FileResult) => void; reject: (result: FileResult) => void }
  >();
  private pendingAudioPromises = new Map<
    string,
    { resolve: (result: AudioResult) => void; reject: (result: AudioResult) => void }
  >();
  private pendingLocationPromises = new Map<
    string,
    { resolve: (result: LocationResult) => void; reject: (result: LocationResult) => void }
  >();
  private pendingVideoPromises = new Map<
    string,
    { resolve: (result: VideoResult) => void; reject: (result: VideoResult) => void }
  >();

  // Mock the postMessage function that the app uses to send messages to native
  private postMessage = (message: string) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log('[WebView Mock] Received message from app:', parsedMessage);

      // Handle specific message types
      if (parsedMessage.type === 'formplayerReadyToReceiveInit') {
        console.log('[WebView Mock] App is ready to receive init data');
        // Notify any listeners that the app is ready
        this.messageListeners.forEach((listener) => listener(parsedMessage));

        // Auto-trigger form initialization after a short delay
        setTimeout(() => {
          console.log('[WebView Mock] Auto-triggering onFormInit with sample data');
          this.simulateFormInit(sampleFormData);
        }, 500); // 500ms delay to ensure everything is ready
      }
    } catch (error) {
      console.error('[WebView Mock] Failed to parse message:', error);
    }
  };

  // Initialize the mock
  public init(): void {
    console.log('[WebView Mock] init() called, isActive:', this.isActive);

    // NEVER initialize in production - additional safeguard
    if (process.env.NODE_ENV !== 'development') {
      console.log('[WebView Mock] Production environment detected, refusing to initialize mock');
      return;
    }

    if (this.isActive) {
      console.log('[WebView Mock] Already active, returning early');
      return;
    }

    const mockWindow = window as MockWindow;
    const mockGlobal = globalThis as MockGlobalThis;
    console.log(
      '[WebView Mock] Checking if ReactNativeWebView exists:',
      !!mockWindow.ReactNativeWebView,
    );

    // Only initialize if ReactNativeWebView doesn't already exist
    if (!mockWindow.ReactNativeWebView) {
      mockWindow.ReactNativeWebView = {
        postMessage: this.postMessage,
      };
      console.log('[WebView Mock] Initialized mock ReactNativeWebView interface');
    } else {
      console.log('[WebView Mock] ReactNativeWebView already exists, not initializing mock');
    }

    // Also mock the globalThis.formulus interface
    if (!mockGlobal.formulus) {
      // Create a partial mock that captures the methods we care about
      mockGlobal.formulus = {
        submitObservation: (formType: string, data: Record<string, any>): Promise<void> => {
          const message = { type: 'submitObservation', formType, data };
          console.log('[WebView Mock] Received submitObservation call:', message);
          this.messageListeners.forEach((listener) => listener(message));
          return Promise.resolve();
        },
        updateObservation: (
          observationId: string,
          formType: string,
          data: Record<string, any>,
        ): Promise<void> => {
          const message = { type: 'updateObservation', observationId, formType, data };
          console.log('[WebView Mock] Received updateObservation call:', message);
          this.messageListeners.forEach((listener) => listener(message));
          return Promise.resolve();
        },
        requestCamera: (fieldId: string): Promise<CameraResult> => {
          const message = { type: 'requestCamera', fieldId };
          console.log('[WebView Mock] Received requestCamera call:', message);
          this.messageListeners.forEach((listener) => listener(message));

          // Return a Promise that will be resolved/rejected based on user interaction
          return new Promise<CameraResult>((resolve, reject) => {
            // Store the promise resolvers for this field
            this.pendingCameraPromises.set(fieldId, { resolve, reject });

            // Show interactive popup for camera simulation
            this.showCameraSimulationPopup(fieldId);
          });
        },
        requestQrcode: (fieldId: string): Promise<QrcodeResult> => {
          const message = { type: 'requestQrcode', fieldId };
          console.log('[WebView Mock] Received requestQrcode call:', message);
          this.messageListeners.forEach((listener) => listener(message));

          // Return a Promise that will be resolved/rejected based on user interaction
          return new Promise<QrcodeResult>((resolve, reject) => {
            // Store the promise resolvers for this field
            this.pendingQrcodePromises.set(fieldId, { resolve, reject });

            // Show interactive popup for QR code simulation
            this.showQrcodeSimulationPopup(fieldId);
          });
        },
        requestSignature: (fieldId: string): Promise<SignatureResult> => {
          const message = { type: 'requestSignature', fieldId };
          console.log('[WebView Mock] Received requestSignature call:', message);
          this.messageListeners.forEach((listener) => listener(message));

          // Return a Promise that will be resolved/rejected based on user interaction
          return new Promise<SignatureResult>((resolve, reject) => {
            // Store the promise resolvers for this field
            this.pendingSignaturePromises.set(fieldId, { resolve, reject });

            // Show interactive popup for signature simulation
            this.showSignatureSimulationPopup(fieldId);
          });
        },
        requestLocation: (fieldId: string): Promise<LocationResult> => {
          const message = { type: 'requestLocation', fieldId };
          console.log('[WebView Mock] Received requestLocation call:', message);
          this.messageListeners.forEach((listener) => listener(message));

          return new Promise<LocationResult>((resolve, reject) => {
            // Store the promise callbacks for later resolution
            this.pendingLocationPromises.set(fieldId, { resolve, reject });

            // Show interactive popup for location simulation
            this.showLocationSimulationPopup(fieldId);
          });
        },
        requestVideo: (fieldId: string): Promise<VideoResult> => {
          const message = { type: 'requestVideo', fieldId };
          console.log('[WebView Mock] Received requestVideo call:', message);
          this.messageListeners.forEach((listener) => listener(message));

          return new Promise<VideoResult>((resolve, reject) => {
            // Store the promise callbacks for later resolution
            this.pendingVideoPromises.set(fieldId, { resolve, reject });

            // Show interactive popup for video simulation
            this.showVideoSimulationPopup(fieldId);
          });
        },
        requestFile: (fieldId: string): Promise<FileResult> => {
          const message = { type: 'requestFile', fieldId };
          console.log('[WebView Mock] Received requestFile call:', message);
          this.messageListeners.forEach((listener) => listener(message));

          // Return a Promise that will be resolved/rejected based on user interaction
          return new Promise<FileResult>((resolve, reject) => {
            // Store the promise resolvers for this field
            this.pendingFilePromises.set(fieldId, { resolve, reject });

            // Show interactive popup for file selection simulation
            this.showFileSimulationPopup(fieldId);
          });
        },
        requestAudio: (fieldId: string): Promise<AudioResult> => {
          const message = { type: 'requestAudio', fieldId };
          console.log('[WebView Mock] Received requestAudio call:', message);
          this.messageListeners.forEach((listener) => listener(message));

          // Return a Promise that will be resolved/rejected based on user interaction
          return new Promise<AudioResult>((resolve, reject) => {
            // Store the promise resolvers for this field
            this.pendingAudioPromises.set(fieldId, { resolve, reject });

            // Show interactive popup for audio recording simulation
            this.showAudioSimulationPopup(fieldId);
          });
        },
        launchIntent: (fieldId: string, intentData: Record<string, any>): Promise<void> => {
          const message = { type: 'launchIntent', fieldId, intentData };
          console.log('[WebView Mock] Received launchIntent call:', message);
          this.messageListeners.forEach((listener) => listener(message));
          return Promise.resolve();
        },
      } as any; // Use 'as any' to avoid full interface implementation
      console.log('[WebView Mock] Initialized mock globalThis.formulus interface');
    } else {
      console.log('[WebView Mock] globalThis.formulus already exists, not initializing mock');
    }

    // Mock the new getFormulus() function
    if (!(mockWindow as any).getFormulus) {
      (mockWindow as any).getFormulus = (): Promise<MockFormulus> => {
        console.log('[WebView Mock] getFormulus() called');
        return Promise.resolve(mockGlobal.formulus!);
      };
      console.log('[WebView Mock] Initialized mock getFormulus() function');
    } else {
      console.log('[WebView Mock] getFormulus() already exists, not initializing mock');
    }

    this.isActive = true;
  }

  // Add a listener for messages from the app
  public addMessageListener(listener: (message: any) => void): void {
    this.messageListeners.push(listener);
  }

  // Remove a message listener
  public removeMessageListener(listener: (message: any) => void): void {
    const index = this.messageListeners.indexOf(listener);
    if (index > -1) {
      this.messageListeners.splice(index, 1);
    }
  }

  // Simulate the native host calling onFormInit
  public simulateFormInit(data: FormInitData): void {
    const mockWindow = window as MockWindow;
    if (mockWindow.onFormInit) {
      console.log('[WebView Mock] Simulating onFormInit call with data:', data);
      mockWindow.onFormInit(data);
    } else {
      console.warn('[WebView Mock] onFormInit not available on window object');
    }
  }

  // Check if the mock is active
  public isActiveMock(): boolean {
    return this.isActive;
  }

  // Show interactive QR code simulation popup
  private showQrcodeSimulationPopup(fieldId: string): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const popup = document.createElement('div');
    popup.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      text-align: center;
    `;

    popup.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">📱 QR Code Scanner</h3>
      <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">Field: <code>${fieldId}</code></p>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button id="mock-success" style="
          padding: 12px 20px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        ">✅ Scan QR Code (Success)</button>
        
        <button id="mock-cancel" style="
          padding: 12px 20px;
          background: #FF9800;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        ">❌ Cancel</button>
        
        <button id="mock-error" style="
          padding: 12px 20px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        ">⚠️ Scanner Error</button>
      </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add button event listeners
    const successBtn = popup.querySelector('#mock-success');
    const cancelBtn = popup.querySelector('#mock-cancel');
    const errorBtn = popup.querySelector('#mock-error');

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    successBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateQrcodeSuccessResponse(fieldId);
    });

    cancelBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateQrcodeCancelResponse(fieldId);
    });

    errorBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateQrcodeErrorResponse(fieldId);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        this.simulateQrcodeCancelResponse(fieldId);
      }
    });
  }

  // Show interactive camera simulation popup
  private showCameraSimulationPopup(fieldId: string): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const popup = document.createElement('div');
    popup.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      text-align: center;
    `;

    popup.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">📸 Select Image</h3>
      <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">Field: <code>${fieldId}</code></p>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button id="mock-camera" style="
          padding: 12px 20px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        ">📷 Camera</button>
        
        <button id="mock-gallery" style="
          padding: 12px 20px;
          background: #2196F3;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        ">🖼️ Gallery</button>
        
        <button id="mock-cancel" style="
          padding: 12px 20px;
          background: #FF9800;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        ">❌ Cancel</button>
        
        <button id="mock-error" style="
          padding: 12px 20px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        ">⚠️ Error</button>
      </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add button event listeners
    const cameraBtn = popup.querySelector('#mock-camera');
    const galleryBtn = popup.querySelector('#mock-gallery');
    const cancelBtn = popup.querySelector('#mock-cancel');
    const errorBtn = popup.querySelector('#mock-error');

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    cameraBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateSuccessResponse(fieldId, 'camera');
    });

    galleryBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateSuccessResponse(fieldId, 'gallery');
    });

    cancelBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateCancelResponse(fieldId);
    });

    errorBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateErrorResponse(fieldId);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        this.simulateCancelResponse(fieldId);
      }
    });
  }

  // Show interactive signature simulation popup
  private showSignatureSimulationPopup(fieldId: string): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const popup = document.createElement('div');
    popup.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      text-align: center;
    `;

    popup.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">✍️ Signature Capture</h3>
      <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">Field: <code>${fieldId}</code></p>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button id="mock-success" style="
          padding: 12px 20px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        ">✅ Capture Signature (Success)</button>
        
        <button id="mock-cancel" style="
          padding: 12px 20px;
          background: #FF9800;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        ">❌ Cancel</button>
        
        <button id="mock-error" style="
          padding: 12px 20px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        ">⚠️ Capture Error</button>
      </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add button event listeners
    const successBtn = popup.querySelector('#mock-success');
    const cancelBtn = popup.querySelector('#mock-cancel');
    const errorBtn = popup.querySelector('#mock-error');

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    successBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateSignatureSuccessResponse(fieldId);
    });

    cancelBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateSignatureCancelResponse(fieldId);
    });

    errorBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateSignatureErrorResponse(fieldId);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        this.simulateSignatureCancelResponse(fieldId);
      }
    });
  }

  // Simulate successful camera response with GUID
  private simulateSuccessResponse(fieldId: string, source?: 'camera' | 'gallery'): void {
    // Generate GUID for mock image
    const generateGUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    const imageGuid = generateGUID();
    // Use the actual dummy photo from public folder for browser testing
    const dummyPhotoUrl = `${window.location.origin}/dummyphoto.png`;

    const mockCameraResult: CameraResult = {
      fieldId,
      status: 'success',
      data: {
        type: 'image',
        id: imageGuid,
        filename: `${imageGuid}.jpg`,
        uri: dummyPhotoUrl, // Use the dummy photo URL as the URI for display
        url: dummyPhotoUrl, // For compatibility with CameraResultData.url
        timestamp: new Date().toISOString(),
        metadata: {
          width: 1920,
          height: 1080,
          size: 17982, // Approximate size of a small PNG
          mimeType: 'image/png',
          source: source === 'gallery' ? 'webview_mock_gallery' : 'webview_mock_camera',
          quality: 0.8,
          persistentStorage: true,
          storageLocation: 'mock/storage/images',
        },
      },
    };

    console.log('[WebView Mock] Simulating successful camera response:', mockCameraResult);

    // Resolve the pending Promise for this field
    const pendingPromise = this.pendingCameraPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.resolve(mockCameraResult);
      this.pendingCameraPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending camera promise found for field:', fieldId);
    }
  }

  // Simulate camera cancellation
  private simulateCancelResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating camera cancellation for field:', fieldId);

    const cameraResult: CameraResult = {
      fieldId,
      status: 'cancelled',
      message: 'User cancelled camera operation',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingCameraPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(cameraResult);
      this.pendingCameraPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending camera promise found for field:', fieldId);
    }
  }

  // Simulate camera error
  private simulateErrorResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating camera error for field:', fieldId);

    const cameraResult: CameraResult = {
      fieldId,
      status: 'error',
      message: 'Camera failed to open',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingCameraPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(cameraResult);
      this.pendingCameraPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending camera promise found for field:', fieldId);
    }
  }

  // Simulate successful QR code response
  private simulateQrcodeSuccessResponse(fieldId: string): void {
    // Sample QR code values for testing
    const sampleQrCodes = [
      'https://example.com',
      'Hello World!',
      'QR_CODE_12345',
      '{"type":"contact","name":"John Doe","phone":"123-456-7890"}',
      'WIFI:T:WPA;S:MyNetwork;P:password123;;',
    ];

    const randomQrCode = sampleQrCodes[Math.floor(Math.random() * sampleQrCodes.length)];

    const mockQrcodeResult: QrcodeResult = {
      fieldId,
      status: 'success',
      data: {
        type: 'qrcode',
        value: randomQrCode,
        timestamp: new Date().toISOString(),
      },
    };

    console.log('[WebView Mock] Simulating successful QR code response:', mockQrcodeResult);

    // Resolve the pending Promise for this field
    const pendingPromise = this.pendingQrcodePromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.resolve(mockQrcodeResult);
      this.pendingQrcodePromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending QR code promise found for field:', fieldId);
    }
  }

  // Simulate QR code cancellation
  private simulateQrcodeCancelResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating QR code cancellation for field:', fieldId);

    const qrcodeResult: QrcodeResult = {
      fieldId,
      status: 'cancelled',
      message: 'User cancelled QR code scanning',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingQrcodePromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(qrcodeResult);
      this.pendingQrcodePromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending QR code promise found for field:', fieldId);
    }
  }

  // Simulate QR code error
  private simulateQrcodeErrorResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating QR code error for field:', fieldId);

    const qrcodeResult: QrcodeResult = {
      fieldId,
      status: 'error',
      message: 'QR code scanner failed to open',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingQrcodePromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(qrcodeResult);
      this.pendingQrcodePromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending QR code promise found for field:', fieldId);
    }
  }

  // Manually simulate a camera response for testing (keeping for DevTestbed)
  public simulateCameraResponse(fieldId: string): void {
    this.simulateSuccessResponse(fieldId);
  }

  // Simulate successful signature response
  private simulateSignatureSuccessResponse(fieldId: string): void {
    // Generate GUID for mock signature
    const generateGUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    const signatureGuid = generateGUID();
    // Create a simple mock signature as base64 SVG
    const mockSignatureSvg = `<svg width="300" height="150" xmlns="http://www.w3.org/2000/svg">
      <path d="M10,75 Q50,25 100,75 T200,75 Q250,50 290,75" stroke="black" stroke-width="2" fill="none"/>
      <text x="10" y="140" font-family="Arial" font-size="12" fill="gray">Mock Signature</text>
    </svg>`;
    const base64Signature = btoa(mockSignatureSvg);
    const dataUrl = `data:image/svg+xml;base64,${base64Signature}`;

    const mockSignatureResult: SignatureResult = {
      fieldId,
      status: 'success',
      data: {
        type: 'signature',
        filename: `${signatureGuid}.svg`,
        uri: dataUrl, // Use URI instead of base64 and url
        timestamp: new Date().toISOString(),
        metadata: {
          width: 300,
          height: 150,
          size: mockSignatureSvg.length,
          strokeCount: 1,
        },
      },
    };

    console.log('[WebView Mock] Simulating successful signature response:', mockSignatureResult);

    // Resolve the pending Promise for this field
    const pendingPromise = this.pendingSignaturePromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.resolve(mockSignatureResult);
      this.pendingSignaturePromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending signature promise found for field:', fieldId);
    }
  }

  // Simulate signature cancellation
  private simulateSignatureCancelResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating signature cancellation for field:', fieldId);

    const signatureResult: SignatureResult = {
      fieldId,
      status: 'cancelled',
      message: 'User cancelled signature capture',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingSignaturePromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(signatureResult);
      this.pendingSignaturePromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending signature promise found for field:', fieldId);
    }
  }

  // Simulate signature error
  private simulateSignatureErrorResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating signature error for field:', fieldId);

    const signatureResult: SignatureResult = {
      fieldId,
      status: 'error',
      message: 'Signature capture failed to initialize',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingSignaturePromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(signatureResult);
      this.pendingSignaturePromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending signature promise found for field:', fieldId);
    }
  }

  // Manually simulate a QR code response for testing (keeping for DevTestbed)
  public simulateQrcodeResponse(fieldId: string): void {
    this.simulateQrcodeSuccessResponse(fieldId);
  }

  // Manually simulate a signature response for testing (keeping for DevTestbed)
  public simulateSignatureResponse(fieldId: string): void {
    this.simulateSignatureSuccessResponse(fieldId);
  }

  // Simulate successful file selection response
  private simulateFileSuccessResponse(fieldId: string, mimeType: string, filename: string): void {
    // Generate GUID for file
    const generateGUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    const fileGuid = generateGUID();
    const extension = filename.split('.').pop() || '';
    const mockFileSize = Math.floor(Math.random() * 1000000) + 50000; // 50KB to 1MB
    const mockUri = `file:///storage/emulated/0/Android/data/com.formulus/files/${fileGuid}.${extension}`;

    const mockFileResult: FileResult = {
      fieldId,
      status: 'success',
      data: {
        type: 'file',
        filename,
        uri: mockUri,
        mimeType,
        size: mockFileSize,
        timestamp: new Date().toISOString(),
        metadata: {
          extension,
          originalPath: `/storage/emulated/0/Download/${filename}`,
        },
      },
    };

    console.log('[WebView Mock] Simulating successful file selection response:', mockFileResult);

    // Resolve the pending Promise for this field
    const pendingPromise = this.pendingFilePromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.resolve(mockFileResult);
      this.pendingFilePromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending file promise found for field:', fieldId);
    }
  }

  // Simulate file selection cancellation
  private simulateFileCancelResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating file selection cancellation for field:', fieldId);

    const fileResult: FileResult = {
      fieldId,
      status: 'cancelled',
      message: 'User cancelled file selection',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingFilePromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(fileResult);
      this.pendingFilePromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending file promise found for field:', fieldId);
    }
  }

  // Simulate file selection error
  private simulateFileErrorResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating file selection error for field:', fieldId);

    const fileResult: FileResult = {
      fieldId,
      status: 'error',
      message: 'File selection failed: Permission denied',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingFilePromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(fileResult);
      this.pendingFilePromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending file promise found for field:', fieldId);
    }
  }

  // Manually simulate a file response for testing (keeping for DevTestbed)
  public simulateFileResponse(fieldId: string): void {
    this.simulateFileSuccessResponse(fieldId, 'application/pdf', 'test-document.pdf');
  }

  // Show audio recording simulation popup
  private showAudioSimulationPopup(fieldId: string): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const popup = document.createElement('div');
    popup.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 350px;
      text-align: center;
      max-width: 90vw;
    `;

    popup.innerHTML = `
      <div style="margin-bottom: 20px;">
        <div style="width: 60px; height: 60px; background: #FF3B30; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
          <div style="width: 20px; height: 20px; background: white; border-radius: 50%;"></div>
        </div>
        <h3 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">Audio Recording Simulation</h3>
        <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">Field ID: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">${fieldId}</code></p>
      </div>
      
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <button id="audio-success" style="background: #34C759; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">
          🎤 Record Success
        </button>
        <button id="audio-cancel" style="background: #FF9500; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">
          ❌ Cancel
        </button>
        <button id="audio-error" style="background: #8E8E93; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">
          ⚠️ Error
        </button>
      </div>
      
      <p style="margin: 20px 0 0 0; color: #999; font-size: 12px;">
        Simulate audio recording interaction for development testing
      </p>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add button event listeners
    const successBtn = popup.querySelector('#audio-success');
    const cancelBtn = popup.querySelector('#audio-cancel');
    const errorBtn = popup.querySelector('#audio-error');

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    successBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateAudioSuccessResponse(fieldId);
    });

    cancelBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateAudioCancelResponse(fieldId);
    });

    errorBtn?.addEventListener('click', () => {
      cleanup();
      this.simulateAudioErrorResponse(fieldId);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        this.simulateAudioCancelResponse(fieldId);
      }
    });
  }

  // Simulate successful audio recording response
  private simulateAudioSuccessResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating audio recording success for field:', fieldId);

    // Generate mock audio file data
    const mockFilename = `audio_${Date.now()}.m4a`;
    const mockUri = `file:///mock/audio/cache/${mockFilename}`;
    const dummyAudioUrl = `${window.location.origin}/dummyaudio.m4a`;
    const base64Placeholder = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='; // tiny WAV header stub

    const audioResult: AudioResult = {
      fieldId,
      status: 'success',
      data: {
        type: 'audio',
        filename: mockFilename,
        base64: base64Placeholder,
        url: dummyAudioUrl,
        timestamp: new Date().toISOString(),
        metadata: {
          duration: 15.5, // 15.5 seconds
          format: 'm4a',
          sampleRate: 44100,
          channels: 2,
          size: 245760, // ~240KB
        },
      },
    };

    // Resolve the pending Promise for this field
    const pendingPromise = this.pendingAudioPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.resolve(audioResult);
      this.pendingAudioPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending audio promise found for field:', fieldId);
    }
  }

  // Simulate audio recording cancellation
  private simulateAudioCancelResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating audio recording cancellation for field:', fieldId);

    const audioResult: AudioResult = {
      fieldId,
      status: 'cancelled',
      message: 'Audio recording was cancelled by user',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingAudioPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(audioResult);
      this.pendingAudioPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending audio promise found for field:', fieldId);
    }
  }

  // Simulate audio recording error
  private simulateAudioErrorResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating audio recording error for field:', fieldId);

    const audioResult: AudioResult = {
      fieldId,
      status: 'error',
      message: 'Microphone permission denied',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingAudioPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(audioResult);
      this.pendingAudioPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending audio promise found for field:', fieldId);
    }
  }

  // Manually simulate an audio response for testing (keeping for DevTestbed)
  public simulateAudioResponse(fieldId: string): void {
    this.simulateAudioSuccessResponse(fieldId);
  }

  // Show location capture simulation popup
  private showLocationSimulationPopup(fieldId: string): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const popup = document.createElement('div');
    popup.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 350px;
      text-align: center;
      max-width: 90vw;
    `;

    popup.innerHTML = `
      <h3 style="margin: 0 0 20px 0; color: #333; font-size: 20px;">📍 GPS Location Request</h3>
      <p style="margin: 0 0 25px 0; color: #666; line-height: 1.5;">
        Simulate capturing GPS location for field: <strong>${fieldId}</strong>
      </p>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <button id="location-success" style="
          background: #4CAF50;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background-color 0.2s;
        ">✓ Capture Location</button>
        <button id="location-cancel" style="
          background: #757575;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background-color 0.2s;
        ">✕ Cancel</button>
        <button id="location-error" style="
          background: #f44336;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background-color 0.2s;
        ">⚠ Permission Denied</button>
      </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add hover effects
    const buttons = popup.querySelectorAll('button');
    buttons.forEach((button) => {
      button.addEventListener('mouseenter', () => {
        (button as HTMLElement).style.opacity = '0.8';
      });
      button.addEventListener('mouseleave', () => {
        (button as HTMLElement).style.opacity = '1';
      });
    });

    // Handle button clicks
    popup.querySelector('#location-success')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      this.simulateLocationSuccessResponse(fieldId);
    });

    popup.querySelector('#location-cancel')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      this.simulateLocationCancelResponse(fieldId);
    });

    popup.querySelector('#location-error')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      this.simulateLocationErrorResponse(fieldId);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        this.simulateLocationCancelResponse(fieldId);
      }
    });
  }

  // Simulate successful location capture
  private simulateLocationSuccessResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating successful location capture for field:', fieldId);

    const locationResult: LocationResult = {
      fieldId,
      status: 'success',
      data: {
        type: 'location',
        latitude: 37.7749, // San Francisco coordinates
        longitude: -122.4194,
        accuracy: 5.0,
        altitude: 52.0,
        altitudeAccuracy: 3.0,
        timestamp: new Date().toISOString(),
      },
    };

    // Resolve the pending Promise for this field
    const pendingPromise = this.pendingLocationPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.resolve(locationResult);
      this.pendingLocationPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending location promise found for field:', fieldId);
    }
  }

  // Simulate cancelled location capture
  private simulateLocationCancelResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating cancelled location capture for field:', fieldId);

    const locationResult: LocationResult = {
      fieldId,
      status: 'cancelled',
      message: 'Location capture was cancelled by user',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingLocationPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(locationResult);
      this.pendingLocationPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending location promise found for field:', fieldId);
    }
  }

  // Simulate location capture error
  private simulateLocationErrorResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating location capture error for field:', fieldId);

    const locationResult: LocationResult = {
      fieldId,
      status: 'error',
      message: 'Location permission denied',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingLocationPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(locationResult);
      this.pendingLocationPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending location promise found for field:', fieldId);
    }
  }

  // Manually simulate a location response for testing (keeping for DevTestbed)
  public simulateLocationResponse(fieldId: string): void {
    this.simulateLocationSuccessResponse(fieldId);
  }

  // Show video recording simulation popup
  private showVideoSimulationPopup(fieldId: string): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const popup = document.createElement('div');
    popup.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 350px;
      text-align: center;
      max-width: 90vw;
    `;

    popup.innerHTML = `
      <h3 style="margin: 0 0 20px 0; color: #333; font-size: 20px;">🎥 Video Recording Request</h3>
      <p style="margin: 0 0 25px 0; color: #666; line-height: 1.5;">
        Simulate video recording for field: <strong>${fieldId}</strong>
      </p>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <button id="video-success" style="
          background: #4CAF50;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background-color 0.2s;
        ">✓ Record Video</button>
        <button id="video-cancel" style="
          background: #757575;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background-color 0.2s;
        ">✕ Cancel</button>
        <button id="video-error" style="
          background: #f44336;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background-color 0.2s;
        ">⚠ Permission Denied</button>
      </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add hover effects
    const buttons = popup.querySelectorAll('button');
    buttons.forEach((button) => {
      button.addEventListener('mouseenter', () => {
        (button as HTMLElement).style.opacity = '0.8';
      });
      button.addEventListener('mouseleave', () => {
        (button as HTMLElement).style.opacity = '1';
      });
    });

    // Handle button clicks
    popup.querySelector('#video-success')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      this.simulateVideoSuccessResponse(fieldId);
    });

    popup.querySelector('#video-cancel')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      this.simulateVideoCancelResponse(fieldId);
    });

    popup.querySelector('#video-error')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
      this.simulateVideoErrorResponse(fieldId);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        this.simulateVideoCancelResponse(fieldId);
      }
    });
  }

  // Simulate successful video recording
  private simulateVideoSuccessResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating successful video recording for field:', fieldId);

    const videoResult: VideoResult = {
      fieldId,
      status: 'success',
      data: {
        type: 'video',
        filename: `video_${Date.now()}.mp4`,
        uri: `file:///mock/videos/video_${Date.now()}.mp4`,
        timestamp: new Date().toISOString(),
        metadata: {
          duration: 15.5, // 15.5 seconds
          format: 'mp4',
          size: 2048576, // 2MB
          width: 1920,
          height: 1080,
        },
      },
    };

    // Resolve the pending Promise for this field
    const pendingPromise = this.pendingVideoPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.resolve(videoResult);
      this.pendingVideoPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending video promise found for field:', fieldId);
    }
  }

  // Simulate cancelled video recording
  private simulateVideoCancelResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating cancelled video recording for field:', fieldId);

    const videoResult: VideoResult = {
      fieldId,
      status: 'cancelled',
      message: 'Video recording was cancelled by user',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingVideoPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(videoResult);
      this.pendingVideoPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending video promise found for field:', fieldId);
    }
  }

  // Simulate video recording error
  private simulateVideoErrorResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating video recording error for field:', fieldId);

    const videoResult: VideoResult = {
      fieldId,
      status: 'error',
      message: 'Camera permission denied',
    };

    // Reject the pending Promise for this field
    const pendingPromise = this.pendingVideoPromises.get(fieldId);
    if (pendingPromise) {
      pendingPromise.reject(videoResult);
      this.pendingVideoPromises.delete(fieldId);
    } else {
      console.warn('[WebView Mock] No pending video promise found for field:', fieldId);
    }
  }

  // Manually simulate a video response for testing (keeping for DevTestbed)
  public simulateVideoResponse(fieldId: string): void {
    this.simulateVideoSuccessResponse(fieldId);
  }

  // Show file selection simulation popup
  private showFileSimulationPopup(fieldId: string): void {
    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 2px solid #007AFF;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-width: 300px;
      text-align: center;
    `;

    popup.innerHTML = `
      <h3 style="margin: 0 0 15px 0; color: #333;">File Selection Simulation</h3>
      <p style="margin: 0 0 20px 0; color: #666;">Field ID: <code>${fieldId}</code></p>
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        <button id="file-success" style="background: #007AFF; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Select PDF</button>
        <button id="file-image" style="background: #34C759; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Select Image</button>
        <button id="file-document" style="background: #FF9500; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Select Document</button>
        <button id="file-cancel" style="background: #FF3B30; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Cancel</button>
        <button id="file-error" style="background: #8E8E93; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Error</button>
      </div>
      <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">Choose an option to simulate file selection</p>
    `;

    document.body.appendChild(popup);

    // Add event listeners
    popup.querySelector('#file-success')?.addEventListener('click', () => {
      this.simulateFileSuccessResponse(fieldId, 'application/pdf', 'document.pdf');
      document.body.removeChild(popup);
    });

    popup.querySelector('#file-image')?.addEventListener('click', () => {
      this.simulateFileSuccessResponse(fieldId, 'image/jpeg', 'photo.jpg');
      document.body.removeChild(popup);
    });

    popup.querySelector('#file-document')?.addEventListener('click', () => {
      this.simulateFileSuccessResponse(
        fieldId,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'report.docx',
      );
      document.body.removeChild(popup);
    });

    popup.querySelector('#file-cancel')?.addEventListener('click', () => {
      this.simulateFileCancelResponse(fieldId);
      document.body.removeChild(popup);
    });

    popup.querySelector('#file-error')?.addEventListener('click', () => {
      this.simulateFileErrorResponse(fieldId);
      document.body.removeChild(popup);
    });

    // Close on background click
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', () => {
      this.simulateFileCancelResponse(fieldId);
      document.body.removeChild(popup);
      document.body.removeChild(overlay);
    });
  }

  // Clean up the mock
  public destroy(): void {
    if (this.isActive) {
      const mockWindow = window as MockWindow;
      delete mockWindow.ReactNativeWebView;
      this.messageListeners = [];

      // Reject any pending camera promises
      this.pendingCameraPromises.forEach((promise, fieldId) => {
        promise.reject({
          fieldId,
          status: 'error',
          message: 'WebView mock destroyed',
        } as CameraResult);
      });
      this.pendingCameraPromises.clear();

      // Reject any pending QR code promises
      this.pendingQrcodePromises.forEach((promise, fieldId) => {
        promise.reject({
          fieldId,
          status: 'error',
          message: 'WebView mock destroyed',
        } as QrcodeResult);
      });
      this.pendingQrcodePromises.clear();

      this.isActive = false;
      console.log('[WebView Mock] Destroyed mock ReactNativeWebView interface');
    }
  }
}

// Test case: UI schema with Group root (should be wrapped in SwipeLayout)
export const sampleFormDataWithGroupRoot: FormInitData = {
  formType: 'test-group-root',
  observationId: null,
  params: {},
  savedData: {},
  formSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 3 },
      email: { type: 'string', format: 'email' },
    },
  },
  uiSchema: {
    type: 'Group',
    label: 'User Information',
    elements: [
      { type: 'Control', scope: '#/properties/name' },
      { type: 'Control', scope: '#/properties/email' },
    ],
  },
};

// Test case: UI schema with VerticalLayout root (should be wrapped in SwipeLayout)
export const sampleFormDataWithVerticalLayoutRoot: FormInitData = {
  formType: 'test-vertical-layout-root',
  observationId: null,
  params: {},
  savedData: {},
  formSchema: {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
    },
  },
  uiSchema: {
    type: 'VerticalLayout',
    elements: [
      { type: 'Control', scope: '#/properties/firstName' },
      { type: 'Control', scope: '#/properties/lastName' },
    ],
  },
};

// Test case: Multiple root elements (should be wrapped in SwipeLayout)
export const sampleFormDataWithMultipleRoots: FormInitData = {
  formType: 'test-multiple-roots',
  observationId: null,
  params: {},
  savedData: {},
  formSchema: {
    type: 'object',
    properties: {
      section1: { type: 'string' },
      section2: { type: 'string' },
    },
  },
  uiSchema: [
    {
      type: 'VerticalLayout',
      elements: [{ type: 'Control', scope: '#/properties/section1' }],
    },
    {
      type: 'VerticalLayout',
      elements: [{ type: 'Control', scope: '#/properties/section2' }],
    },
  ] as any,
};

// Create and export a singleton instance
export const webViewMock = new WebViewMock();

// Sample form data for testing
export const sampleFormData = {
  formType: 'TestForm',
  observationId: null, // New form, no observation ID yet
  params: {
    defaultData: {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    },
  },
  savedData: {
    name: 'John Doe',
    vegetarian: false,
    birthDate: '1985-06-02',
    nationality: 'US',
    personalData: {
      age: 34,
      height: 180,
      drivingSkill: 8,
    },
    occupation: 'Employee',
    postalCode: '12345',
    employmentDetails: {
      companyName: 'Tech Corp',
      yearsOfExperience: 10,
      salary: 75000,
    },
    contactInfo: {
      email: 'john.doe@example.com',
      phone: '1234567890',
      address: '123 Main Street, City, State',
    },
  },
  formSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 3,
        description: 'Please enter your name',
      },
      vegetarian: {
        type: 'boolean',
      },
      birthDate: {
        type: 'string',
        format: 'date',
      },
      nationality: {
        type: 'string',
        enum: ['DE', 'IT', 'JP', 'US', 'RU', 'Other'],
      },
      profilePhoto: {
        type: 'object',
        format: 'photo',
        title: 'Profile Photo',
        description: 'Take a photo for your profile',
      },
      qrCodeData: {
        type: 'string',
        format: 'qrcode',
        title: 'QR Code Scanner',
        description: 'Scan a QR code or enter data manually',
      },
      userSignature: {
        type: 'string',
        format: 'signature',
        title: 'Digital Signature',
        description: 'Please provide your signature',
      },
      personalData: {
        type: 'object',
        properties: {
          age: {
            type: 'integer',
            description: 'Please enter your age.',
            minimum: 18,
            maximum: 120,
          },
          height: {
            type: 'number',
            minimum: 50,
            maximum: 250,
            description: 'Height in centimeters',
          },
          drivingSkill: {
            type: 'number',
            maximum: 10,
            minimum: 1,
            default: 7,
          },
        },
        required: [],
      },
      occupation: {
        type: 'string',
        enum: [
          'Accountant',
          'Engineer',
          'Freelancer',
          'Journalism',
          'Physician',
          'Student',
          'Teacher',
          'Other',
        ],
      },
      postalCode: {
        type: 'string',
        maxLength: 5,
        pattern: '^[0-9]{5}$',
      },
      employmentDetails: {
        type: 'object',
        properties: {
          companyName: {
            type: 'string',
            minLength: 2,
          },
          yearsOfExperience: {
            type: 'integer',
            minimum: 0,
            maximum: 50,
          },
          salary: {
            type: 'number',
            minimum: 0,
            maximum: 999999999,
          },
          startDate: {
            type: 'string',
            format: 'date',
          },
        },
        required: [],
      },
      contactInfo: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
          },
          phone: {
            type: 'string',
            pattern: '^[0-9]{10}$',
          },
          address: {
            type: 'string',
            minLength: 5,
          },
        },
        required: [],
      },
    },
    required: ['name'],
  },
  uiSchema: {
    type: 'SwipeLayout',
    elements: [
      {
        type: 'VerticalLayout',
        elements: [
          {
            type: 'Label',
            text: 'Basic Information',
          },
          {
            type: 'Control',
            scope: '#/properties/name',
          },
          {
            type: 'Control',
            scope: '#/properties/birthDate',
          },
          {
            type: 'Control',
            scope: '#/properties/nationality',
          },
          {
            type: 'Control',
            scope: '#/properties/vegetarian',
          },
          {
            type: 'Control',
            scope: '#/properties/profilePhoto',
          },
          {
            type: 'Control',
            scope: '#/properties/qrCodeData',
          },
        ],
      },
      {
        type: 'VerticalLayout',
        elements: [
          {
            type: 'Label',
            text: 'Personal Details',
          },
          {
            type: 'HorizontalLayout',
            elements: [
              {
                type: 'Control',
                scope: '#/properties/personalData/properties/age',
              },
              {
                type: 'Control',
                scope: '#/properties/personalData/properties/height',
              },
              {
                type: 'Control',
                scope: '#/properties/personalData/properties/drivingSkill',
              },
            ],
          },
          {
            type: 'Control',
            scope: '#/properties/occupation',
          },
        ],
      },
      {
        type: 'VerticalLayout',
        elements: [
          {
            type: 'Label',
            text: 'Employment Information',
          },
          {
            type: 'Control',
            scope: '#/properties/employmentDetails/properties/companyName',
          },
          {
            type: 'Control',
            scope: '#/properties/employmentDetails/properties/yearsOfExperience',
          },
          {
            type: 'Control',
            scope: '#/properties/employmentDetails/properties/salary',
          },
        ],
      },
      {
        type: 'VerticalLayout',
        elements: [
          {
            type: 'Label',
            text: 'Contact Information',
          },
          {
            type: 'HorizontalLayout',
            elements: [
              {
                type: 'Control',
                scope: '#/properties/contactInfo/properties/email',
              },
              {
                type: 'Control',
                scope: '#/properties/contactInfo/properties/phone',
              },
              {
                type: 'Control',
                scope: '#/properties/contactInfo/properties/address',
              },
            ],
          },
          {
            type: 'Control',
            scope: '#/properties/postalCode',
          },
        ],
      },
      {
        type: 'VerticalLayout',
        elements: [
          {
            type: 'Label',
            text: 'Media & Signatures',
          },
          {
            type: 'Control',
            scope: '#/properties/profilePhoto',
          },
          {
            type: 'Control',
            scope: '#/properties/qrCodeData',
          },
          {
            type: 'Control',
            scope: '#/properties/userSignature',
          },
        ],
      },
    ],
  },
};
