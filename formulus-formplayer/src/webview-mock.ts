// Mock implementation of ReactNativeWebView for development testing
import { FormInitData } from './App';

interface MockWebView {
  postMessage: (message: string) => void;
}

type MockWindow = Window & {
  ReactNativeWebView?: MockWebView;
  onFormInit?: (data: FormInitData) => void;
}

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
    console.log('[WebView Mock] Checking if ReactNativeWebView exists:', !!mockWindow.ReactNativeWebView);
    
    // Only initialize if ReactNativeWebView doesn't already exist
    if (!mockWindow.ReactNativeWebView) {
      mockWindow.ReactNativeWebView = {
        postMessage: this.postMessage
      };
      this.isActive = true;
      console.log('[WebView Mock] Initialized mock ReactNativeWebView interface');
    } else {
      console.log('[WebView Mock] ReactNativeWebView already exists, not initializing mock');
    }
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
  formId: 'TestForm', 
  params: {
    defaultData: {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    }
  },
  savedData: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  },
  formSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        title: 'Full Name'
      },
      email: {
        type: 'string',
        title: 'Email Address',
        format: 'email'
      },
      age: {
        type: 'integer',
        title: 'Age',
        minimum: 0,
        maximum: 120
      },
      bio: {
        type: 'string',
        title: 'Biography'
      }
    },
    required: ['name', 'email']
  },
  uiSchema: {
    type: 'VerticalLayout',
    elements: [
      {
        type: 'Control',
        scope: '#/properties/name'
      },
      {
        type: 'Control',
        scope: '#/properties/email'
      },
      {
        type: 'Control',
        scope: '#/properties/age'
      },
      {
        type: 'Control',
        scope: '#/properties/bio',
        options: {
          multi: true
        }
      }
    ]
  }
};
