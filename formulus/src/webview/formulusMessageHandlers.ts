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
//TODO: SHOULD USE THE REPOSITORY OBVIOUSLY
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

import { FormulusMessageHandlers } from './FormulusMessageHandlers.types';

// ...existing imports and helpers remain above

export function createFormulusMessageHandlers(): FormulusMessageHandlers {
  return {
    onInitForm: (payload: any) => {
      // TODO: implement init form logic
      console.log('FormulusMessageHandlers: onInitForm called', payload);
    },
    onGetVersion: async (): Promise<string> => {
      console.log('FormulusMessageHandlers: onGetVersion handler invoked.');
      // Replace with your actual version retrieval logic.
      const version = "0.1.0-native"; // Example version
      return version;
    },
    onSavePartial: async (formId: string, data: Record<string, any>) => {
      await saveFormData(formId, data, true);
    },
    onSubmitForm: async (formId: string, finalData: Record<string, any>) => {
      await saveFormData(formId, finalData, false);
    },
    onRequestCamera: (fieldId: string) => {
      // TODO: implement camera request logic
      console.log('Request camera handler called', fieldId);
    },
    onRequestLocation: (fieldId: string) => {
      // TODO: implement location request logic
      console.log('Request location handler called', fieldId);
    },
    onRequestFile: (fieldId: string) => {
      // TODO: implement file request logic
      console.log('Request file handler called', fieldId);
    },
    onLaunchIntent: (fieldId: string, intentSpec: Record<string, any>) => {
      // TODO: implement launch intent logic
      console.log('Launch intent handler called', fieldId, intentSpec);
    },
    onCallSubform: (fieldId: string, formId: string, options: Record<string, any>) => {
      // TODO: implement call subform logic
      console.log('Call subform handler called', fieldId, formId, options);
    },
    onRequestAudio: (fieldId: string) => {
      // TODO: implement audio request logic
      console.log('Request audio handler called', fieldId);
    },
    onRequestSignature: (fieldId: string) => {
      // TODO: implement signature request logic
      console.log('Request signature handler called', fieldId);
    },
    onRequestBiometric: (fieldId: string) => {
      // TODO: implement biometric request logic
      console.log('Request biometric handler called', fieldId);
    },
    onRequestConnectivityStatus: () => {
      // TODO: implement connectivity status logic
      console.log('Request connectivity status handler called');
    },
    onRequestSyncStatus: () => {
      // TODO: implement sync status logic
      console.log('Request sync status handler called');
    },
    onRunLocalModel: (fieldId: string, modelId: string, input: Record<string, any>) => {
      // TODO: implement run local model logic
      console.log('Run local model handler called', fieldId, modelId, input);
    },
    onGetAvailableForms: async () => {
      console.log('FormulusMessageHandlers: onGetAvailableForms handler invoked.');
      // TODO: Implement logic to fetch available forms
      return Promise.resolve([]); // Example: return empty array
    },
    onGetObservations: async (formId: string, isDraft?: boolean, includeDeleted?: boolean) => {
      console.log('FormulusMessageHandlers: onGetObservations handler invoked.', { formId, isDraft, includeDeleted });
      // TODO: Implement logic to fetch observations
      return Promise.resolve([]); // Example: return empty array
    },
    onOpenFormplayer: async (formId: string, params?: Record<string, any>, savedData?: Record<string, any>) => {
      console.log('FormulusMessageHandlers: onOpenFormplayer handler invoked.', { formId, params, savedData });
      // TODO: Implement logic to open formplayer, perhaps navigate to a new screen or display a modal
      return Promise.resolve();
    },
    onFormulusReady: () => {
      console.log('FormulusMessageHandlers: onFormulusReady handler invoked. WebView is ready.');
      // TODO: Perform any actions needed when the WebView content signals it's ready
    },
    onUnknownMessage: (message: any) => {
      console.warn('Unknown message received:', message);
    },
    onError: (error: Error) => {
      console.error('WebView Handler Error:', error);
    },
  };
}