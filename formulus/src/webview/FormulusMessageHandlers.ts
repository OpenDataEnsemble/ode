/*
This is where the actual implementation of the methods happens on the React Native side. 
It handles the messages received from the WebView and executes the corresponding native functionality.
*/
import {GeolocationService} from '../services/GeolocationService';
import {WebViewMessageEvent, WebView} from 'react-native-webview';
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
    this.listeners[eventName] = this.listeners[eventName].filter(
      l => l !== listener,
    );
  }

  emit(eventName: string, ...args: any[]): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName].forEach(listener => listener(...args));
  }
}

// Create a global event emitter for app-wide events
export const appEvents = new SimpleEventEmitter();

// Track pending form operations with their promise resolvers
const pendingFormOperations = new Map<
  string,
  {
    resolve: (result: FormCompletionResult) => void;
    reject: (error: Error) => void;
    formType: string;
    startTime: number;
  }
>();

// Internal helper to start a formplayer operation and return a promise that resolves
// when the form is completed or closed. This is used both by the WebView-driven
// onOpenFormplayer handler and by native screens that want to open Formplayer
// directly in a promise-based way.
const startFormplayerOperation = (
  formType: string,
  params: Record<string, any> = {},
  savedData: Record<string, any> = {},
  observationId: string | null = null,
): Promise<FormCompletionResult> => {
  const operationId = `${formType}_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  return new Promise<FormCompletionResult>((resolve, reject) => {
    // Store the promise resolvers
    pendingFormOperations.set(operationId, {
      resolve,
      reject,
      formType,
      startTime: Date.now(),
    });

    // Emit the event with the operation ID so the HomeScreen/FormplayerModal
    // stack can open the modal and initialize the form
    appEvents.emit('openFormplayerRequested', {
      formType,
      params,
      savedData,
      observationId,
      operationId,
    });

    // Set a timeout to prevent hanging promises (8 hours)
    setTimeout(() => {
      if (pendingFormOperations.has(operationId)) {
        pendingFormOperations.delete(operationId);
        reject(new Error('Form operation timed out'));
      }
    }, 8 * 60 * 60 * 1000);
  });
};

// Public helper for native React Native screens to open Formplayer
// in a promise-based way, without needing to manage appEvents or
// pending operation maps directly.
export const openFormplayerFromNative = (
  formType: string,
  params: Record<string, any> = {},
  savedData: Record<string, any> = {},
  observationId: string | null = null,
): Promise<FormCompletionResult> => {
  return startFormplayerOperation(formType, params, savedData, observationId);
};

// Global reference to the active FormplayerModal for direct submission handling
let activeFormplayerModalRef: {
  handleSubmission: (data: {
    formType: string;
    finalData: Record<string, any>;
  }) => Promise<string>;
} | null = null;

export const setActiveFormplayerModal = (
  modalRef: {
    handleSubmission: (data: {
      formType: string;
      finalData: Record<string, any>;
    }) => Promise<string>;
  } | null,
) => {
  activeFormplayerModalRef = modalRef;
};

// Helper functions to resolve form operations
export const resolveFormOperation = (
  operationId: string,
  result: FormCompletionResult,
) => {
  const operation = pendingFormOperations.get(operationId);
  if (operation) {
    console.log(
      `Resolving form operation ${operationId} with status: ${result.status}`,
    );
    operation.resolve(result);
    pendingFormOperations.delete(operationId);
  } else {
    console.warn(`No pending operation found for ID: ${operationId}`);
  }
};

export const rejectFormOperation = (operationId: string, error: Error) => {
  const operation = pendingFormOperations.get(operationId);
  if (operation) {
    console.log(
      `Rejecting form operation ${operationId} with error:`,
      error.message,
    );
    operation.reject(error);
    pendingFormOperations.delete(operationId);
  } else {
    console.warn(`No pending operation found for ID: ${operationId}`);
  }
};

// Helper to resolve operation by form type (fallback when operationId is not available)
export const resolveFormOperationByType = (
  formType: string,
  result: FormCompletionResult,
) => {
  // Find the most recent operation for this form type
  let mostRecentOperation: string | null = null;
  let mostRecentTime = 0;

  for (const [operationId, operation] of pendingFormOperations.entries()) {
    if (
      operation.formType === formType &&
      operation.startTime > mostRecentTime
    ) {
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
const saveFormData = async (
  formType: string,
  data: any,
  observationId: string | null,
  isPartial = true,
) => {
  const isUpdate = observationId !== null;
  console.log(
    `Message Handler: Saving form data: ${
      isUpdate ? 'Update' : 'New'
    } observation`,
    formType,
    data,
    observationId,
    isPartial,
  );
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

    const formService = await FormService.getInstance();

    const id = isUpdate
      ? await formService.updateObservation(observationId, data)
      : await formService.addNewObservation(formType, data);

    console.log(`${isUpdate ? 'Updated' : 'Saved'} observation with id: ${id}`);

    // Don't emit closeFormplayer here - let FormplayerModal handle closing after its own submission process
    // appEvents.emit('closeFormplayer', { observationId: id, isUpdate });

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

// Helper function to load form data from storage (currently unused)
// const loadFormData = async (formType: string) => {
//   try {
//     const filePath = `${RNFS.DocumentDirectoryPath}/form_data/${formType}_partial.json`;
//     const exists = await RNFS.exists(filePath);
//     if (!exists) {
//       return null;
//     }
//
//     const data = await RNFS.readFile(filePath, 'utf8');
//     return JSON.parse(data);
//   } catch (error) {
//     console.error('Error loading form data:', error);
//     return null;
//   }
// };

import {FormulusMessageHandlers} from './FormulusMessageHandlers.types';
import {
  FormInitData,
  FormCompletionResult,
  FormInfo,
} from './FormulusInterfaceDefinition';
import {FormService} from '../services/FormService';
import {Observation} from '../database/models/Observation';

export function createFormulusMessageHandlers(): FormulusMessageHandlers {
  return {
    onInitForm: (payload: any) => {
      // TODO: implement init form logic
      console.log('FormulusMessageHandlers: onInitForm called', payload);
    },
    onGetVersion: async (): Promise<string> => {
      console.log('FormulusMessageHandlers: onGetVersion handler invoked.');
      // Replace with your actual version retrieval logic.
      const version = '0.1.0-native'; // Example version
      return version;
    },
    onSubmitObservation: async (data: {
      formType: string;
      finalData: Record<string, any>;
    }) => {
      const {formType, finalData} = data;
      console.log(
        'FormulusMessageHandlers: onSubmitObservation handler invoked.',
        {formType, finalData},
      );

      // Use the active FormplayerModal's handleSubmission method if available
      if (activeFormplayerModalRef) {
        console.log(
          'FormulusMessageHandlers: Delegating to FormplayerModal.handleSubmission',
        );
        return await activeFormplayerModalRef.handleSubmission({
          formType,
          finalData,
        });
      } else {
        // Fallback to the old method if no modal is active
        console.warn(
          'FormulusMessageHandlers: No active FormplayerModal, using fallback saveFormData',
        );
        return await saveFormData(formType, finalData, null, false);
      }
    },
    onUpdateObservation: async (data: {
      observationId: string;
      formType: string;
      finalData: Record<string, any>;
    }) => {
      const {observationId, formType, finalData} = data;
      console.log(
        'FormulusMessageHandlers: onUpdateObservation handler invoked.',
        {observationId, formType, finalData},
      );
      const id = await saveFormData(formType, finalData, observationId, false);
      return id;
    },
    onRequestCamera: async (fieldId: string): Promise<any> => {
      console.log('Request camera handler called', fieldId);

      return new Promise((resolve, _reject) => {
        try {
          // Import react-native-image-picker directly
          const ImagePicker = require('react-native-image-picker');

          if (
            !ImagePicker ||
            (!ImagePicker.showImagePicker && !ImagePicker.launchImageLibrary)
          ) {
            console.error(
              'react-native-image-picker not available or not properly linked',
            );
            resolve({
              fieldId,
              status: 'error',
              message:
                'Image picker functionality not available. Please ensure react-native-image-picker is properly installed and linked.',
            });
            return;
          }

          // Image picker options for react-native-image-picker
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

          console.log(
            'Launching image picker with camera and gallery options, options:',
            options,
          );

          // Import Alert for showing action sheet
          const {Alert} = require('react-native');

          // Common response handler for both camera and gallery
          const handleImagePickerResponse = (response: any) => {
            console.log('Camera response received:', response);

            if (response.didCancel) {
              console.log('User cancelled camera');
              resolve({
                fieldId,
                status: 'cancelled',
                message: 'Camera operation cancelled by user',
              });
            } else if (response.errorCode || response.errorMessage) {
              console.error(
                'Camera error:',
                response.errorCode,
                response.errorMessage,
              );
              resolve({
                fieldId,
                status: 'error',
                message:
                  response.errorMessage ||
                  `Camera error: ${response.errorCode}`,
              });
            } else if (response.assets && response.assets.length > 0) {
              // Photo captured successfully
              const asset = response.assets[0];

              // Generate GUID for the image
              const generateGUID = () => {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
                  /[xy]/g,
                  function (c) {
                    const r = (Math.random() * 16) | 0;
                    const v = c == 'x' ? r : (r & 0x3) | 0x8;
                    return v.toString(16);
                  },
                );
              };

              const imageGuid = generateGUID();
              const guidFilename = `${imageGuid}.jpg`;

              console.log(
                'Photo captured, processing for persistent storage:',
                {
                  imageGuid,
                  guidFilename,
                  tempUri: asset.uri,
                  size: asset.fileSize,
                },
              );

              // Use RNFS to copy the camera image to both attachment locations
              const RNFS = require('react-native-fs');
              const attachmentsDirectory = `${RNFS.DocumentDirectoryPath}/attachments`;
              const pendingUploadDirectory = `${RNFS.DocumentDirectoryPath}/attachments/pending_upload`;

              const mainFilePath = `${attachmentsDirectory}/${guidFilename}`;
              const pendingFilePath = `${pendingUploadDirectory}/${guidFilename}`;

              console.log('Copying camera image to attachment sync system:', {
                source: asset.uri,
                mainPath: mainFilePath,
                pendingPath: pendingFilePath,
              });

              // Ensure both directories exist and copy file to both locations
              Promise.all([
                RNFS.mkdir(attachmentsDirectory),
                RNFS.mkdir(pendingUploadDirectory),
              ])
                .then(() => {
                  // Copy to both locations simultaneously
                  return Promise.all([
                    RNFS.copyFile(asset.uri, mainFilePath),
                    RNFS.copyFile(asset.uri, pendingFilePath),
                  ]);
                })
                .then(() => {
                  console.log(
                    'Image saved to attachment sync system:',
                    mainFilePath,
                  );

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
                        syncReady: true,
                      },
                    },
                  });
                })
                .catch((error: any) => {
                  console.error(
                    'Error copying image to attachment sync system:',
                    error,
                  );
                  resolve({
                    fieldId,
                    status: 'error',
                    message: `Failed to save image: ${error.message}`,
                  });
                });
            } else {
              console.error('Unexpected camera response format:', response);
              resolve({
                fieldId,
                status: 'error',
                message: 'Unexpected camera response format',
              });
            }
          };

          // Show action sheet with camera and gallery options
          Alert.alert('Select Image', 'Choose an option', [
            {
              text: 'Camera',
              onPress: () => {
                ImagePicker.launchCamera(options, handleImagePickerResponse);
              },
            },
            {
              text: 'Gallery',
              onPress: () => {
                ImagePicker.launchImageLibrary(
                  options,
                  handleImagePickerResponse,
                );
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                resolve({
                  fieldId,
                  status: 'cancelled',
                  message: 'Image selection cancelled by user',
                });
              },
            },
          ]);
        } catch (error) {
          console.error('Error in native camera handler:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          resolve({
            fieldId,
            status: 'error',
            message: `Camera error: ${errorMessage}`,
          });
        }
      });
    },
    onRequestQrcode: async (fieldId: string): Promise<any> => {
      console.log('Request QR code handler called', fieldId);

      return new Promise((resolve, _reject) => {
        try {
          // Emit event to open QR scanner modal
          appEvents.emit('openQRScanner', {
            fieldId,
            onResult: (result: any) => {
              console.log('QR scan result received:', result);
              resolve(result);
            },
          });
        } catch (error) {
          console.error('Error in QR code handler:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          resolve({
            fieldId,
            status: 'error',
            message: `QR code error: ${errorMessage}`,
          });
        }
      });
    },
    onRequestSignature: async (fieldId: string): Promise<any> => {
      console.log('Request signature handler called', fieldId);

      return new Promise((resolve, _reject) => {
        try {
          // Emit event to open signature capture modal
          appEvents.emit('openSignatureCapture', {
            fieldId,
            onResult: async (result: any) => {
              console.log('Signature capture result received:', result);

              try {
                // If the result contains base64 data, save it to file and return URI
                if (
                  result.status === 'success' &&
                  result.data &&
                  result.data.base64
                ) {
                  const RNFS = require('react-native-fs');

                  // Generate a unique filename
                  const timestamp = Date.now();
                  const filename = `signature_${timestamp}.png`;

                  // Create signatures directory path
                  const signaturesDir = `${RNFS.DocumentDirectoryPath}/signatures`;
                  const filePath = `${signaturesDir}/${filename}`;

                  // Ensure signatures directory exists
                  await RNFS.mkdir(signaturesDir);

                  // Write base64 data to file
                  await RNFS.writeFile(filePath, result.data.base64, 'base64');

                  // Get file stats for size
                  const fileStats = await RNFS.stat(filePath);

                  // Create updated result with URI instead of base64
                  const updatedResult = {
                    fieldId,
                    status: 'success' as const,
                    data: {
                      type: 'signature' as const,
                      filename,
                      uri: `file://${filePath}`,
                      timestamp:
                        result.data.timestamp || new Date().toISOString(),
                      metadata: {
                        width: result.data.metadata?.width || 400,
                        height: result.data.metadata?.height || 200,
                        size: fileStats.size,
                        strokeCount: result.data.metadata?.strokeCount || 1,
                      },
                    },
                  };

                  console.log('Signature saved to file:', filePath);
                  resolve(updatedResult);
                } else {
                  // Return result as-is if no base64 data or if it's an error/cancellation
                  resolve(result);
                }
              } catch (fileError: any) {
                console.error('Error saving signature file:', fileError);
                resolve({
                  fieldId,
                  status: 'error',
                  message: `Error saving signature: ${fileError.message}`,
                });
              }
            },
          });
        } catch (error) {
          console.error('Error in signature handler:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          resolve({
            fieldId,
            status: 'error',
            message: `Signature error: ${errorMessage}`,
          });
        }
      });
    },
    onRequestLocation: async (fieldId: string): Promise<any> => {
      console.log('Request location handler called', fieldId);

      return new Promise(async (resolve, reject) => {
        try {
          // Get current location using the existing GeolocationService
          const geolocationService = GeolocationService.getInstance();
          const position =
            await geolocationService.getCurrentLocationForObservation();

          if (position) {
            // Convert ObservationGeolocation to LocationResultData format
            const locationResult = {
              fieldId,
              status: 'success' as const,
              data: {
                type: 'location' as const,
                latitude: position.latitude || 0,
                longitude: position.longitude || 0,
                accuracy: position.accuracy,
                altitude: position.altitude,
                altitudeAccuracy: position.altitude_accuracy,
                timestamp: new Date().toISOString(),
              },
            };

            console.log('Location captured successfully:', locationResult);
            resolve(locationResult);
          } else {
            throw new Error('Unable to get current location');
          }
        } catch (error: any) {
          console.error('Location capture failed:', error);

          const errorResult = {
            fieldId,
            status: 'error' as const,
            message: error.message || 'Location capture failed',
          };

          reject(errorResult);
        }
      });
    },
    onRequestVideo: async (fieldId: string): Promise<any> => {
      console.log('Request video handler called', fieldId);

      return new Promise((resolve, reject) => {
        try {
          // Import react-native-image-picker directly
          const ImagePicker = require('react-native-image-picker');

          const options = {
            mediaType: 'video' as const,
            videoQuality: 'high' as const,
            durationLimit: 60, // 60 seconds max
            storageOptions: {
              skipBackup: true,
              path: 'videos',
            },
          };

          ImagePicker.launchCamera(options, async (response: any) => {
            if (response.didCancel) {
              console.log('Video recording cancelled');
              reject({
                fieldId,
                status: 'cancelled',
                message: 'Video recording was cancelled by user',
              });
              return;
            }

            if (response.errorMessage) {
              console.error('Video recording error:', response.errorMessage);
              reject({
                fieldId,
                status: 'error',
                message: `Video recording error: ${response.errorMessage}`,
              });
              return;
            }

            if (response.assets && response.assets.length > 0) {
              const asset = response.assets[0];

              try {
                // Generate a unique filename
                const timestamp = Date.now();
                const filename = `video_${timestamp}.${
                  asset.type?.split('/')[1] || 'mp4'
                }`;

                // Copy video to app storage directory
                const destinationPath = `${RNFS.DocumentDirectoryPath}/videos/${filename}`;

                // Ensure videos directory exists
                await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/videos`);

                // Copy the video file
                await RNFS.copyFile(asset.uri, destinationPath);

                const videoResult = {
                  fieldId,
                  status: 'success' as const,
                  data: {
                    type: 'video' as const,
                    filename,
                    uri: `file://${destinationPath}`,
                    timestamp: new Date().toISOString(),
                    metadata: {
                      duration: asset.duration || 0,
                      format: asset.type?.split('/')[1] || 'mp4',
                      size: asset.fileSize || 0,
                      width: asset.width,
                      height: asset.height,
                    },
                  },
                };

                console.log('Video recorded successfully:', videoResult);
                resolve(videoResult);
              } catch (fileError: any) {
                console.error('Error saving video file:', fileError);
                reject({
                  fieldId,
                  status: 'error',
                  message: `Error saving video: ${fileError.message}`,
                });
              }
            } else {
              reject({
                fieldId,
                status: 'error',
                message: 'No video data received',
              });
            }
          });
        } catch (error: any) {
          console.error('Error in video handler:', error);
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          reject({
            fieldId,
            status: 'error',
            message: `Video error: ${errorMessage}`,
          });
        }
      });
    },
    onRequestFile: async (fieldId: string): Promise<any> => {
      console.log('Request file handler called', fieldId);

      try {
        // Import DocumentPicker dynamically to handle cases where it might not be available
        const DocumentPicker = require('@react-native-documents/picker');

        // Pick a single file (new API returns array, destructure first item)
        const [result] = await DocumentPicker.pick({
          type: [DocumentPicker.types.allFiles],
          copyTo: 'cachesDirectory', // Copy to cache for access
        });

        console.log('File selected:', result);

        // Create FileResult object matching our interface
        return {
          fieldId,
          status: 'success' as const,
          data: {
            filename: result.name,
            uri: result.fileCopyUri || result.uri, // Use copied URI if available
            size: result.size || 0,
            mimeType: result.type || 'application/octet-stream',
            type: 'file' as const,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error: any) {
        console.log('File selection error or cancelled:', error);

        // Check if DocumentPicker is available and if this is a cancellation
        let isCancel = false;
        try {
          const DocumentPicker = require('@react-native-documents/picker');
          isCancel = DocumentPicker.isCancel(error);
        } catch (importError) {
          // DocumentPicker not available, treat as regular error
        }

        if (isCancel) {
          // User cancelled the picker
          return {
            fieldId,
            status: 'cancelled' as const,
            message: 'File selection was cancelled',
          };
        } else {
          // Other error occurred
          return {
            fieldId,
            status: 'error' as const,
            message: error.message || 'Failed to select file',
          };
        }
      }
    },
    onLaunchIntent: (fieldId: string, intentSpec: Record<string, any>) => {
      // TODO: implement launch intent logic
      console.log('Launch intent handler called', fieldId, intentSpec);
    },
    onCallSubform: (
      fieldId: string,
      formType: string,
      options: Record<string, any>,
    ) => {
      // TODO: implement call subform logic
      console.log('Call subform handler called', fieldId, formType, options);
    },
    onRequestAudio: async (fieldId: string): Promise<any> => {
      console.log('Request audio handler called', fieldId);

      try {
        // Import NitroSound dynamically to handle cases where it might not be available
        const NitroSound = require('react-native-nitro-sound');

        // Create a unique filename for the audio recording
        const timestamp = Date.now();
        const filename = `audio_${timestamp}.m4a`;
        const documentsPath = require('react-native-fs').DocumentDirectoryPath;
        const audioPath = `${documentsPath}/${filename}`;

        console.log('Starting audio recording to:', audioPath);

        // Start recording
        const recorder = await NitroSound.createRecorder({
          path: audioPath,
          format: 'aac', // AAC format for .m4a files
          quality: 'high',
          sampleRate: 44100,
          channels: 1,
        });

        await recorder.start();

        // For demo purposes, we'll record for a fixed duration
        // In a real implementation, you'd want user controls for start/stop
        await new Promise<void>(resolve => setTimeout(() => resolve(), 3000)); // 3 second recording

        const result = await recorder.stop();

        console.log('Audio recording completed:', result);

        // Get file stats for metadata
        const RNFS = require('react-native-fs');
        const fileStats = await RNFS.stat(audioPath);

        // Create AudioResult object matching our interface
        return {
          fieldId,
          status: 'success' as const,
          data: {
            type: 'audio' as const,
            filename: filename,
            uri: `file://${audioPath}`,
            timestamp: new Date().toISOString(),
            metadata: {
              duration: result.duration || 3.0, // Duration in seconds
              format: 'm4a',
              size: fileStats.size || 0,
            },
          },
        };
      } catch (error: any) {
        console.log('Audio recording error:', error);

        // Check if this is a user cancellation or permission error
        if (
          error.code === 'PERMISSION_DENIED' ||
          error.message?.includes('permission')
        ) {
          return {
            fieldId,
            status: 'error' as const,
            message:
              'Microphone permission denied. Please enable microphone access in settings.',
          };
        } else if (error.code === 'USER_CANCELLED') {
          return {
            fieldId,
            status: 'cancelled' as const,
            message: 'Audio recording was cancelled',
          };
        } else {
          return {
            fieldId,
            status: 'error' as const,
            message: error.message || 'Failed to record audio',
          };
        }
      }
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
    onRunLocalModel: (
      fieldId: string,
      modelId: string,
      input: Record<string, any>,
    ) => {
      // TODO: implement run local model logic
      console.log('Run local model handler called', fieldId, modelId, input);
    },
    onGetAvailableForms: async (): Promise<FormInfo[]> => {
      try {
        const formService = await FormService.getInstance();
        const formSpecs = formService.getFormSpecs();

        return formSpecs.map(spec => {
          const schema = spec.schema || {};
          const properties = schema.properties || {};

          const coreFields: string[] = [];
          const auxiliaryFields: string[] = [];

          // Extract fields from schema properties
          Object.keys(properties).forEach(fieldName => {
            const field = properties[fieldName] || {};
            const isCore =
              field['x-core'] === true || fieldName.startsWith('core_');

            if (isCore) {
              coreFields.push(fieldName);
            } else {
              auxiliaryFields.push(fieldName);
            }
          });

          return {
            formType: spec.id,
            name: spec.name,
            version: spec.schemaVersion,
            coreFields,
            auxiliaryFields,
          };
        });
      } catch (error) {
        console.error(
          'FormulusMessageHandlers: failed to get available forms',
          error,
        );
        return [];
      }
    },
    onGetObservations: async (
      formType: string,
      isDraft?: boolean,
      includeDeleted?: boolean,
    ) => {
      console.log(
        'FormulusMessageHandlers: onGetObservations handler invoked.',
        {formType, isDraft, includeDeleted},
      );
      if (formType.hasOwnProperty('formType')) {
        console.debug(
          'FormulusMessageHandlers: onGetObservations handler invoked with formType object, expected string',
        );
        formType = (formType as any).formType;
        isDraft = (formType as any).isDraft;
        includeDeleted = (formType as any).includeDeleted;
      }
      const formService = await FormService.getInstance();
      const observations = await formService.getObservationsByFormType(
        formType,
      ); //TODO: Handle deleted etc.
      return observations;
    },
    onOpenFormplayer: async (
      data: FormInitData,
    ): Promise<FormCompletionResult> => {
      const {formType, params, savedData, observationId} = data;
      console.log(
        'FormulusMessageHandlers: onOpenFormplayer handler invoked with data:',
        data,
      );
      // Delegate to the shared helper so WebView and native callers share the same
      // promise-based behaviour and operation tracking.
      return startFormplayerOperation(
        formType,
        params,
        savedData,
        observationId ?? null,
      );
    },
    onFormplayerInitialized: (data: {formType?: string; status?: string}) => {
      console.log(
        'FormulusMessageHandlers: onFormplayerInitialized handler invoked.',
        data,
      );
      // Reserved for future hooks (e.g., native-side loading indicators or analytics).
      // Currently used only for logging/diagnostics so other WebViews are unaffected.
    },
    onFormulusReady: () => {
      console.log(
        'FormulusMessageHandlers: onFormulusReady handler invoked. WebView is ready.',
      );
      // TODO: Perform any actions needed when the WebView content signals it's ready
    },
    onReceiveFocus: () => {
      console.log(
        'FormulusMessageHandlers: onReceiveFocus handler invoked. WebView is ready.',
      );
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
