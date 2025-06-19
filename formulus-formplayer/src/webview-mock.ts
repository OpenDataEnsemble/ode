// Mock implementation of ReactNativeWebView for development testing
import { FormInitData } from './App';

interface MockWebView {
  postMessage: (message: string) => void;
}

interface MockFormulus {
  submitForm: (formId: string, finalData: Record<string, any>) => Promise<void>;
  savePartial: (formId: string, data: Record<string, any>) => Promise<void>;
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
        submitForm: (formId: string, data: Record<string, any>): Promise<void> => {
          const message = { type: 'submitForm', formId, data };
          console.log('[WebView Mock] Received submitForm call:', message);
          this.messageListeners.forEach(listener => listener(message));
          return Promise.resolve();
        },
        savePartial: (formId: string, data: Record<string, any>): Promise<void> => {
          const message = { type: 'savePartial', formId, data };
          console.log('[WebView Mock] Received savePartial call:', message);
          this.messageListeners.forEach(listener => listener(message));
          return Promise.resolve();
        },
        requestCamera: (fieldId: string): Promise<void> => {
          const message = { type: 'requestCamera', fieldId };
          console.log('[WebView Mock] Received requestCamera call:', message);
          this.messageListeners.forEach(listener => listener(message));
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
