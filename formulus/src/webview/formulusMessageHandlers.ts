/*
This is where the actual implementation of the methods happens on the React Native side. 
It handles the messages received from the WebView and executes the corresponding native functionality.
*/
import { NativeModules } from 'react-native';
import { WebViewMessageEvent, WebView } from 'react-native-webview';
import RNFS from 'react-native-fs';

export type HandlerArgs = {
  data: any;
  webViewRef: React.RefObject<WebView | null>;
  event: WebViewMessageEvent;
};

export type Handler = (args: HandlerArgs) => void | Promise<void>;

// Simple event emitter for cross-component communication
type Listener = (...args: any[]) => void;

class SimpleEventEmitter {
  private listeners: Record<string, Listener[]> = {};

  addListener(eventName: string, listener: Listener): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(listener);
  }

  removeListener(eventName: string, listener: Listener): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName] = this.listeners[eventName].filter(l => l !== listener);
  }

  emit(eventName: string, ...args: any[]): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName].forEach(listener => listener(...args));
  }
}

// Create a global event emitter for app-wide events
export const appEvents = new SimpleEventEmitter();

// Helper function to save form data to storage
const saveFormData = async (formId: string, data: any, isPartial = true) => {
  try {
    const directory = `${RNFS.DocumentDirectoryPath}/form_data`;
    const exists = await RNFS.exists(directory);
    if (!exists) {
      await RNFS.mkdir(directory);
    }
    
    const fileName = isPartial ? `${formId}_partial.json` : `${formId}_final.json`;
    const filePath = `${directory}/${fileName}`;
    await RNFS.writeFile(filePath, JSON.stringify(data), 'utf8');
    console.log(`Form data saved to ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error saving form data:', error);
    return false;
  }
};

// Helper function to load form data from storage
const loadFormData = async (formId: string) => {
  try {
    const filePath = `${RNFS.DocumentDirectoryPath}/form_data/${formId}_partial.json`;
    const exists = await RNFS.exists(filePath);
    if (!exists) {
      return null;
    }
    
    const data = await RNFS.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading form data:', error);
    return null;
  }
};

// Helper function to send attachment data back to Formplayer
const sendAttachmentToFormplayer = (webViewRef: React.RefObject<WebView | null>, data: any) => {
  webViewRef.current?.injectJavaScript(`
    window.FormplayerBridge && window.FormplayerBridge.onAttachmentReady(${JSON.stringify(data)});
    true;
  `);
};

export const FormulusMessageHandlers: Record<string, Handler> = {
  async getVersion({ webViewRef }) {
    try {
      const version = await NativeModules.UserAppModule.getVersion();
      webViewRef.current?.injectJavaScript(
        `window.formulus && window.formulus._onNativeResponse && window.formulus._onNativeResponse('getVersion', ${JSON.stringify(version)}); true;`
      );
    } catch (err) {
      webViewRef.current?.injectJavaScript(
        `window.formulus && window.formulus._onNativeResponse && window.formulus._onNativeResponse('getVersion', null); true;`
      );
    }
  },
  
  // Handler for opening the formplayer webview
  openFormplayer() {
    // Emit an event that the HomeScreen can listen for
    appEvents.emit('openFormplayer');
  },
  
  // Formplayer Handlers - Basic Form Operations
  // ==========================================
  
  // Initialize a form in Formplayer
  async initForm({ data, webViewRef }) {
    try {
      // Generate a unique form ID if not provided
      const formId = data.formId || `form_${Date.now()}`;
      
      // Load any saved data for this form
      const savedData = await loadFormData(formId) || {};
      
      // Prepare form parameters
      const params = data.params || { locale: 'en', theme: 'default' };
      
      // Send the initialization data to Formplayer
      webViewRef.current?.injectJavaScript(`
        window.FormplayerBridge && window.FormplayerBridge.receiveFormInit(${JSON.stringify({
          formId,
          params,
          savedData
        })});
        true;
      `);
      
      console.log('Form initialized with ID:', formId);
    } catch (err) {
      console.error('Error initializing form:', err);
    }
  },
  
  // Save partial form data
  async savePartial({ data, webViewRef }) {
    try {
      if (!data.formId || !data.data) {
        throw new Error('Missing formId or data for savePartial');
      }
      
      // Save the partial form data
      const success = await saveFormData(data.formId, data.data, true);
      
      // Notify Formplayer of the save result
      webViewRef.current?.injectJavaScript(`
        window.FormplayerBridge && window.FormplayerBridge.onSavePartialComplete(${JSON.stringify({
          formId: data.formId,
          success
        })});
        true;
      `);
      
      console.log('Partial form data saved for form:', data.formId);
    } catch (err) {
      console.error('Error saving partial form data:', err);
    }
  },
  
  // Submit final form data
  async submitForm({ data }) {
    try {
      if (!data.formId || !data.finalData) {
        throw new Error('Missing formId or finalData for submitForm');
      }
      
      // Save the final form data
      await saveFormData(data.formId, data.finalData, false);
      
      // Emit an event to close the formplayer
      appEvents.emit('closeFormplayer');
      
      console.log('Form submitted:', data.formId);
    } catch (err) {
      console.error('Error submitting form:', err);
    }
  },
  
  // Formplayer Handlers - Native Feature Calls
  // =========================================
  
  // Camera access
  async requestCamera({ data, webViewRef }) {
    try {
      if (!data.fieldId) {
        throw new Error('Missing fieldId for requestCamera');
      }
      
      console.log('Opening camera for field:', data.fieldId);
      
      // In a real implementation, you would open the camera here
      // For this example, we'll simulate a successful camera capture
      setTimeout(() => {
        // Simulate a camera capture with a mock image URI
        const mockImageUri = `file:///mock/camera/image_${Date.now()}.jpg`;
        
        // Send the attachment data back to Formplayer
        sendAttachmentToFormplayer(webViewRef, {
          fieldId: data.fieldId,
          type: 'image',
          uri: mockImageUri
        });
        
        console.log('Camera image captured:', mockImageUri);
      }, 1000); // Simulate a delay for camera operation
    } catch (err) {
      console.error('Error handling camera request:', err);
    }
  },
  
  // Location access
  async requestLocation({ data, webViewRef }) {
    try {
      if (!data.fieldId) {
        throw new Error('Missing fieldId for requestLocation');
      }
      
      console.log('Getting location for field:', data.fieldId);
      
      // In a real implementation, you would access the device's GPS here
      // For this example, we'll simulate a location result
      setTimeout(() => {
        // Simulate location data
        const mockCoords = {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now()
        };
        
        // Send the attachment data back to Formplayer
        sendAttachmentToFormplayer(webViewRef, {
          fieldId: data.fieldId,
          type: 'location',
          coords: mockCoords
        });
        
        console.log('Location obtained:', mockCoords);
      }, 500); // Simulate a delay for location retrieval
    } catch (err) {
      console.error('Error handling location request:', err);
    }
  },
  
  // File picker
  async requestFile({ data, webViewRef }) {
    try {
      if (!data.fieldId) {
        throw new Error('Missing fieldId for requestFile');
      }
      
      console.log('Opening file picker for field:', data.fieldId);
      
      // In a real implementation, you would open a file picker here
      // For this example, we'll simulate a file selection
      setTimeout(() => {
        // Simulate a file selection with a mock file URI
        const mockFileUri = `file:///mock/documents/file_${Date.now()}.pdf`;
        
        // Send the attachment data back to Formplayer
        sendAttachmentToFormplayer(webViewRef, {
          fieldId: data.fieldId,
          type: 'file',
          uri: mockFileUri
        });
        
        console.log('File selected:', mockFileUri);
      }, 800); // Simulate a delay for file selection
    } catch (err) {
      console.error('Error handling file request:', err);
    }
  },
  
  // Android Intent
  async launchIntent({ data, webViewRef }) {
    try {
      if (!data.fieldId || !data.intentSpec) {
        throw new Error('Missing fieldId or intentSpec for launchIntent');
      }
      
      console.log('Launching intent for field:', data.fieldId, 'with spec:', data.intentSpec);
      
      // In a real implementation, you would launch an Android Intent here
      // For this example, we'll simulate an intent result
      setTimeout(() => {
        // Simulate intent result data
        const mockIntentData = {
          result: 'success',
          data: { key: 'value' },
          timestamp: Date.now()
        };
        
        // Send the attachment data back to Formplayer
        sendAttachmentToFormplayer(webViewRef, {
          fieldId: data.fieldId,
          type: 'intent',
          data: mockIntentData
        });
        
        console.log('Intent completed with data:', mockIntentData);
      }, 1200); // Simulate a delay for intent completion
    } catch (err) {
      console.error('Error handling intent request:', err);
    }
  },
  
  // Subform
  async callSubform({ data, webViewRef }) {
    try {
      if (!data.fieldId || !data.formId) {
        throw new Error('Missing fieldId or formId for callSubform');
      }
      
      console.log('Opening subform for field:', data.fieldId, 'with formId:', data.formId);
      
      // In a real implementation, you would open a subform here
      // For this example, we'll simulate a subform completion
      setTimeout(() => {
        // Simulate subform data
        const mockSubformData = {
          id: data.formId,
          completed: true,
          fields: { question1: 'answer1', question2: 'answer2' },
          timestamp: Date.now()
        };
        
        // Send the attachment data back to Formplayer
        sendAttachmentToFormplayer(webViewRef, {
          fieldId: data.fieldId,
          type: 'subform',
          data: mockSubformData
        });
        
        console.log('Subform completed with data:', mockSubformData);
      }, 1500); // Simulate a delay for subform completion
    } catch (err) {
      console.error('Error handling subform request:', err);
    }
  },
  
  // Audio Recording
  async requestAudio({ data, webViewRef }) {
    try {
      if (!data.fieldId) {
        throw new Error('Missing fieldId for requestAudio');
      }
      
      console.log('Starting audio recording for field:', data.fieldId);
      
      // In a real implementation, you would start audio recording here
      // For this example, we'll simulate an audio recording
      setTimeout(() => {
        // Simulate an audio recording with a mock audio URI
        const mockAudioUri = `file:///mock/audio/recording_${Date.now()}.mp3`;
        
        // Send the attachment data back to Formplayer
        sendAttachmentToFormplayer(webViewRef, {
          fieldId: data.fieldId,
          type: 'audio',
          uri: mockAudioUri
        });
        
        console.log('Audio recording completed:', mockAudioUri);
      }, 2000); // Simulate a delay for audio recording
    } catch (err) {
      console.error('Error handling audio request:', err);
    }
  },
  
  // Signature Capture
  async requestSignature({ data, webViewRef }) {
    try {
      if (!data.fieldId) {
        throw new Error('Missing fieldId for requestSignature');
      }
      
      console.log('Opening signature capture for field:', data.fieldId);
      
      // In a real implementation, you would open a signature pad here
      // For this example, we'll simulate a signature capture
      setTimeout(() => {
        // Simulate a signature with a mock image
        const mockSignatureImage = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`;
        
        // Send the attachment data back to Formplayer
        sendAttachmentToFormplayer(webViewRef, {
          fieldId: data.fieldId,
          type: 'signature',
          image: mockSignatureImage
        });
        
        console.log('Signature captured');
      }, 1000); // Simulate a delay for signature capture
    } catch (err) {
      console.error('Error handling signature request:', err);
    }
  },
  
  // Biometric Authentication
  async requestBiometric({ data, webViewRef }) {
    try {
      if (!data.fieldId) {
        throw new Error('Missing fieldId for requestBiometric');
      }
      
      console.log('Triggering biometric authentication for field:', data.fieldId);
      
      // In a real implementation, you would trigger biometric auth here
      // For this example, we'll simulate a successful authentication
      setTimeout(() => {
        // Simulate a successful biometric authentication
        const verified = true;
        
        // Send the attachment data back to Formplayer
        sendAttachmentToFormplayer(webViewRef, {
          fieldId: data.fieldId,
          type: 'biometric',
          verified: verified
        });
        
        console.log('Biometric authentication result:', verified);
      }, 800); // Simulate a delay for biometric authentication
    } catch (err) {
      console.error('Error handling biometric request:', err);
    }
  },
  
  // Connectivity Status
  async requestConnectivityStatus({ webViewRef }) {
    try {
      console.log('Checking connectivity status');
      
      // In a real implementation, you would check network connectivity here
      // For this example, we'll simulate a connectivity check
      setTimeout(() => {
        // Simulate connectivity status
        const mockStatus = {
          connected: true,
          type: 'wifi',
          strength: 'strong'
        };
        
        // Send the attachment data back to Formplayer
        sendAttachmentToFormplayer(webViewRef, {
          type: 'connectivity',
          status: mockStatus
        });
        
        console.log('Connectivity status:', mockStatus);
      }, 300); // Simulate a delay for connectivity check
    } catch (err) {
      console.error('Error handling connectivity status request:', err);
    }
  },
  
  // Sync Status
  async requestSyncStatus({ webViewRef }) {
    try {
      console.log('Checking sync status');
      
      // In a real implementation, you would check sync status here
      // For this example, we'll simulate a sync status check
      setTimeout(() => {
        // Simulate sync status
        const mockProgress = {
          lastSync: Date.now() - 3600000, // 1 hour ago
          pendingItems: 5,
          syncInProgress: false
        };
        
        // Send the attachment data back to Formplayer
        sendAttachmentToFormplayer(webViewRef, {
          type: 'sync',
          progress: mockProgress
        });
        
        console.log('Sync status:', mockProgress);
      }, 400); // Simulate a delay for sync status check
    } catch (err) {
      console.error('Error handling sync status request:', err);
    }
  },
  
  // Run Local ML Model
  async runLocalModel({ data, webViewRef }) {
    try {
      if (!data.fieldId || !data.modelId || !data.input) {
        throw new Error('Missing required parameters for runLocalModel');
      }
      
      console.log('Running ML model for field:', data.fieldId, 'with model:', data.modelId);
      
      // In a real implementation, you would run an ML model here
      // For this example, we'll simulate an ML model execution
      setTimeout(() => {
        // Simulate ML model result
        const mockResult = {
          prediction: 'category_a',
          confidence: 0.92,
          processingTime: 120
        };
        
        // Send the attachment data back to Formplayer
        sendAttachmentToFormplayer(webViewRef, {
          fieldId: data.fieldId,
          type: 'ml_result',
          result: mockResult
        });
        
        console.log('ML model execution completed with result:', mockResult);
      }, 1800); // Simulate a delay for ML model execution
    } catch (err) {
      console.error('Error handling ML model execution request:', err);
    }
  },
  
  // Add more handlers here as needed

  // Catch-all handler for unknown messages
  __default__({ data, webViewRef, event }) {
    console.warn('[FormulusMessageHandlers] Unhandled message:', { data, webViewRef, event });
  },
};
