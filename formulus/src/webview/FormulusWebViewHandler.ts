/**
 * FormulusWebViewHandler.ts
 *
 * This module provides a reusable handler for WebView messages from both
 * the Formplayer and custom app WebViews. It processes messages according to
 * the Formulus interface and provides callbacks for specific message types.
 */

import { WebViewMessageEvent, WebView } from 'react-native-webview';
import { createFormulusMessageHandlers } from './FormulusMessageHandlers';
import { FormInitData } from './FormulusInterfaceDefinition';

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
    data: unknown;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  private pendingRequests: Map<
    string,
    {
      callbackName: string;
      data: unknown;
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
      timeout: number;
    }
  > = new Map();
  private nativeSideHandlers: ReturnType<typeof createFormulusMessageHandlers>;
  private formInitRetryCount = 0;
  private static readonly FORM_INIT_MAX_RETRIES = 12; // 12 * 500ms = 6 seconds
  private formInitRetryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    webViewRef: React.RefObject<WebView | null>,
    appName: string = 'WebView',
  ) {
    this.webViewRef = webViewRef;
    this.appName = appName;
    this.logPrefix = `[${this.appName}]`;
    this.nativeSideHandlers = createFormulusMessageHandlers(); // Initialize native handlers
  }

  public setWebViewReady(isReady: boolean): void {
    this.isWebViewReady = isReady;
    if (isReady) this.processMessageQueue();
  }

  private queueMessage<T>(
    callbackName: string,
    data: unknown,
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void,
  ): void {
    this.messageQueue.push({
      callbackName,
      data,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
  }

  private processMessageQueue(): void {
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
    data: unknown = {},
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
    this.webViewRef.current.injectJavaScript(script);
  }

  public send<T = void>(callbackName: string, data: unknown = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.isWebViewReady) {
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

      this.pendingRequests.set(requestId, {
        callbackName,
        data,
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });
      this.sendToWebViewInternal(callbackName, data, requestId);
    });
  }

  public handleWebViewMessage = (event: WebViewMessageEvent): void => {
    try {
      const eventData = JSON.parse(event.nativeEvent.data);
      const { type, messageId, ...payload } = eventData;

      if (!type) {
        console.warn(
          `${this.logPrefix} Received WebView message without type:`,
          eventData,
        );
        return;
      }

      if (type === 'formplayerReadyToReceiveInit') {
        this.handleReadySignal(payload);
      } else if (type === 'onFormulusReady') {
        // Injection script sends onFormulusReady when API is injected (runs before
        // formplayer mounts). Formplayer sends formplayerReadyToReceiveInit when ready.
        // Treat onFormulusReady as fallback: delay so formplayer React app can load
        // and mount (register window.onFormInit) before we process the queued form init.
        const delayMs = 1200;
        setTimeout(() => this.handleReadySignal(payload), delayMs);
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
        // Ensure logArgs is always a valid array
        const logArgs = Array.isArray(payload.args)
          ? payload.args
          : payload.args !== undefined
            ? [payload.args]
            : [payload];

        try {
          const consoleMethod = console[logLevel];
          if (typeof consoleMethod === 'function') {
            // Use Function.prototype.call to ensure proper binding
            consoleMethod.call(
              console,
              `${this.logPrefix} [WebView]`,
              ...logArgs,
            );
          } else {
            // Fallback if the extracted level is not a valid console method
            console.log.call(
              console,
              `${this.logPrefix} [WebView]`,
              ...logArgs,
            );
          }
        } catch {
          // If logging fails, silently ignore to prevent cascading errors
          // This can happen if console methods are not properly available
        }
      } else if (type === 'console') {
        // Keep existing handler for type === 'console' as fallback
        // Handle console messages from WebView if type is exactly 'console' and level is in payload
        const { level, args } = payload;
        if (
          level &&
          args &&
          typeof console[level as keyof Console] === 'function'
        ) {
          (console[level as keyof Console] as (...data: unknown[]) => void)(
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

  private handleReadySignal(_data?: unknown): void {
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

  private handleResponse(
    messageId: string,
    result: unknown,
    error?: unknown,
  ): void {
    const pendingRequest = this.pendingRequests.get(messageId);
    if (!pendingRequest) {
      console.warn(
        `${this.logPrefix} No pending request found for messageId:`,
        messageId,
      );
      return;
    }
    clearTimeout(pendingRequest.timeout as unknown as number); // Cast to number for clearTimeout
    this.pendingRequests.delete(messageId);

    if (error) {
      const errorStr = String(error);
      // Form init was sent before formplayer registered window.onFormInit.
      // Re-queue so formplayerReadyToReceiveInit can deliver it when formplayer mounts.
      if (
        errorStr.includes('Callback onFormInit not found') &&
        pendingRequest.callbackName === 'onFormInit'
      ) {
        this.formInitRetryCount += 1;
        if (
          this.formInitRetryCount >
          FormulusWebViewMessageManager.FORM_INIT_MAX_RETRIES
        ) {
          console.error(
            `${this.logPrefix} Form init failed after ${this.formInitRetryCount} retries. Formplayer may not have loaded.`,
          );
          pendingRequest.reject(
            new Error(
              'Formplayer did not load in time. Please close and try again.',
            ),
          );
          this.formInitRetryCount = 0;
          return;
        }
        this.queueMessage(
          pendingRequest.callbackName,
          pendingRequest.data,
          pendingRequest.resolve,
          pendingRequest.reject,
        );
        // Schedule retry - formplayer may mount later
        this.formInitRetryTimeout = setTimeout(() => {
          this.formInitRetryTimeout = null;
          this.processMessageQueue();
        }, 500);
        return;
      }
      console.error(
        `${this.logPrefix} Received error for request ${messageId}:`,
        error,
      );
      pendingRequest.reject(new Error(errorStr));
    } else {
      if (pendingRequest.callbackName === 'onFormInit') {
        this.formInitRetryCount = 0;
      }
      pendingRequest.resolve(result);
    }
  }

  private async handleIncomingAction(
    type: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    messageId?: string,
  ): Promise<void> {
    const handlerName = `on${
      type.charAt(0).toUpperCase() + type.slice(1)
    }` as keyof typeof this.nativeSideHandlers;
    let result: unknown;
    let error: unknown;

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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
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

      // Directly post a message to the webview, which will be caught by the event listeners
      // in FormulusInjectionScript.js
      this.webViewRef.current?.injectJavaScript(
        `window.postMessage(${JSON.stringify(responsePayload)}, '*');
        true;`, // Return true to prevent iOS warning
      );
    }
  }

  public reset(): void {
    if (this.formInitRetryTimeout) {
      clearTimeout(this.formInitRetryTimeout);
      this.formInitRetryTimeout = null;
    }
    this.formInitRetryCount = 0;
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeout as unknown as number); // Cast to number
      request.reject(new Error('WebViewMessageManager reset'));
    });
    this.pendingRequests.clear();
    this.messageQueue = [];
    this.isWebViewReady = false;
  }

  // Convenience methods for common actions (can be added in Phase 2/3)
  public sendFormInit(formData: FormInitData): Promise<void> {
    if (!formData.formType) {
      throw new Error('Form type is required for form init');
    }
    return this.send<void>('onFormInit', formData);
  }

  public sendAttachmentData(attachmentData: unknown): Promise<void> {
    return this.send<void>('onAttachmentData', attachmentData);
  }
}
