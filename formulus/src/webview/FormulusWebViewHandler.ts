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
  params?: Record<string, any>;
  savedData?: Record<string, any>;
  formSchema?: any; // Optional: The JSON schema for the form
  uiSchema?: any;   // Optional: The UI schema for the form
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
}

interface MessageHandlerContext {
  data: any; // This is now the payload part of the message (message content excluding type and messageId)
  webViewRef: React.RefObject<WebView | null>;
  event: WebViewMessageEvent; // Original WebView event
  type: string; // Original message type from the WebView message
  messageId?: string; // Original messageId from the WebView message, if present
}

type MessageHandler = (context: MessageHandlerContext) => Promise<void> | void;

interface MessageHandlers {
  [key: string]: MessageHandler;
  __default__: MessageHandler;
}

const PENDING_REQUESTS = new Map<string, PendingRequest>();
const REQUEST_TIMEOUT = 30000; // 30 seconds timeout

import { createFormulusMessageHandlers } from './FormulusMessageHandlers';

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
  logSourceName: string = 'WebView' // Default to 'WebView' if not provided
) {
  const nativeSideHandlers = createFormulusMessageHandlers();

  // Helper function to call native handlers and send responses
  async function _callHandlerAndRespond(
    handlerMethod: ((...args: any[]) => Promise<any> | any) | undefined,
    handlerArgs: any[],
    messageType: string, // The original 'type' from the WebView message
    messageId: string | undefined, // The 'messageId' from the WebView message, if any
    currentWebViewRef: React.RefObject<WebView | null>
  ) {
    if (!handlerMethod) {
      console.warn(`Native Host: No method found in FormulusMessageHandlers for message type '${messageType}'.`);
      if (messageId && currentWebViewRef.current) {
        const errorResponse = { type: `${messageType}_response`, messageId, error: `Handler for ${messageType} not implemented on native side.` };
        const script = `window.postMessage(${JSON.stringify(errorResponse)}, '*');`;
        currentWebViewRef.current.injectJavaScript(script);
      }
      return;
    }

    try {
      const result = await handlerMethod(...handlerArgs);

      if (messageId && currentWebViewRef.current) {
        const response = { type: `${messageType}_response`, messageId, result };
        const script = `window.postMessage(${JSON.stringify(response)}, '*');`;
        // console.log(`Native Host (${messageType}): Sending response:`, response); // Optional: for debugging
        currentWebViewRef.current.injectJavaScript(script);
      } else if (messageId) {
        // This case means messageId was present, but webViewRef.current was null when trying to respond.
        console.error(`Native Host (${messageType}): Cannot send response. WebView ref missing.`, { messageId, result });
      }
      // If no messageId, it's treated as a fire-and-forget, or the handler itself manages responses via other means.
    } catch (e: any) {
      console.error(`Native Host (${messageType}): Error in handler:`, e);
      if (messageId && currentWebViewRef.current) {
        const errorResponse = { type: `${messageType}_response`, messageId, error: e.message || `Unknown error in ${messageType} handler` };
        const script = `window.postMessage(${JSON.stringify(errorResponse)}, '*');`;
        currentWebViewRef.current.injectJavaScript(script);
      }
    }
  }

  const messageHandlers: MessageHandlers = {
    // Default handler for unknown message types
    __default__: async ({ data, event, type, messageId }) => { // Added type, messageId from context
      console.warn(`Native Host: Unhandled message type '${type}':`, data, event);
      if (nativeSideHandlers.onUnknownMessage) {
        // Pass the full original message structure if onUnknownMessage expects it
        nativeSideHandlers.onUnknownMessage({ type, messageId, ...data });
      }
      if (messageId && webViewRef.current) { // Ensure webViewRef is used from the outer scope
        const errorResponse = { type: `${type}_response`, messageId, error: `Unhandled message type: ${type}` };
        const script = `window.postMessage(${JSON.stringify(errorResponse)}, '*');`;
        webViewRef.current.injectJavaScript(script);
      }
    },

    // Console log handlers (now use logSourceName)
    'console.log': ({ data }) => { console.log(`[${logSourceName}]`, ...(data.args || [])); },
    'console.warn': ({ data }) => { console.warn(`[${logSourceName}]`, ...(data.args || [])); },
    'console.error': ({ data }) => { console.error(`[${logSourceName}]`, ...(data.args || [])); },
    'console.info': ({ data }) => { console.info(`[${logSourceName}]`, ...(data.args || [])); },
    'console.debug': ({ data }) => { console.debug(`[${logSourceName}]`, ...(data.args || [])); },

    'onFormulusReady': async ({ type, messageId }) => { // messageId will likely be undefined
      await _callHandlerAndRespond(nativeSideHandlers.onFormulusReady, [], type, messageId, webViewRef);
    },

    // --- Formulus API Handlers (using _callHandlerAndRespond) ---
    // Note: 'data' in context is the payload part of the message (message content excluding type and messageId)
    // 'type' and 'messageId' are directly from the context.

    'getVersion': async ({ type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onGetVersion, [], type, messageId, webViewRef);
    },
    'initForm': async ({ type, messageId }) => { // Assuming onInitForm might be async or we want to signal completion
      await _callHandlerAndRespond(nativeSideHandlers.onInitForm, [], type, messageId, webViewRef);
    },
    'savePartial': async ({ data, type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onSavePartial, [data.formId, data.data], type, messageId, webViewRef);
    },
    'submitForm': async ({ data, type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onSubmitForm, [data.formId, data.finalData], type, messageId, webViewRef);
    },
    'requestCamera': async ({ data, type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onRequestCamera, [data.fieldId], type, messageId, webViewRef);
    },
    'requestLocation': async ({ data, type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onRequestLocation, [data.fieldId], type, messageId, webViewRef);
    },
    'requestFile': async ({ data, type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onRequestFile, [data.fieldId], type, messageId, webViewRef);
    },
    'launchIntent': async ({ data, type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onLaunchIntent, [data.fieldId, data.intentSpec], type, messageId, webViewRef);
    },
    'callSubform': async ({ data, type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onCallSubform, [data.fieldId, data.formId, data.options || {}], type, messageId, webViewRef);
    },
    'requestAudio': async ({ data, type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onRequestAudio, [data.fieldId], type, messageId, webViewRef);
    },
    'requestSignature': async ({ data, type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onRequestSignature, [data.fieldId], type, messageId, webViewRef);
    },
    'requestBiometric': async ({ data, type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onRequestBiometric, [data.fieldId], type, messageId, webViewRef);
    },
    'requestConnectivityStatus': async ({ type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onRequestConnectivityStatus, [], type, messageId, webViewRef);
    },
    'requestSyncStatus': async ({ type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onRequestSyncStatus, [], type, messageId, webViewRef);
    },
    'runLocalModel': async ({ data, type, messageId }) => {
      await _callHandlerAndRespond(nativeSideHandlers.onRunLocalModel, [data.fieldId, data.modelId, data.input || {}], type, messageId, webViewRef);
    },
    // getAvailableForms was missing from the original, adding it based on common patterns
    'getAvailableForms': async ({ type, messageId }) => {
       await _callHandlerAndRespond(nativeSideHandlers.onGetAvailableForms, [], type, messageId, webViewRef);
    },
    // getObservations was missing, adding based on common patterns
    'getObservations': async ({ data, type, messageId }) => {
       await _callHandlerAndRespond(nativeSideHandlers.onGetObservations, [data.formId, data.isDraft, data.includeDeleted], type, messageId, webViewRef);
    },
    // openFormplayer was missing, adding based on common patterns
    'openFormplayer': async ({ data, type, messageId }) => {
       await _callHandlerAndRespond(nativeSideHandlers.onOpenFormplayer, [data.formId, data.params, data.savedData], type, messageId, webViewRef);
    },

    // Special handlers (kept as is, assuming they manage their own specific logic)
    'response': ({ data }) => {
      handleResponse(data); // Assumes handleResponse is defined elsewhere and handles these specific 'response' messages
    },
    'callback': ({ data }) => {
      if (data.error) {
        console.error('Callback error:', data.error);
      } else {
        console.log('Callback completed successfully');
      }
    }
  };

  // Return the actual message handler function to be used by WebView's onMessage prop
  return async (event: WebViewMessageEvent) => {
    let message;
    try {
      // Ensure event.nativeEvent.data is a string before parsing
      if (typeof event.nativeEvent.data === 'string') {
        message = JSON.parse(event.nativeEvent.data);
      } else {
        console.error('Native Host: Received non-string data from WebView', event.nativeEvent.data);
        return; // Cannot process non-string data
      }
      // console.log('Native Host: Received message:', message); // Optional: for debugging

      const { type, messageId, ...payload } = message; // Destructure type, messageId, and the rest as payload

      const handler = messageHandlers[type] || messageHandlers.__default__;
      
      // Call the handler with the necessary context
      // The context now includes 'type' and 'messageId' directly, and 'data' is the payload
      await handler({ 
        data: payload, 
        webViewRef, 
        event, 
        type, 
        messageId 
      });

    } catch (error) {
      console.error('Native Host: Failed to handle WebView message:', error, 'Raw data:', event.nativeEvent.data);
      // Attempt to send an error back to the WebView if a messageId was part of the unparsable message
      if (message && message.messageId && message.type && webViewRef.current) {
        const errorResponse = { 
          type: `${message.type}_response`, 
          messageId: message.messageId, 
          error: 'Native host failed to process message: ' + (error instanceof Error ? error.message : String(error))
        };
        const script = `window.postMessage(${JSON.stringify(errorResponse)}, '*');`;
        webViewRef.current.injectJavaScript(script);
      } else if (nativeSideHandlers.onError) {
        nativeSideHandlers.onError(error as Error);
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
  const { formId, params = {}, savedData = {}, formSchema, uiSchema } = formData;
  
  console.log('Sending form init data to WebView:', {
    formId,
    paramsKeys: Object.keys(params ?? {}),
    hasSavedData: !!savedData,
    savedDataKeys: Object.keys(savedData ?? {}),
    hasFormSchema: !!formSchema,
    hasUiSchema: !!uiSchema
  });

  return sendToWebView<void>(
    webViewRef,
    'onFormInit',
    {
      formId,
      params,
      savedData: savedData || {},
      formSchema,
      uiSchema
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
