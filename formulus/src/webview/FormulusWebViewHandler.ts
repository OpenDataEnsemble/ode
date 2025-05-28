/**
 * FormulusWebViewHandler.ts
 * 
 * This module provides a reusable handler for WebView messages from both
 * the Formplayer and custom app WebViews. It processes messages according to
 * the Formulus interface and provides callbacks for specific message types.
 */

import { WebViewMessageEvent, WebView } from 'react-native-webview';

// Types for message handling
export interface FormInitData {
  formId: string;
  params: Record<string, any>;
  savedData: Record<string, any>;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
}

const PENDING_REQUESTS = new Map<string, PendingRequest>();
const REQUEST_TIMEOUT = 30000; // 30 seconds timeout

export interface FormulusMessageHandlers {
  onInitForm?: () => void;
  onSavePartial?: (formId: string, data: Record<string, any>) => void;
  onSubmitForm?: (formId: string, finalData: Record<string, any>) => void;
  onRequestCamera?: (fieldId: string) => void;
  onRequestLocation?: (fieldId: string) => void;
  onRequestFile?: (fieldId: string) => void;
  onLaunchIntent?: (fieldId: string, intentSpec: Record<string, any>) => void;
  onCallSubform?: (fieldId: string, formId: string, options: Record<string, any>) => void;
  onRequestAudio?: (fieldId: string) => void;
  onRequestSignature?: (fieldId: string) => void;
  onRequestBiometric?: (fieldId: string) => void;
  onRequestConnectivityStatus?: () => void;
  onRequestSyncStatus?: () => void;
  onRunLocalModel?: (fieldId: string, modelId: string, input: Record<string, any>) => void;
  onUnknownMessage?: (message: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Create a message handler for WebView messages
 * @param webViewRef Reference to the WebView component
 * @param handlers Callback handlers for different message types
 * @returns A function that can be passed to the WebView's onMessage prop
 */
function handleResponse(message: any) {
  // Handle Promise responses
  if (message.type === 'response' && message.requestId) {
    const pending = PENDING_REQUESTS.get(message.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      if (message.error) {
        pending.reject(new Error(message.error));
      } else {
        pending.resolve(message.result);
      }
      PENDING_REQUESTS.delete(message.requestId);
    }
    return true;
  }
  return false;
}

export function createFormulusMessageHandler(
  webViewRef: React.RefObject<WebView>,
  handlers: FormulusMessageHandlers
) {
  return (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('Received message from WebView:', message);
      
      // Handle Promise responses
      if (message.type === 'response' && message.requestId) {
        handleResponse(message);
        return;
      }
      
      // Handle callback responses
      if (message.type === 'callback') {
        // For now, just log the callback result
        if (message.error) {
          console.error('Callback error:', message.error);
        } else {
          console.log('Callback completed successfully');
        }
        return;
      }
      
      switch (message.type) {
        case 'initForm':
          // WebView is requesting form initialization
          if (handlers.onInitForm) {
            handlers.onInitForm();
          }
          break;
          
        case 'savePartial':
          // WebView is requesting to save partial form data
          if (message.formId && message.data && handlers.onSavePartial) {
            handlers.onSavePartial(message.formId, message.data);
          }
          break;
          
        case 'submitForm':
          // WebView is requesting to submit the completed form
          if (message.formId && message.finalData && handlers.onSubmitForm) {
            handlers.onSubmitForm(message.formId, message.finalData);
          }
          break;
          
        case 'requestCamera':
          // WebView is requesting camera access
          if (message.fieldId && handlers.onRequestCamera) {
            handlers.onRequestCamera(message.fieldId);
          }
          break;
          
        case 'requestLocation':
          // WebView is requesting location
          if (message.fieldId && handlers.onRequestLocation) {
            handlers.onRequestLocation(message.fieldId);
          }
          break;
          
        case 'requestFile':
          // WebView is requesting file picker
          if (message.fieldId && handlers.onRequestFile) {
            handlers.onRequestFile(message.fieldId);
          }
          break;
          
        case 'launchIntent':
          // WebView is requesting to launch an Android intent
          if (message.fieldId && message.intentSpec && handlers.onLaunchIntent) {
            handlers.onLaunchIntent(message.fieldId, message.intentSpec);
          }
          break;
          
        case 'callSubform':
          // WebView is requesting to call a subform
          if (message.fieldId && message.formId && message.options && handlers.onCallSubform) {
            handlers.onCallSubform(message.fieldId, message.formId, message.options);
          }
          break;
          
        case 'requestAudio':
          // WebView is requesting audio recording
          if (message.fieldId && handlers.onRequestAudio) {
            handlers.onRequestAudio(message.fieldId);
          }
          break;
          
        case 'requestSignature':
          // WebView is requesting signature capture
          if (message.fieldId && handlers.onRequestSignature) {
            handlers.onRequestSignature(message.fieldId);
          }
          break;
          
        case 'requestBiometric':
          // WebView is requesting biometric authentication
          if (message.fieldId && handlers.onRequestBiometric) {
            handlers.onRequestBiometric(message.fieldId);
          }
          break;
          
        case 'requestConnectivityStatus':
          // WebView is requesting connectivity status
          if (handlers.onRequestConnectivityStatus) {
            handlers.onRequestConnectivityStatus();
          }
          break;
          
        case 'requestSyncStatus':
          // WebView is requesting sync status
          if (handlers.onRequestSyncStatus) {
            handlers.onRequestSyncStatus();
          }
          break;
          
        case 'runLocalModel':
          // WebView is requesting to run a local ML model
          if (message.fieldId && message.modelId && message.input && handlers.onRunLocalModel) {
            handlers.onRunLocalModel(message.fieldId, message.modelId, message.input);
          }
          break;
          
        default:
          // Unknown message type
          if (handlers.onUnknownMessage) {
            handlers.onUnknownMessage(message);
          } else {
            console.warn('Unknown message type from WebView:', message.type);
          }
      }
    } catch (err) {
      // Error handling
      if (handlers.onError) {
        handlers.onError(err instanceof Error ? err : new Error(String(err)));
      } else {
        console.error('Failed to handle WebView message:', err);
      }
    }
  };
}

/**
 * Send data to the WebView
 * @param webViewRef Reference to the WebView component
 * @param callbackName Name of the callback function to call
 * @param data Data to send to the WebView
 */
export function sendToWebView<T = void>(
  webViewRef: React.RefObject<WebView>,
  callbackName: string,
  data: any = {},
  isPromise: boolean = false
): Promise<T> {
  if (!webViewRef.current) {
    const error = 'WebView ref is not available';
    console.warn(error);
    return Promise.reject(new Error(error));
  }

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const message = {
    type: callbackName,
    requestId: isPromise ? requestId : undefined,
    ...data
  };

  if (!isPromise) {
    // Non-Promise callback
    return new Promise((resolve, reject) => {
      try {
        webViewRef.current?.injectJavaScript(`
          (function() {
            try {
              if (window.${callbackName}) {
                window.${callbackName}(${JSON.stringify(data)});
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'callback',
                  requestId: '${Date.now()}_${Math.random().toString(36).substr(2, 9)}',
                  success: true
                }));
              } else {
                console.warn('Callback ${callbackName} not found');
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'callback',
                  requestId: '${Date.now()}_${Math.random().toString(36).substr(2, 9)}',
                  error: 'Callback ${callbackName} not found'
                }));
              }
            } catch (error) {
              console.error('Error in ${callbackName}:', error);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'callback',
                requestId: '${Date.now()}_${Math.random().toString(36).substr(2, 9)}',
                error: error?.message || 'Unknown error in callback'
              }));
            }
          })();
          true; // Always return true to prevent warnings
        `);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Promise-based response
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      PENDING_REQUESTS.delete(requestId);
      reject(new Error('Request timed out'));
    }, REQUEST_TIMEOUT);

    PENDING_REQUESTS.set(requestId, {
      resolve,
      reject,
      timeout
    });

    webViewRef.current.injectJavaScript(`
      (function() {
        try {
          if (window.${callbackName}) {
            Promise.resolve(window.${callbackName}(${JSON.stringify(data)}))
              .then(result => ({
                type: 'response',
                requestId: '${requestId}',
                result
              }))
              .catch(error => ({
                type: 'response',
                requestId: '${requestId}',
                error: error?.message || String(error)
              }))
              .then(response => window.ReactNativeWebView.postMessage(JSON.stringify(response)));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'response',
              requestId: '${requestId}',
              error: 'Callback ${callbackName} not found'
            }));
          }
        } catch (error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'response',
            requestId: '${requestId}',
            error: error?.message || 'Unknown error'
          }));
        }
      })();
      true; // Always return true to prevent warnings
    `);
  });
}

/**
 * Send form initialization data to the WebView
 * @param webViewRef Reference to the WebView component
 * @param formData Form initialization data
 * @returns Promise that resolves when the WebView has processed the initialization
 */
export function sendFormInit(
  webViewRef: React.RefObject<WebView>,
  formData: FormInitData
): Promise<void> {
  const { formId, params = {}, savedData = {} } = formData;
  
  console.log('Sending form init data to WebView:', {
    formId,
    paramsKeys: Object.keys(params),
    hasSavedData: !!savedData,
    savedDataKeys: savedData ? Object.keys(savedData) : []
  });

  return sendToWebView<void>(
    webViewRef,
    'onFormInit',
    {
      formId,
      params,
      savedData: savedData || {}
    },
    true // Enable Promise support
  );
}

/**
 * Send attachment data to the WebView
 * @param webViewRef Reference to the WebView component
 * @param attachmentData Attachment data
 * @returns Promise that resolves when the WebView has processed the attachment
 */
export function sendAttachmentData(
  webViewRef: React.RefObject<WebView>,
  attachmentData: any
): Promise<void> {
  return sendToWebView<void>(
    webViewRef,
    'onAttachmentReady',
    attachmentData,
    true // Enable Promise support
  );
}

/**
 * Send save partial completion status to the WebView
 * @param webViewRef Reference to the WebView component
 * @param formId Form ID
 * @param success Whether the save was successful
 * @returns Promise that resolves when the WebView has processed the save status
 */
export function sendSavePartialComplete(
  webViewRef: React.RefObject<WebView>,
  formId: string,
  success: boolean
): Promise<void> {
  return sendToWebView<void>(
    webViewRef,
    'onSavePartialComplete',
    { formId, success },
    true // Enable Promise support
  );
}
