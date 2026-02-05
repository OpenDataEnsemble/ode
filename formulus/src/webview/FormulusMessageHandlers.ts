/*
This is where the actual implementation of the methods happens on the React Native side. 
It handles the messages received from the WebView and executes the corresponding native functionality.
*/
import { GeolocationService } from '../services/GeolocationService';
import { WebViewMessageEvent, WebView } from 'react-native-webview';
import RNFS from 'react-native-fs';
import * as Keychain from 'react-native-keychain';
import { Alert } from 'react-native';
import ImagePicker from 'react-native-image-picker';
import {
  pick,
  types,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import {
  FormInitData,
  FormCompletionResult,
  FormInfo,
} from './FormulusInterfaceDefinition';
import { FormulusMessageHandlers } from './FormulusMessageHandlers.types';

// NitroSound is disabled for emulator in react-native.config.js - do not load the module
// to avoid "Sound HybridObject not registered" console errors. Load lazily only when
// the native module is available (re-enable in react-native.config.js and rebuild).
let NitroSound: {
  startRecorder: (path: string, opts: unknown) => Promise<void>;
  stopRecorder: () => Promise<void>;
} | null = null;
type AudioSet = {
  AudioSamplingRate: number;
  AudioEncodingBitRate: number;
  AudioChannels: number;
};
import { FormService } from '../services/FormService';
import { Observation, ObservationData } from '../database/models/Observation';

export type HandlerArgs = {
  data: unknown;
  webViewRef: React.RefObject<WebView | null>;
  event: WebViewMessageEvent;
};

export type Handler = (args: HandlerArgs) => void | Promise<void>;

// Simple event emitter for cross-component communication
export type Listener = (...args: unknown[]) => void;

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

  emit(eventName: string, ...args: unknown[]): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName].forEach(listener => listener(...args));
  }
}

export const appEvents = new SimpleEventEmitter();

const pendingFormOperations = new Map<
  string,
  {
    resolve: (result: FormCompletionResult) => void;
    reject: (error: Error) => void;
    formType: string;
    startTime: number;
  }
>();

const startFormplayerOperation = (
  formType: string,
  params: Record<string, unknown> = {},
  savedData: Record<string, unknown> = {},
  observationId: string | null = null,
): Promise<FormCompletionResult> => {
  const operationId = `${formType}_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  return new Promise<FormCompletionResult>((resolve, reject) => {
    pendingFormOperations.set(operationId, {
      resolve,
      reject,
      formType,
      startTime: Date.now(),
    });

    appEvents.emit('openFormplayerRequested', {
      formType,
      params,
      savedData,
      observationId,
      operationId,
    });

    setTimeout(
      () => {
        if (pendingFormOperations.has(operationId)) {
          pendingFormOperations.delete(operationId);
          reject(new Error('Form operation timed out'));
        }
      },
      8 * 60 * 60 * 1000,
    );
  });
};

export const openFormplayerFromNative = (
  formType: string,
  params: Record<string, unknown> = {},
  savedData: Record<string, unknown> = {},
  observationId: string | null = null,
): Promise<FormCompletionResult> => {
  return startFormplayerOperation(formType, params, savedData, observationId);
};

let activeFormplayerModalRef: {
  handleSubmission: (data: {
    formType: string;
    finalData: Record<string, unknown>;
  }) => Promise<string>;
} | null = null;

export const setActiveFormplayerModal = (
  modalRef: {
    handleSubmission: (data: {
      formType: string;
      finalData: Record<string, unknown>;
    }) => Promise<string>;
  } | null,
) => {
  activeFormplayerModalRef = modalRef;
};

export const resolveFormOperation = (
  operationId: string,
  result: FormCompletionResult,
) => {
  const operation = pendingFormOperations.get(operationId);
  if (operation) {
    operation.resolve(result);
    pendingFormOperations.delete(operationId);
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

export const rejectFormOperation = (operationId: string, error: Error) => {
  const operation = pendingFormOperations.get(operationId);
  if (operation) {
    operation.reject(error);
    pendingFormOperations.delete(operationId);
  }
};

const saveFormData = async (
  formType: string,
  data: ObservationData,
  observationId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isPartial = true,
) => {
  try {
    const observation: Partial<Observation> = {
      formType,
      data,
    };

    if (observationId !== null) {
      observation.observationId = observationId;
      observation.updatedAt = new Date();
    } else {
      observation.createdAt = new Date();
    }

    const formService = await FormService.getInstance();
    const id =
      observationId !== null
        ? await formService.updateObservation(observationId, data)
        : await formService.addNewObservation(formType, data);

    return id;
  } catch (error) {
    console.error('Error saving form data:', error);
    return null;
  }
};

export function createFormulusMessageHandlers(): FormulusMessageHandlers {
  return {
    onInitForm: (payload: unknown) => {
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
      finalData: Record<string, unknown>;
    }) => {
      const { formType, finalData } = data;
      console.log(
        'FormulusMessageHandlers: onSubmitObservation handler invoked.',
        { formType, finalData },
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
      finalData: Record<string, unknown>;
    }) => {
      return await saveFormData(
        data.formType,
        data.finalData,
        data.observationId,
        false,
      );
    },
    onRequestCamera: async (fieldId: string): Promise<unknown> => {
      console.log('Request camera handler called', fieldId);

      return new Promise(resolve => {
        try {
          if (!ImagePicker || !ImagePicker.launchImageLibrary) {
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
            quality: 0.8 as const,
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

          // Common response handler for both camera and gallery
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                    const r = Math.floor(Math.random() * 16);
                    const v = c === 'x' ? r : (r % 4) + 8;
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
                .catch(error => {
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
    onRequestQrcode: async (fieldId: string): Promise<unknown> => {
      console.log('Request QR code handler called', fieldId);

      return new Promise(resolve => {
        try {
          // Emit event to open QR scanner modal
          appEvents.emit('openQRScanner', {
            fieldId,
            onResult: (result: unknown) => {
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
    onRequestSignature: async (fieldId: string): Promise<unknown> => {
      console.log('Request signature handler called', fieldId);

      return new Promise(resolve => {
        try {
          // Emit event to open signature capture modal
          appEvents.emit('openSignatureCapture', {
            fieldId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onResult: async (result: any) => {
              console.log('Signature capture result received:', result);

              try {
                // If the result contains base64 data, save it to file and return URI
                if (
                  result.status === 'success' &&
                  result.data &&
                  result.data.base64
                ) {
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
              } catch (fileError) {
                console.error('Error saving signature file:', fileError);
                resolve({
                  fieldId,
                  status: 'error',
                  message: `Error saving signature: ${fileError}`,
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

    onRequestLocation: async (fieldId: string): Promise<unknown> => {
      console.log('Request location handler called', fieldId);

      // eslint-disable-next-line no-async-promise-executor
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
        } catch (error) {
          console.error('Location capture failed:', error);

          const errorResult = {
            fieldId,
            status: 'error' as const,
            message: 'Location capture failed',
          };

          reject(errorResult);
        }
      });
    },
    onRequestVideo: async (fieldId: string): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        try {
          const options = {
            mediaType: 'video' as const,
            videoQuality: 'high' as const,
            durationLimit: 60, // 60 seconds max
            storageOptions: {
              skipBackup: true,
              path: 'videos',
            },
          };
          ImagePicker.launchCamera(options, async response => {
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
                if (asset.uri) {
                  await RNFS.copyFile(asset.uri, destinationPath);
                } else {
                  console.error('Asset uri not available', asset);
                }

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
              } catch (fileError) {
                console.error('Error saving video file:', fileError);
                reject({
                  fieldId,
                  status: 'error',
                  message: `Error saving video: ${fileError}`,
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
        } catch (error) {
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

    onRequestFile: async (fieldId: string) => {
      console.log('Request file handler called (v12 API)', fieldId);
      try {
        const [result] = await pick({
          type: [types.allFiles],
          mode: 'import',
          allowMultiSelection: false,
        });

        console.log('File selected:', result);

        return {
          fieldId,
          status: 'success' as const,
          data: {
            filename: result.name,
            uri: result.uri,
            size: result.size || 0,
            mimeType: result.type || 'application/octet-stream',
            type: 'file' as const,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        if (isErrorWithCode(error)) {
          if (error.code === errorCodes.OPERATION_CANCELED) {
            return {
              fieldId,
              status: 'cancelled' as const,
              message: 'File selection was cancelled',
            };
          }
        }
        return {
          fieldId,
          status: 'error' as const,
          message:
            error instanceof Error ? error.message : 'Failed to select file',
        };
      }
    },

    onLaunchIntent: (fieldId: string, intentSpec: Record<string, unknown>) => {
      // TODO: implement launch intent logic
      console.log('Launch intent handler called', fieldId, intentSpec);
    },
    onCallSubform: (
      fieldId: string,
      formType: string,
      options: Record<string, unknown>,
    ) => {
      // TODO: implement call subform logic
      console.log('Call subform handler called', fieldId, formType, options);
    },
    onRequestAudio: async (fieldId: string) => {
      // Lazy-load NitroSound only when audio is requested (avoids console error on startup when disabled)
      if (!NitroSound) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const ns = require('react-native-nitro-sound');
          NitroSound = ns.default;
        } catch {
          NitroSound = null;
        }
      }
      if (!NitroSound) {
        return {
          fieldId,
          status: 'error' as const,
          message:
            'Audio recording not available. Re-enable react-native-nitro-sound in react-native.config.js and rebuild.',
        };
      }
      try {
        const filename = `audio_${Date.now()}.m4a`;
        const path = `${RNFS.DocumentDirectoryPath}/${filename}`;

        const audioSet: AudioSet = {
          // Common settings automatically applied to the appropriate platform
          AudioSamplingRate: 44100,
          AudioEncodingBitRate: 128000,
          AudioChannels: 1,
        };

        await NitroSound.startRecorder(path, audioSet);

        // For demo purposes, we'll record for a fixed duration
        // In a real implementation, you'd want user controls for start/stop
        await new Promise<void>(r => setTimeout(() => r(), 3000));
        await NitroSound.stopRecorder();
        const fileStats = await RNFS.stat(path);
        return {
          fieldId,
          status: 'success' as const,
          data: {
            type: 'audio' as const,
            filename: filename,
            uri: `file://${path}`,
            timestamp: new Date().toISOString(),
            metadata: {
              duration: 3.0,
              format: 'm4a',
              size: fileStats.size || 0,
            },
          },
        };
      } catch (error) {
        console.log('Audio recording error:', error);

        // Check if this is a user cancellation or permission error
        console.log('Audio recording error:', error);

        if (typeof error === 'object' && error !== null) {
          const err = error as Record<string, unknown>;

          if (
            err.code === 'PERMISSION_DENIED' ||
            (typeof err.message === 'string' &&
              err.message.includes('permission'))
          ) {
            return {
              fieldId,
              status: 'error' as const,
              message:
                'Microphone permission denied. Please enable microphone access in settings.',
            };
          }

          if (err.code === 'USER_CANCELLED') {
            return {
              fieldId,
              status: 'cancelled' as const,
              message: 'Audio recording was cancelled',
            };
          }

          return {
            fieldId,
            status: 'error' as const,
            message:
              typeof err.message === 'string'
                ? err.message
                : 'Failed to record audio',
          };
        }

        return {
          fieldId,
          status: 'error' as const,
          message: String(error),
        };
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
      input: Record<string, unknown>,
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

    onGetCurrentUser: async (): Promise<{
      username: string;
      displayName?: string;
    }> => {
      try {
        const credentials = await Keychain.getGenericPassword();
        if (credentials) {
          return {
            username: credentials.username,
            displayName: credentials.username,
          };
        } else {
          throw new Error('No user credentials found');
        }
      } catch (error) {
        console.error(
          'FormulusMessageHandlers: Failed to get current user:',
          error,
        );
        throw new Error('Unable to retrieve user information');
      }
    },
    onGetObservations: async (
      formType: string | { formType: string },
      isDraft?: boolean,
      includeDeleted?: boolean,
    ) => {
      console.log(
        'FormulusMessageHandlers: onGetObservations handler invoked.',
        { formType, isDraft, includeDeleted },
      );

      // Extract the actual formType string value
      let formTypeString: string;
      if (typeof formType === 'string') {
        formTypeString = formType;
      } else if (
        typeof formType === 'object' &&
        formType !== null &&
        'formType' in formType
      ) {
        console.debug(
          'FormulusMessageHandlers: onGetObservations received formType as object, extracting string value',
        );
        formTypeString = formType.formType;
      } else {
        console.error(
          'FormulusMessageHandlers: onGetObservations received invalid formType parameter',
          formType,
        );
        return [];
      }

      const service = await FormService.getInstance();
      //TODO: Handle deleted etc.
      return await service.getObservationsByFormType(formTypeString);
    },
    onGetObservationsByQuery: async (payload: {
      options?: {
        formType: string;
        isDraft?: boolean;
        includeDeleted?: boolean;
        whereClause?: string | null;
      };
      formType?: string;
      isDraft?: boolean;
      includeDeleted?: boolean;
      whereClause?: string | null;
    }) => {
      const options = (payload?.options ?? payload) as {
        formType: string;
        isDraft?: boolean;
        includeDeleted?: boolean;
        whereClause?: string | null;
      };
      if (!options?.formType) {
        console.warn('onGetObservationsByQuery: missing formType');
        return [];
      }

      const service = await FormService.getInstance();
      return await service.getObservationsByQuery(options);
    },
    onOpenFormplayer: async (data: FormInitData) => {
      return startFormplayerOperation(
        data.formType,
        data.params,
        data.savedData,
        data.observationId ?? null,
      );
    },
    onFormplayerInitialized: (_data: {
      formType?: string;
      status?: string;
    }) => {
      // Reserved for future hooks (e.g., native-side loading indicators or analytics).
    },
    onFormulusReady: () => {
      // TODO: Perform any actions needed when the WebView content signals it's ready
    },
    onReceiveFocus: () => {
      // TODO: Perform any actions needed when the WebView content signals it's ready
    },
    onUnknownMessage: (_message: unknown) => {
      // Unhandled message type - no-op by default
    },
    onError: (error: Error) => {
      console.error('WebView Handler Error:', error);
    },
  };
}
