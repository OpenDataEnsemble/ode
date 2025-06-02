/**
 * FormulusWebViewHandler.ts
 * 
 * This module provides a reusable handler for WebView messages from both
 * the Formplayer and custom app WebViews. It processes messages according to
 * the Formulus interface and provides callbacks for specific message types.
 */

import { WebViewMessageEvent, WebView } from 'react-native-webview';
import CustomAppWebView, { CustomAppWebViewHandle } from '../components/CustomAppWebView';

// Add NodeJS type definitions
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Timeout {}
  }
}

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

interface MessageHandlerContext {
  data: any;
  webViewRef: React.RefObject<WebView | null>;
  event: WebViewMessageEvent;
}

type MessageHandler = (context: MessageHandlerContext) => void;

interface MessageHandlers {
  [key: string]: MessageHandler;
  __default__: MessageHandler;
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
  if (message.type === 'response' && message.requestId) {
    const pending = PENDING_REQUESTS.get(message.requestId);
    if (pending) {
      clearTimeout(pending.timeout as unknown as number);
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

/**
 * Create a message handler for WebView messages
 * @param webViewRef Reference to the WebView component
 * @param handlers Callback handlers for different message types
 * @returns A function that can be passed to the WebView's onMessage prop
 */
export function createFormulusMessageHandler(
  webViewRef: React.RefObject<WebView | null>,
  handlers: FormulusMessageHandlers
) {
  // Create a map of message handlers
  const messageHandlers: MessageHandlers = {
    // Default handler for unknown message types
    __default__: ({ data, event }) => {
      console.warn('Unknown message type:', data.type, data);
      if (handlers.onUnknownMessage) {
        handlers.onUnknownMessage(data);
      }
    },

    // Console log handlers
    'console.log': ({ data }) => {
      const logArgs = data.args || [];
      console.log('[WebView]', ...logArgs);
    },
    'console.warn': ({ data }) => {
      const logArgs = data.args || [];
      console.warn('[WebView]', ...logArgs);
    },
    'console.error': ({ data }) => {
      const logArgs = data.args || [];
      console.error('[WebView]', ...logArgs);
    },
    'console.info': ({ data }) => {
      const logArgs = data.args || [];
      console.info('[WebView]', ...logArgs);
    },
    'console.debug': ({ data }) => {
      const logArgs = data.args || [];
      console.debug('[WebView]', ...logArgs);
    },

    // Form related handlers
    'initForm': ({ webViewRef }) => {
      if (handlers.onInitForm) {
        handlers.onInitForm();
      }
    },
    'savePartial': ({ data, webViewRef }) => {
      if (handlers.onSavePartial && data.formId) {
        handlers.onSavePartial(data.formId, data.data);
      }
    },
    'submitForm': ({ data, webViewRef }) => {
      if (handlers.onSubmitForm && data.formId) {
        handlers.onSubmitForm(data.formId, data.finalData);
      }
    },
    'requestCamera': ({ data, webViewRef }) => {
      if (handlers.onRequestCamera && data.fieldId) {
        handlers.onRequestCamera(data.fieldId);
      }
    },
    'requestLocation': ({ data, webViewRef }) => {
      if (handlers.onRequestLocation && data.fieldId) {
        handlers.onRequestLocation(data.fieldId);
      }
    },
    'requestFile': ({ data, webViewRef }) => {
      if (handlers.onRequestFile && data.fieldId) {
        handlers.onRequestFile(data.fieldId);
      }
    },
    'launchIntent': ({ data, webViewRef }) => {
      if (handlers.onLaunchIntent && data.fieldId && data.intentSpec) {
        handlers.onLaunchIntent(data.fieldId, data.intentSpec);
      }
    },
    'callSubform': ({ data, webViewRef }) => {
      if (handlers.onCallSubform && data.fieldId && data.formId) {
        handlers.onCallSubform(data.fieldId, data.formId, data.options || {});
      }
    },
    'requestAudio': ({ data, webViewRef }) => {
      if (handlers.onRequestAudio && data.fieldId) {
        handlers.onRequestAudio(data.fieldId);
      }
    },
    'requestSignature': ({ data, webViewRef }) => {
      if (handlers.onRequestSignature && data.fieldId) {
        handlers.onRequestSignature(data.fieldId);
      }
    },
    'requestBiometric': ({ data, webViewRef }) => {
      if (handlers.onRequestBiometric && data.fieldId) {
        handlers.onRequestBiometric(data.fieldId);
      }
    },
    'requestConnectivityStatus': ({ webViewRef }) => {
      if (handlers.onRequestConnectivityStatus) {
        handlers.onRequestConnectivityStatus();
      }
    },
    'requestSyncStatus': ({ webViewRef }) => {
      if (handlers.onRequestSyncStatus) {
        handlers.onRequestSyncStatus();
      }
    },
    'runLocalModel': ({ data, webViewRef }) => {
      if (handlers.onRunLocalModel && data.fieldId && data.modelId) {
        handlers.onRunLocalModel(data.fieldId, data.modelId, data.input || {});
      }
    },

    // Handle Promise responses
    'response': ({ data }) => {
      handleResponse(data);
    },
    'callback': ({ data }) => {
      if (data.error) {
        console.error('Callback error:', data.error);
      } else {
        console.log('Callback completed successfully');
      }
    }
  };

  // Return the actual message handler function
  return async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('Received message:', message);

      const { type, ...data } = message;
      // Get the appropriate handler or use the default one
      const handler = messageHandlers[type] || messageHandlers.__default__;
      
      // Call the handler with the context
      handler({
        data,
        webViewRef,
        event
      });
    } catch (error) {
      console.error('Failed to handle WebView message:', error);
      if (handlers.onError) {
        handlers.onError(error as Error);
      }
    }
  };
}

/**
 * Send data to the WebView
 * @param webViewRef Reference to the WebView component
 * @param callbackName Name of the callback function to call
 * @param data Data to send to the WebView
 * @param isPromise Whether to use promise-based response
 */
export function sendToWebView<T = void>(
  webViewRef: React.RefObject<CustomAppWebViewHandle>,
  callbackName: string,
  data: any = {},
  isPromise: boolean = true
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
  webViewRef: React.RefObject<CustomAppWebViewHandle>,
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
  webViewRef: React.RefObject<CustomAppWebViewHandle>,
  attachmentData: any
): Promise<void> {
  return sendToWebView<void>(
    webViewRef,
    'onAttachmentData',
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
  webViewRef: React.RefObject<CustomAppWebViewHandle>,
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
