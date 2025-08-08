// Mock implementation of ReactNativeWebView for development testing
import { FormInitData } from './FormulusInterfaceDefinition';

interface MockWebView {
  postMessage: (message: string) => void;
}

interface MockFormulus {
  submitObservation: (formType: string, finalData: Record<string, any>) => Promise<void>;
  updateObservation: (observationId: string, formType: string, finalData: Record<string, any>) => Promise<void>;
  savePartial: (formType: string, data: Record<string, any>) => Promise<void>;
  requestCamera: (fieldId: string) => Promise<void>;
  requestLocation: (fieldId: string) => Promise<void>;
  requestFile: (fieldId: string) => Promise<void>;
  launchIntent: (fieldId: string, intentSpec: Record<string, any>) => Promise<void>;
}

type MockWindow = Window & {
  ReactNativeWebView?: MockWebView;
  onFormInit?: (data: FormInitData) => void;
}

type MockGlobalThis = typeof globalThis & {
  formulus?: MockFormulus;
};

class WebViewMock {
  private messageListeners: ((message: any) => void)[] = [];
  private isActive = false;

  // Mock the postMessage function that the app uses to send messages to native
  private postMessage = (message: string) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log('[WebView Mock] Received message from app:', parsedMessage);
      
      // Handle specific message types
      if (parsedMessage.type === 'formplayerReadyToReceiveInit') {
        console.log('[WebView Mock] App is ready to receive init data');
        // Notify any listeners that the app is ready
        this.messageListeners.forEach(listener => listener(parsedMessage));
        
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
    if (this.isActive) {
      console.log('[WebView Mock] Already active, returning early');
      return;
    }
    
    const mockWindow = window as MockWindow;
    const mockGlobal = globalThis as MockGlobalThis;
    console.log('[WebView Mock] Checking if ReactNativeWebView exists:', !!mockWindow.ReactNativeWebView);
    
    // Only initialize if ReactNativeWebView doesn't already exist
    if (!mockWindow.ReactNativeWebView) {
      mockWindow.ReactNativeWebView = {
        postMessage: this.postMessage
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
          this.messageListeners.forEach(listener => listener(message));
          return Promise.resolve();
        },
        updateObservation: (observationId: string, formType: string, data: Record<string, any>): Promise<void> => {
          const message = { type: 'updateObservation', observationId, formType, data };
          console.log('[WebView Mock] Received updateObservation call:', message);
          this.messageListeners.forEach(listener => listener(message));
          return Promise.resolve();
        },
        savePartial: (formType: string, data: Record<string, any>): Promise<void> => {
          const message = { type: 'savePartial', formType, data };
          console.log('[WebView Mock] Received savePartial call:', message);
          this.messageListeners.forEach(listener => listener(message));
          return Promise.resolve();
        },
        requestCamera: (fieldId: string): Promise<void> => {
          const message = { type: 'requestCamera', fieldId };
          console.log('[WebView Mock] Received requestCamera call:', message);
          this.messageListeners.forEach(listener => listener(message));
          
          // Show interactive popup for camera simulation
          this.showCameraSimulationPopup(fieldId);
          
          return Promise.resolve();
        },
        requestLocation: (fieldId: string): Promise<void> => {
          const message = { type: 'requestLocation', fieldId };
          console.log('[WebView Mock] Received requestLocation call:', message);
          this.messageListeners.forEach(listener => listener(message));
          return Promise.resolve();
        },
        requestFile: (fieldId: string): Promise<void> => {
          const message = { type: 'requestFile', fieldId };
          console.log('[WebView Mock] Received requestFile call:', message);
          this.messageListeners.forEach(listener => listener(message));
          return Promise.resolve();
        },
        launchIntent: (fieldId: string, intentData: Record<string, any>): Promise<void> => {
          const message = { type: 'launchIntent', fieldId, intentData };
          console.log('[WebView Mock] Received launchIntent call:', message);
          this.messageListeners.forEach(listener => listener(message));
          return Promise.resolve();
        }
      } as any; // Use 'as any' to avoid full interface implementation
      console.log('[WebView Mock] Initialized mock globalThis.formulus interface');
    } else {
      console.log('[WebView Mock] globalThis.formulus already exists, not initializing mock');
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
      <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">📸 Camera Simulation</h3>
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
        ">✅ Take Photo (Success)</button>
        
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
        ">⚠️ Camera Error</button>
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
      this.simulateSuccessResponse(fieldId);
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

  // Simulate successful camera response
  private simulateSuccessResponse(fieldId: string): void {
    const filename = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const mockImageBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
    
    const attachmentData = {
      fieldId,
      type: 'image' as const,
      filename,
      base64: mockImageBase64,
      url: `data:image/jpeg;base64,${mockImageBase64}`,
      timestamp: new Date().toISOString(),
      metadata: {
        width: 1920,
        height: 1080,
        size: 2048,
        mimeType: 'image/jpeg',
        source: 'camera_simulation',
        quality: 0.8
      }
    };
    
    console.log('[WebView Mock] Simulating successful camera response:', attachmentData);
    this.sendAttachmentData(attachmentData);
  }

  // Simulate camera cancellation
  private simulateCancelResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating camera cancellation for field:', fieldId);
    // Send a cancel event to reject the Promise
    this.sendCameraEvent(fieldId, 'cancel', 'User cancelled camera operation');
  }

  // Simulate camera error
  private simulateErrorResponse(fieldId: string): void {
    console.log('[WebView Mock] Simulating camera error for field:', fieldId);
    // Send an error event to reject the Promise
    this.sendCameraEvent(fieldId, 'error', 'Camera failed to open');
  }

  // Send camera event (cancel/error) to reject Promise
  private sendCameraEvent(fieldId: string, eventType: 'cancel' | 'error', message: string): void {
    if (typeof (globalThis as any).onCameraEvent === 'function') {
      console.log(`[WebView Mock] Sending camera ${eventType} event:`, { fieldId, eventType, message });
      (globalThis as any).onCameraEvent({ fieldId, eventType, message });
    } else {
      console.warn('[WebView Mock] globalThis.onCameraEvent is not available');
    }
  }

  // Helper method to send attachment data
  private sendAttachmentData(attachmentData: any): void {
    if (typeof (globalThis as any).onAttachmentReady === 'function') {
      console.log('[WebView Mock] Calling globalThis.onAttachmentReady with:', attachmentData);
      (globalThis as any).onAttachmentReady(attachmentData);
    } else {
      console.warn('[WebView Mock] globalThis.onAttachmentReady is not available:', typeof (globalThis as any).onAttachmentReady);
      console.log('[WebView Mock] Available globalThis properties:', Object.keys(globalThis).filter(k => k.includes('on') || k.includes('formulus')));
    }
  }

  // Manually simulate a camera response for testing (keeping for DevTestbed)
  public simulateCameraResponse(fieldId: string): void {
    this.simulateSuccessResponse(fieldId);
  }

  // Clean up the mock
  public destroy(): void {
    if (this.isActive) {
      const mockWindow = window as MockWindow;
      delete mockWindow.ReactNativeWebView;
      this.messageListeners = [];
      this.isActive = false;
      console.log('[WebView Mock] Destroyed mock ReactNativeWebView interface');
    }
  }
}

// Export a singleton instance
export const webViewMock = new WebViewMock();

// Sample form data for testing
export const sampleFormData = {
  formType: 'TestForm', 
  observationId: null, // New form, no observation ID yet
  params: {
    defaultData: {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    }
  },
  savedData: {
      "name": "John Doe",
      "vegetarian": false,
      "birthDate": "1985-06-02",
      "nationality": "US",
      "personalData": {
          "age": 34,
          "height": 180,
          "drivingSkill": 8
      },
      "occupation": "Employee",
      "postalCode": "12345",
      "employmentDetails": {
          "companyName": "Tech Corp",
          "yearsOfExperience": 10,
          "salary": 75000
      },
      "contactInfo": {
          "email": "john.doe@example.com",
          "phone": "1234567890",
          "address": "123 Main Street, City, State"
      }
  },
  formSchema: {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "minLength": 3,
            "description": "Please enter your name"
        },
        "vegetarian": {
            "type": "boolean"
        },
        "birthDate": {
            "type": "string",
            "format": "date"
        },
        "nationality": {
            "type": "string",
            "enum": [
                "DE",
                "IT",
                "JP",
                "US",
                "RU",
                "Other"
            ]
        },
        "profilePhoto": {
            "type": "object",
            "format": "photo",
            "title": "Profile Photo",
            "description": "Take a photo for your profile"
        },
        "personalData": {
            "type": "object",
            "properties": {
                "age": {
                    "type": "integer",
                    "description": "Please enter your age.",
                    "minimum": 18,
                    "maximum": 120
                },
                "height": {
                    "type": "number",
                    "minimum": 50,
                    "maximum": 250,
                    "description": "Height in centimeters"
                },
                "drivingSkill": {
                    "type": "number",
                    "maximum": 10,
                    "minimum": 1,
                    "default": 7
                }
            },
            "required": []
        },
        "occupation": {
            "type": "string",
            "enum": [
                "Accountant",
                "Engineer",
                "Freelancer",
                "Journalism",
                "Physician",
                "Student",
                "Teacher",
                "Other"
            ]
        },
        "postalCode": {
            "type": "string",
            "maxLength": 5,
            "pattern": "^[0-9]{5}$"
        },
        "employmentDetails": {
            "type": "object",
            "properties": {
                "companyName": {
                    "type": "string",
                    "minLength": 2
                },
                "yearsOfExperience": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 50
                },
                "salary": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 999999999
                },
                "startDate": {
                    "type": "string",
                    "format": "date"
                }
            },
            "required": []
        },
        "contactInfo": {
            "type": "object",
            "properties": {
                "email": {
                    "type": "string",
                    "format": "email"
                },
                "phone": {
                    "type": "string",
                    "pattern": "^[0-9]{10}$"
                },
                "address": {
                    "type": "string",
                    "minLength": 5
                }
            },
            "required": []
        }
    },
    "required": [
        "name"
    ]
  },
  uiSchema: {
    "type": "SwipeLayout",
    "elements": [
        {
            "type": "VerticalLayout",
            "elements": [
                {
                    "type": "Label",
                    "text": "Basic Information"
                },
                {
                    "type": "Control",
                    "scope": "#/properties/name"
                },
                {
                    "type": "Control",
                    "scope": "#/properties/birthDate"
                },
                {
                    "type": "Control",
                    "scope": "#/properties/nationality"
                },
                {
                    "type": "Control",
                    "scope": "#/properties/vegetarian"
                },
                {
                    "type": "Control",
                    "scope": "#/properties/profilePhoto"
                }
            ]
        },
        {
            "type": "VerticalLayout",
            "elements": [
                {
                    "type": "Label",
                    "text": "Personal Details"
                },
                {
                    "type": "HorizontalLayout",
                    "elements": [
                        {
                            "type": "Control",
                            "scope": "#/properties/personalData/properties/age"
                        },
                        {
                            "type": "Control",
                            "scope": "#/properties/personalData/properties/height"
                        },
                        {
                            "type": "Control",
                            "scope": "#/properties/personalData/properties/drivingSkill"
                        }
                    ]
                },
                {
                    "type": "Control",
                    "scope": "#/properties/occupation"
                }
            ]
        },
        {
            "type": "VerticalLayout",
            "elements": [
                {
                    "type": "Label",
                    "text": "Employment Information"
                },
                {
                    "type": "Control",
                    "scope": "#/properties/employmentDetails/properties/companyName"
                },
                {
                    "type": "Control",
                    "scope": "#/properties/employmentDetails/properties/yearsOfExperience"
                },
                {
                    "type": "Control",
                    "scope": "#/properties/employmentDetails/properties/salary"
                }
            ]
        },
        {
            "type": "VerticalLayout",
            "elements": [
                {
                    "type": "Label",
                    "text": "Contact Information"
                },
                {
                    "type": "HorizontalLayout",
                    "elements": [
                        {
                            "type": "Control",
                            "scope": "#/properties/contactInfo/properties/email"
                        },
                        {
                            "type": "Control",
                            "scope": "#/properties/contactInfo/properties/phone"
                        },
                        {
                            "type": "Control",
                            "scope": "#/properties/contactInfo/properties/address"
                        }
                    ]
                },
                {
                    "type": "Control",
                    "scope": "#/properties/postalCode"
                }
            ]
        },
        {
            "type": "Finalize"
        }
    ]
  }
};
