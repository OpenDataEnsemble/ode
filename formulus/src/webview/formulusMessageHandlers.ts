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

// Track pending form operations with their promise resolvers
const pendingFormOperations = new Map<string, {
  resolve: (result: FormCompletionResult) => void;
  reject: (error: Error) => void;
  formType: string;
  startTime: number;
}>();

// Helper functions to resolve form operations
export const resolveFormOperation = (operationId: string, result: FormCompletionResult) => {
  const operation = pendingFormOperations.get(operationId);
  if (operation) {
    console.log(`Resolving form operation ${operationId} with status: ${result.status}`);
    operation.resolve(result);
    pendingFormOperations.delete(operationId);
  } else {
    console.warn(`No pending operation found for ID: ${operationId}`);
  }
};

export const rejectFormOperation = (operationId: string, error: Error) => {
  const operation = pendingFormOperations.get(operationId);
  if (operation) {
    console.log(`Rejecting form operation ${operationId} with error:`, error.message);
    operation.reject(error);
    pendingFormOperations.delete(operationId);
  } else {
    console.warn(`No pending operation found for ID: ${operationId}`);
  }
};

// Helper to resolve operation by form type (fallback when operationId is not available)
export const resolveFormOperationByType = (formType: string, result: FormCompletionResult) => {
  // Find the most recent operation for this form type
  let mostRecentOperation: string | null = null;
  let mostRecentTime = 0;
  
  for (const [operationId, operation] of pendingFormOperations.entries()) {
    if (operation.formType === formType && operation.startTime > mostRecentTime) {
      mostRecentOperation = operationId;
      mostRecentTime = operation.startTime;
    }
  }
  
  if (mostRecentOperation) {
    resolveFormOperation(mostRecentOperation, result);
  } else {
    console.warn(`No pending operation found for form type: ${formType}`);
  }
};

// Helper function to save form data to storage
const saveFormData = async (formType: string, data: any, observationId: string | null, isPartial = true) => {
  const isUpdate = observationId !== null;
  console.log(`Message Handler: Saving form data: ${isUpdate ? 'Update' : 'New'} observation`, formType, data, observationId, isPartial);
  try {
    let observation: Partial<Observation> = {
      formType,
      data,
    };

    if (isUpdate) {
      observation.observationId = observationId;
      observation.updatedAt = new Date();
    } else {
      observation.createdAt = new Date();
    }
    
    const formService =  await FormService.getInstance()
    
    const id = isUpdate 
      ? await formService.updateObservation(observationId, data)
      : await formService.addNewObservation(formType, data);
    
    console.log(`${isUpdate ? 'Updated' : 'Saved'} observation with id: ${id}`);
    
    // Emit event to close the FormplayerModal after successful save
    appEvents.emit('closeFormplayer', { observationId: id, isUpdate });
    
    return id;

    // TODO: Handle attachments/files
    // const directory = `${RNFS.DocumentDirectoryPath}/form_data`;
    // const exists = await RNFS.exists(directory);
    // if (!exists) {
    //   await RNFS.mkdir(directory);
    // }
    
  } catch (error) {
    console.error('Error saving form data:', error);
    return null;
  }
};

// Helper function to load form data from storage
const loadFormData = async (formType: string) => {
  try {
    const filePath = `${RNFS.DocumentDirectoryPath}/form_data/${formType}_partial.json`;
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



import { FormulusMessageHandlers } from './FormulusMessageHandlers.types';
import { FormInitData, FormulusInterface, FormCompletionResult } from './FormulusInterfaceDefinition';
import { FormService } from '../services/FormService';
import { FormObservationRepository } from '../database/FormObservationRepository';
import { Observation } from '../database/models/Observation';


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
    onSavePartial: async (formType: string, data: Record<string, any>) => {
      console.log("FormulusMessageHandlers: onSavePartial handler invoked.", { formType, data });
      console.warn("TODO: implement onSavePartial logic");
      return("draft - not implemented");
    },
    onSubmitObservation: async (data: { formType: string; finalData: Record<string, any> }) => {
      const { formType, finalData } = data;
      console.log("FormulusMessageHandlers: onSubmitObservation handler invoked.", { formType, finalData });
      const id = await saveFormData(formType, finalData, null, false);
      return id;
    },
    onUpdateObservation: async (data: { observationId: string; formType: string; finalData: Record<string, any> }) => {
      const { observationId, formType, finalData } = data;
      console.log("FormulusMessageHandlers: onUpdateObservation handler invoked.", { observationId, formType, finalData });
      const id = await saveFormData(formType, finalData, observationId, false);
      return id;
    },
    onRequestCamera: async (fieldId: string): Promise<any> => {
      console.log('Request camera handler called', fieldId);
      
      return new Promise((resolve, reject) => {
        try {
          // Import react-native-image-picker directly
          const ImagePicker = require('react-native-image-picker');
          
          if (!ImagePicker || !ImagePicker.launchCamera) {
            console.error('react-native-image-picker not available or not properly linked');
            resolve({
              fieldId,
              status: 'error',
              message: 'Camera functionality not available. Please ensure react-native-image-picker is properly installed and linked.'
            });
            return;
          }
          
          // Camera options for react-native-image-picker
          const options = {
            mediaType: 'photo' as const,
            quality: 0.8,
            includeBase64: true,
            maxWidth: 1920,
            maxHeight: 1080,
            storageOptions: {
              skipBackup: true,
              path: 'images',
            },
          };
          
          console.log('Launching camera with react-native-image-picker, options:', options);
          
          // react-native-image-picker handles permissions automatically
          ImagePicker.launchCamera(options, (response: any) => {
            console.log('Camera response received:', response);
            
            if (response.didCancel) {
              console.log('User cancelled camera');
              resolve({
                fieldId,
                status: 'cancelled',
                message: 'Camera operation cancelled by user'
              });
            } else if (response.errorCode || response.errorMessage) {
              console.error('Camera error:', response.errorCode, response.errorMessage);
              resolve({
                fieldId,
                status: 'error',
                message: response.errorMessage || `Camera error: ${response.errorCode}`
              });
            } else if (response.assets && response.assets.length > 0) {
              // Photo captured successfully
              const asset = response.assets[0];
              
              // Generate GUID for the image
              const generateGUID = () => {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                  const r = Math.random() * 16 | 0;
                  const v = c == 'x' ? r : (r & 0x3 | 0x8);
                  return v.toString(16);
                });
              };
              
              const imageGuid = generateGUID();
              const guidFilename = `${imageGuid}.jpg`;
              
              console.log('Photo captured, processing for persistent storage:', {
                imageGuid,
                guidFilename,
                tempUri: asset.uri,
                size: asset.fileSize
              });
              
              // Use RNFS to copy the camera image to both attachment locations
              const RNFS = require('react-native-fs');
              const attachmentsDirectory = `${RNFS.DocumentDirectoryPath}/attachments`;
              const pendingUploadDirectory = `${RNFS.DocumentDirectoryPath}/attachments/pending_upload`;
              
              const mainFilePath = `${attachmentsDirectory}/${guidFilename}`;
              const pendingFilePath = `${pendingUploadDirectory}/${guidFilename}`;
              
              console.log('Copying camera image to attachment sync system:', {
                source: asset.uri,
                mainPath: mainFilePath,
                pendingPath: pendingFilePath
              });
              
              // Ensure both directories exist and copy file to both locations
              Promise.all([
                RNFS.mkdir(attachmentsDirectory),
                RNFS.mkdir(pendingUploadDirectory)
              ])
                .then(() => {
                  // Copy to both locations simultaneously
                  return Promise.all([
                    RNFS.copyFile(asset.uri, mainFilePath),
                    RNFS.copyFile(asset.uri, pendingFilePath)
                  ]);
                })
                .then(() => {
                  console.log('Image saved to attachment sync system:', mainFilePath);
                  
                  const webViewUrl = `file://${mainFilePath}`;
                  
                  resolve({
                    fieldId,
                    status: 'success',
                    data: {
                      type: 'image',
                      id: imageGuid,
                      filename: guidFilename,
                      uri: mainFilePath, // Main attachment path for sync protocol
                      url: webViewUrl, // WebView-accessible URL for display
                      timestamp: new Date().toISOString(),
                      metadata: {
                        width: asset.width || 1920,
                        height: asset.height || 1080,
                        size: asset.fileSize || 0,
                        mimeType: 'image/jpeg',
                        source: 'react-native-image-picker',
                        quality: 0.8,
                        originalFileName: asset.fileName || guidFilename,
                        persistentStorage: true,
                        storageLocation: 'attachments_with_upload_queue',
                        syncReady: true
                      }
                    }
                  });
                })
                .catch((error: any) => {
                  console.error('Error copying image to attachment sync system:', error);
                  resolve({
                    fieldId,
                    status: 'error',
                    message: `Failed to save image: ${error.message}`
                  });
                });
            } else {
              console.error('Unexpected camera response format:', response);
              resolve({
                fieldId,
                status: 'error',
                message: 'Unexpected camera response format'
              });
            }
          });
        } catch (error) {
          console.error('Error in native camera handler:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          resolve({
            fieldId,
            status: 'error',
            message: `Camera error: ${errorMessage}`
          });
        }
      });
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
    onCallSubform: (fieldId: string, formType: string, options: Record<string, any>) => {
      // TODO: implement call subform logic
      console.log('Call subform handler called', fieldId, formType, options);
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
    onGetObservations: async (formType: string, isDraft?: boolean, includeDeleted?: boolean) => {
      console.log('FormulusMessageHandlers: onGetObservations handler invoked.', { formType, isDraft, includeDeleted });
      if (formType.hasOwnProperty('formType')) {
        console.warn('FormulusMessageHandlers: onGetObservations handler invoked with formType object, expected string');
        formType = (formType as any).formType;
        isDraft = (formType as any).isDraft;
        includeDeleted = (formType as any).includeDeleted;
      }
      const formService = await FormService.getInstance();
      const observations = await formService.getObservationsByFormType(formType); //TODO: Handle deleted etc.
      return observations;
    },
    onOpenFormplayer: async (data: FormInitData): Promise<FormCompletionResult> => {
      const { formType, params, savedData } = data;
      console.log('FormulusMessageHandlers: onOpenFormplayer handler invoked with data:', data);
      
      // Generate a unique operation ID for this form session
      const operationId = `${formType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create a promise that will be resolved when the form is completed/closed
      return new Promise<FormCompletionResult>((resolve, reject) => {
        // Store the promise resolvers
        pendingFormOperations.set(operationId, {
          resolve,
          reject,
          formType,
          startTime: Date.now()
        });
        
        // Emit the event with the operation ID so we can track completion
        appEvents.emit('openFormplayerRequested', { 
          formType, 
          params, 
          savedData, 
          operationId 
        });
        
        // Set a timeout to prevent hanging promises (8 hours)
        setTimeout(() => {
          if (pendingFormOperations.has(operationId)) {
            pendingFormOperations.delete(operationId);
            reject(new Error('Form operation timed out'));
          }
        }, 8 * 60 * 60 * 1000);
      });
    },
    onFormulusReady: () => {
      console.log('FormulusMessageHandlers: onFormulusReady handler invoked. WebView is ready.');
      // TODO: Perform any actions needed when the WebView content signals it's ready
    },
    onReceiveFocus: () => {
      console.log('FormulusMessageHandlers: onReceiveFocus handler invoked. WebView is ready.');
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