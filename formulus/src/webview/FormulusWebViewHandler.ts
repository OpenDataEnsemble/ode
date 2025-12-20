/**
 * FormulusWebViewHandler.ts
 *
 * This module provides a reusable handler for WebView messages from both
 * the Formplayer and custom app WebViews. It processes messages according to
 * the Formulus interface and provides callbacks for specific message types.
 */

import {WebViewMessageEvent, WebView} from 'react-native-webview';
import {createFormulusMessageHandlers} from './FormulusMessageHandlers';
import {FormInitData} from './FormulusInterfaceDefinition';

// Add NodeJS type definitions
declare global {
  namespace NodeJS {
    interface Timeout {}
  }
}

// Unused interfaces removed
// interface PendingRequest {
//   resolve: (value: any) => void;
//   reject: (reason?: any) => void;
//   timeout: NodeJS.Timeout;
// }

// Unused interface - kept for potential future use
// interface MessageHandlerContext {
//   data: any; // This is now the payload part of the message (message content excluding type and messageId)
//   webViewRef: React.RefObject<WebView | null>;
//   event: WebViewMessageEvent; // Original WebView event
//   type: string; // Original message type from the WebView message
//   messageId?: string; // Original messageId from the WebView message, if present
// }

/**
 * FormulusWebViewMessageManager class
 * Manages WebView communication with instance-specific state, designed for composition.
 */
export class FormulusWebViewMessageManager {
  private static readonly REQUEST_TIMEOUT = 30000; // 30 seconds timeout

  private webViewRef: React.RefObject<WebView | null>;
  private appName: string;
  private logPrefix: string;
  private isWebViewReady: boolean = false;
  private messageQueue: Array<{
    callbackName: string;
    data: any;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];
  private pendingRequests: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();
  private nativeSideHandlers: ReturnType<typeof createFormulusMessageHandlers>;

  constructor(
    webViewRef: React.RefObject<WebView | null>,
    appName: string = 'WebView',
  ) {
    this.webViewRef = webViewRef;
    this.appName = appName;
    this.logPrefix = `[${this.appName}]`;
    this.nativeSideHandlers = createFormulusMessageHandlers(); // Initialize native handlers
    console.log(`${this.logPrefix} FormulusWebViewMessageManager initialized`);
  }

  public setWebViewReady(isReady: boolean): void {
    this.isWebViewReady = isReady;
    console.log(`${this.logPrefix} WebView readiness set to: ${isReady}`);
    if (isReady) {
      console.log(
        `${this.logPrefix} WebView is ready, processing any queued messages (count=${this.messageQueue.length})`,
      );
      this.processMessageQueue();
    }
  }

  private queueMessage(
    callbackName: string,
    data: any,
    resolve: (value: any) => void,
    reject: (reason?: any) => void,
  ): void {
    console.log(`${this.logPrefix} Queuing message: ${callbackName}`, data);
    this.messageQueue.push({callbackName, data, resolve, reject});
  }

  private processMessageQueue(): void {
    console.log(
      `${this.logPrefix} Processing ${this.messageQueue.length} queued messages`,
    );
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message.callbackName, message.data)
          .then(message.resolve)
          .catch(message.reject);
      }
    }
  }

  private sendToWebViewInternal(
    callbackName: string,
    data: any = {},
    requestId: string,
  ): void {
    if (!this.webViewRef.current) {
      console.error(
        `${this.logPrefix} WebView reference is null. Cannot send message: ${callbackName}`,
      );
      // Find the pending request and reject it
      const request = this.pendingRequests.get(requestId);
      if (request) {
        request.reject(new Error('WebView reference is null'));
        this.pendingRequests.delete(requestId);
      }
      return;
    }
    const script = `
      (function() {
        console.debug("[${
          this.appName
        }] Injecting script for callback ${callbackName}, requestId ${requestId}");
        try {
          if (window.${callbackName}) {
            Promise.resolve(window.${callbackName}(${JSON.stringify(data)}))
              .then(result => ({ type: 'response', requestId: '${requestId}', result }))
              .catch(error => ({ type: 'response', requestId: '${requestId}', error: String(error) }))
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
            error: String(error) || 'Unknown error in ${callbackName}'
          }));
        }
      })();
      true; // Return true to prevent iOS warning
    `;
    console.log(
      `${this.logPrefix} Sending to WebView (${callbackName}, ${requestId}):`,
      data,
    );
    this.webViewRef.current.injectJavaScript(script);
  }

  public send<T = void>(callbackName: string, data: any = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.isWebViewReady) {
        console.log(
          `${this.logPrefix} WebView not ready, queuing message for callback ${callbackName}`,
          data,
        );
        this.queueMessage(callbackName, data, resolve, reject);
        return;
      }

      const requestId =
        Math.random().toString(36).substring(2, 15) + Date.now();
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          console.warn(
            `${this.logPrefix} Request timed out: ${callbackName}, ${requestId}`,
          );
          this.pendingRequests
            .get(requestId)
            ?.reject(new Error(`Request timed out for ${callbackName}`));
          this.pendingRequests.delete(requestId);
        }
      }, FormulusWebViewMessageManager.REQUEST_TIMEOUT);

      this.pendingRequests.set(requestId, {resolve, reject, timeout});
      this.sendToWebViewInternal(callbackName, data, requestId);
    });
  }

  public handleWebViewMessage = (event: WebViewMessageEvent): void => {
    try {
      const eventData = JSON.parse(event.nativeEvent.data);
      const {type, messageId, ...payload} = eventData;

      if (!type) {
        console.warn(
          `${this.logPrefix} Received WebView message without type:`,
          eventData,
        );
        return;
      }

      if (type === 'formplayerReadyToReceiveInit') {
        this.handleReadySignal(payload);
      } else if (type === 'response') {
        const actualRequestId = messageId || payload.requestId;
        if (actualRequestId) {
          this.handleResponse(actualRequestId, payload.result, payload.error);
        } else {
          console.warn(
            `${this.logPrefix} Received 'response' message without a requestId in messageId or payload:`,
            eventData,
          );
        }
      } else if (type.startsWith('console.')) {
        const logLevel = type.substring('console.'.length) as keyof Console;
        const logArgs = payload.args || []; // payload is {args: Array(1)}
        if (typeof console[logLevel] === 'function') {
          (console[logLevel] as (...data: any[]) => void)(
            `${this.logPrefix} [WebView]`,
            ...logArgs,
          );
        } else {
          // Fallback if the extracted level is not a valid console method
          console.log(`${this.logPrefix} [WebView]`, ...logArgs);
        }
      } else if (type === 'console') {
        // Keep existing handler for type === 'console' as fallback
        // Handle console messages from WebView if type is exactly 'console' and level is in payload
        const {level, args} = payload;
        if (
          level &&
          args &&
          typeof console[level as keyof Console] === 'function'
        ) {
          (console[level as keyof Console] as (...data: any[]) => void)(
            `${this.logPrefix} [WebView]`,
            ...args,
          );
        } else {
          console.log(`${this.logPrefix} [WebView]`, ...args);
        }
      } else {
        this.handleIncomingAction(type, payload, messageId);
      }
    } catch (error) {
      console.error(
        `${this.logPrefix} Error parsing WebView message:`,
        error,
        event.nativeEvent.data,
      );
    }
  };

  private handleReadySignal(data?: any): void {
    console.log(`${this.logPrefix} WebView is ready.`, data || '');
    this.setWebViewReady(true);
    // Optionally call native-side handler if it exists for onFormulusReady
    if (this.nativeSideHandlers.onFormulusReady) {
      try {
        this.nativeSideHandlers.onFormulusReady();
      } catch (error) {
        console.error(
          `${this.logPrefix} Error in native onFormulusReady handler:`,
          error,
        );
      }
    }
  }

  public handleReceiveFocus(): void {
    console.log(`${this.logPrefix} WebView is receiving focus.`);
    // Optionally call native-side handler if it exists for onReceiveFocus
    if (this.nativeSideHandlers.onReceiveFocus) {
      try {
        this.nativeSideHandlers.onReceiveFocus();
      } catch (error) {
        console.error(
          `${this.logPrefix} Error in native onReceiveFocus handler:`,
          error,
        );
      }
    }
  }

  private handleResponse(messageId: string, result: any, error?: any): void {
    const pendingRequest = this.pendingRequests.get(messageId);
    if (!pendingRequest) {
      console.warn(
        `${this.logPrefix} No pending request found for messageId:`,
        messageId,
      );
      return;
    }
    clearTimeout(pendingRequest.timeout as unknown as number); // Cast to number for clearTimeout
    if (error) {
      console.error(
        `${this.logPrefix} Received error for request ${messageId}:`,
        error,
      );
      pendingRequest.reject(new Error(String(error)));
    } else {
      console.log(
        `${this.logPrefix} Received result for request ${messageId}:`,
        result,
      );
      pendingRequest.resolve(result);
    }
    this.pendingRequests.delete(messageId);
  }

  private async handleIncomingAction(
    type: string,
    data: any,
    messageId?: string,
  ): Promise<void> {
    console.log(
      `${this.logPrefix} Handling incoming action: type=${type}, messageId=${messageId}`,
      data,
    );
    const handlerName = `on${
      type.charAt(0).toUpperCase() + type.slice(1)
    }` as keyof typeof this.nativeSideHandlers;
    let result: any;
    let error: any;

    try {
      // Special-case WebView messages of type 'onFormulusReady'. These already
      // correspond to the onFormulusReady handler on the native side, so we
      // call it directly instead of routing through onUnknownMessage.
      if (
        type === 'onFormulusReady' &&
        typeof this.nativeSideHandlers.onFormulusReady === 'function'
      ) {
        result = await this.nativeSideHandlers.onFormulusReady();
      } else if (typeof this.nativeSideHandlers[handlerName] === 'function') {
        result = await (this.nativeSideHandlers[handlerName] as Function)(data);
      } else if (this.nativeSideHandlers.onUnknownMessage) {
        console.warn(
          `${this.logPrefix} No specific handler for type '${type}'. Using onUnknownMessage.`,
        );
        result = await this.nativeSideHandlers.onUnknownMessage({
          type,
          ...data,
          messageId,
        });
      } else {
        console.warn(
          `${this.logPrefix} Unhandled WebView message type: ${type}. No default onUnknownMessage handler.`,
          data,
        );
        error = `No handler for message type ${type}`;
      }
    } catch (e) {
      console.error(
        `${this.logPrefix} Error in native handler for ${type}:`,
        e,
      );
      error = String(e);
    }

    // If the original message had a messageId, send a response back
    if (messageId) {
      const responsePayload = {
        type: `${type}_response`,
        messageId: messageId,
        result: result,
        error: error,
      };

      console.log(
        `${this.logPrefix} Sending response for incoming action ${type} (messageId: ${messageId}):`,
        responsePayload,
      );

      // Directly post a message to the webview, which will be caught by the event listeners
      // in FormulusInjectionScript.js
      this.webViewRef.current?.injectJavaScript(
        `window.postMessage(${JSON.stringify(responsePayload)}, '*');
        true;`, // Return true to prevent iOS warning
      );
    }
  }

  public reset(): void {
    console.log(
      `${this.logPrefix} Resetting FormulusWebViewMessageManager state.`,
    );
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeout as unknown as number); // Cast to number
      request.reject(new Error('WebViewMessageManager reset'));
    });
    this.pendingRequests.clear();
    this.messageQueue = [];
    this.isWebViewReady = false;
    console.log(`${this.logPrefix} State reset complete.`);
  }

  // Convenience methods for common actions (can be added in Phase 2/3)
  public sendFormInit(formData: FormInitData): Promise<void> {
    if (!formData.formType) {
      throw new Error('Form type is required for form init');
    }
    console.log(
      `${this.logPrefix} sendFormInit called for formType='${formData.formType}', isWebViewReady=${this.isWebViewReady}`,
    );
    if (!this.isWebViewReady) {
      console.log(
        `${this.logPrefix} Form init will be queued until WebView is ready`,
        formData,
      );
    }
    console.log(
      `${this.logPrefix} Sending form init now (or queuing via send):`,
      formData.formType,
    );
    return this.send<void>('onFormInit', formData);
  }

  public sendAttachmentData(attachmentData: any): Promise<void> {
    console.log(`${this.logPrefix} Sending attachment data.`);
    return this.send<void>('onAttachmentData', attachmentData);
  }
}
