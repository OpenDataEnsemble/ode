/**
 * FormulusWebViewHandler.ts
 * 
 * This module provides a reusable handler for WebView messages from both
 * the Formplayer and custom app WebViews. It processes messages according to
 * the Formulus interface and provides callbacks for specific message types.
 */

import { WebViewMessageEvent } from 'react-native-webview';
import { WebView } from 'react-native-webview';

// Types for message handlers
export interface FormInitData {
  formId: string;
  params: Record<string, any>;
  savedData: Record<string, any>;
}

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
export function createFormulusMessageHandler(
  webViewRef: React.RefObject<WebView>,
  handlers: FormulusMessageHandlers
) {
  return (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('Received message from WebView:', message);
      
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
export function sendToWebView(
  webViewRef: React.RefObject<WebView>,
  callbackName: string,
  data: any
): void {
  if (webViewRef.current) {
    console.log(`DEBUG: Sending data to WebView using callback: ${callbackName}`, {
      dataKeys: Object.keys(data),
      hasFormId: data.formId ? true : false,
      hasParams: data.params ? true : false,
      paramsKeys: data.params ? Object.keys(data.params) : [],
      hasSavedData: data.savedData ? true : false,
    });
    
    const script = `
      console.log('DEBUG: Inside WebView, checking for callback: ${callbackName}');
      if (typeof globalThis.${callbackName} === 'function') {
        console.log('DEBUG: Found callback function, calling it now');
        globalThis.${callbackName}(${JSON.stringify(data)});
        console.log('DEBUG: Callback executed');
      } else {
        console.warn('DEBUG: WebView: ${callbackName} handler not found');
      }
      true;
    `;
    
    try {
      webViewRef.current.injectJavaScript(script);
      console.log('DEBUG: Successfully injected JavaScript into WebView');
    } catch (error) {
      console.error('DEBUG: Error injecting JavaScript into WebView:', error);
    }
  } else {
    console.error('DEBUG: WebView reference is null, cannot send data');
  }
}

/**
 * Send form initialization data to the WebView
 * @param webViewRef Reference to the WebView component
 * @param formData Form initialization data
 */
export function sendFormInit(
  webViewRef: React.RefObject<WebView>,
  formData: FormInitData
): void {
  if (!webViewRef.current) {
    console.error('Cannot send form initialization data: WebView reference is null');
    return;
  }

  // Extract form data components
  const { formId, params, savedData } = formData;
  
  // Log initialization attempt
  console.log(`Initializing form with ID: ${formId}`);
  
  // Use the direct callback pattern as defined in the interface
  const script = `
    if (typeof globalThis.onFormInit === 'function') {
      // The FormulusClient expects these parameters to be passed separately
      // and it will combine them into a single object internally
      globalThis.onFormInit('${formId}', ${JSON.stringify(params)}, ${JSON.stringify(savedData)});
      console.log('Form initialization data sent to formplayer');
    } else {
      console.error('Form initialization failed: onFormInit callback not found');
    }
    true;
  `;
  
  try {
    webViewRef.current.injectJavaScript(script);
  } catch (error) {
    console.error('Error sending form initialization data:', error);
  }
}

/**
 * Send attachment data to the WebView
 * @param webViewRef Reference to the WebView component
 * @param attachmentData Attachment data
 */
export function sendAttachmentData(
  webViewRef: React.RefObject<WebView>,
  attachmentData: any
): void {
  sendToWebView(webViewRef, 'formulus.onAttachmentReady', attachmentData);
}

/**
 * Send save partial completion status to the WebView
 * @param webViewRef Reference to the WebView component
 * @param formId Form ID
 * @param success Whether the save was successful
 */
export function sendSavePartialComplete(
  webViewRef: React.RefObject<WebView>,
  formId: string,
  success: boolean
): void {
  sendToWebView(webViewRef, 'formulus.onSavePartialComplete', { formId, success });
}
