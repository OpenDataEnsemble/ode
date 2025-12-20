import React, {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from 'react';
import {View, ActivityIndicator, AppState} from 'react-native';
import {WebView} from 'react-native-webview';
import {useIsFocused} from '@react-navigation/native';
import {Platform} from 'react-native';
import {readFileAssets} from 'react-native-fs';
import {FormulusWebViewMessageManager} from '../webview/FormulusWebViewHandler';
import {FormInitData} from '../webview/FormulusInterfaceDefinition';

export interface CustomAppWebViewHandle {
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  injectJavaScript: (script: string) => void;
  sendFormInit: (formData: FormInitData) => Promise<void>;
  sendAttachmentData: (attachmentData: any) => Promise<void>;
}

interface CustomAppWebViewProps {
  appUrl: string;
  appName?: string; // To identify the source of logs
  onLoadEndProp?: () => void; // Propagate WebView's onLoadEnd event
}

const INJECTION_SCRIPT_PATH =
  Platform.OS === 'android'
    ? 'webview/FormulusInjectionScript.js'
    : 'FormulusInjectionScript.js';

const consoleLogScript = `
    (function() {
      //window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.log', args: ['Initializing console log transport']}));

      // Store original console methods
      const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
      };

      // Override console methods to forward logs to React Native
      console.log = function() { 
        originalConsole.log.apply(console, arguments);
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.log', args: Array.from(arguments)}));
      };
      console.warn = function() { 
        originalConsole.warn.apply(console, arguments);
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.warn', args: Array.from(arguments)}));
      };
      console.error = function() { 
        originalConsole.error.apply(console, arguments);
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.error', args: Array.from(arguments)}));
      };
      console.info = function() { 
        originalConsole.info.apply(console, arguments);
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.info', args: Array.from(arguments)}));
      };
      console.debug = function() { 
        originalConsole.debug.apply(console, arguments);
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.debug', args: Array.from(arguments)}));
      };
      console.debug("Log transport initialized");
    })();
  `;

const CustomAppWebView = forwardRef<
  CustomAppWebViewHandle,
  CustomAppWebViewProps
>(({appUrl, appName, onLoadEndProp}, ref) => {
  const webViewRef = useRef<WebView | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const [injectionScript, setInjectionScript] =
    useState<string>(consoleLogScript);
  const injectionScriptRef = useRef<string>(consoleLogScript);
  const [isScriptReady, setIsScriptReady] = useState(false);

  useEffect(() => {
    const loadScript = async () => {
      try {
        const script = await readFileAssets(INJECTION_SCRIPT_PATH);
        const fullScript =
          consoleLogScript +
          '\n' +
          script +
          '\n(function() {console.debug("Injection scripts initialized");}())';
        injectionScriptRef.current = fullScript;
        setInjectionScript(fullScript);
        setIsScriptReady(true);
      } catch (err) {
        injectionScriptRef.current = consoleLogScript;
        setInjectionScript(consoleLogScript);
        setIsScriptReady(true);
        console.warn('Failed to load injection script:', err);
      }
    };
    loadScript();
  }, []);

  const messageManager = useMemo(() => {
    const manager = new FormulusWebViewMessageManager(webViewRef, appName);

    // Extend the message manager to handle API recovery requests
    const originalHandleMessage = manager.handleWebViewMessage;
    manager.handleWebViewMessage = event => {
      try {
        const eventData = JSON.parse(event.nativeEvent.data);

        // Handle API re-injection requests from WebView
        if (eventData.type === 'requestApiReinjection') {
          console.log(
            `[CustomAppWebView - ${
              appName || 'Default'
            }] WebView requested API re-injection`,
          );

          // Perform immediate re-injection
          const latestScript = injectionScriptRef.current;
          if (
            webViewRef.current &&
            latestScript !== consoleLogScript &&
            hasLoadedOnceRef.current
          ) {
            const reInjectionWrapper = `
              (function() {
                console.debug('[CustomAppWebView/ApiRecovery] Processing re-injection request...');
                
                // Clear any existing broken references
                delete window.formulus;
                delete globalThis.formulus;
                delete window.formulusCallbacks;
                delete globalThis.formulusCallbacks;
                
                // Re-inject the full script
                ${latestScript}
                
                console.log('[CustomAppWebView/ApiRecovery] API re-injection completed');
                return true;
              })();
            `;
            webViewRef.current.injectJavaScript(reInjectionWrapper);
          }
          return;
        }
      } catch (e) {
        // If parsing fails, let the original handler deal with it
      }

      // Call the original handler for all other messages
      originalHandleMessage.call(manager, event);
    };

    return manager;
  }, [appName]);

  // Expose imperative handle
  useImperativeHandle(
    ref,
    () => ({
      reload: () => webViewRef.current?.reload?.(),
      goBack: () => webViewRef.current?.goBack?.(),
      goForward: () => webViewRef.current?.goForward?.(),
      injectJavaScript: (script: string) =>
        webViewRef.current?.injectJavaScript(script),
      sendFormInit: (formData: FormInitData) =>
        messageManager.sendFormInit(formData),
      sendAttachmentData: (attachmentData: any) =>
        messageManager.sendAttachmentData(attachmentData),
    }),
    [messageManager],
  );

  const handleError = (syntheticEvent: any) => {
    const {nativeEvent} = syntheticEvent;
    console.error('WebView error:', nativeEvent);
  };

  const isFocused = useIsFocused();

  useEffect(() => {
    // Ensure webViewRef.current and injectionScript (the fully prepared script) are available, and initial load has completed.
    if (
      isFocused &&
      webViewRef.current &&
      injectionScript !== consoleLogScript &&
      hasLoadedOnceRef.current
    ) {
      // Check injectionScript is loaded and initial load done
      const reInjectionWrapper = `
        (function() {
          if (typeof window.formulus === 'undefined' && typeof globalThis.formulus === 'undefined') {
            console.debug('[CustomAppWebView/FocusEffect] window.formulus is undefined AFTER LOAD. Re-injecting main script content.');
            // This injects the entire 'injectionScript' (consoleLogScript + your INJECTION_SCRIPT_PATH content)
            ${injectionScript}
            console.debug('[CustomAppWebView/FocusEffect] Main script content re-injected AFTER LOAD.');
          } else {
            if (typeof window !== 'undefined') {
              window.formulus = globalThis.formulus;
            }
            //console.debug('[CustomAppWebView/FocusEffect] window.formulus already exists on focus.');
            // Optionally, you can call a function on window.formulus to notify it of focus, e.g.:
            // if (typeof window.formulus.onAppFocus === 'function') { window.formulus.onAppFocus(); }
          }
          return true; // Return true to prevent potential errors in some WebView versions
        })();
      `;
      webViewRef.current.injectJavaScript(reInjectionWrapper);
    }
  }, [isFocused, injectionScript]); // Depend on injectionScript to use the latest version

  // AppState listener to detect when app regains focus and trigger handleReceiveFocus
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log(
          '[CustomAppWebView] App became active, triggering handleReceiveFocus',
        );
        // Call handleReceiveFocus on the messageManager when app becomes active
        if (
          messageManager &&
          typeof messageManager.handleReceiveFocus === 'function'
        ) {
          messageManager.handleReceiveFocus();
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription?.remove();
    };
  }, [messageManager]);

  // const handleWebViewMessage = createFormulusMessageHandler(webViewRef, appName); // Replaced by messageManager
  // If appName is undefined, createFormulusMessageHandler will use its default 'WebView'

  if (!isScriptReady) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <WebView
      ref={webViewRef}
      source={{uri: appUrl}}
      onMessage={messageManager.handleWebViewMessage}
      onError={handleError}
      onLoadStart={() =>
        console.debug(
          `[CustomAppWebView - ${appName || 'Default'}] Starting to load URL:`,
          appUrl,
        )
      }
      onLoadEnd={() => {
        console.debug(
          `[CustomAppWebView - ${
            appName || 'Default'
          }] Finished loading URL: ${appUrl}`,
        );
        if (webViewRef.current) {
          // Ensure API is available after load
          const ensureApiScript = `
            (function() {
              if (typeof window.formulus === 'undefined' && typeof globalThis.formulus !== 'undefined') {
                window.formulus = globalThis.formulus;
              }
              if (typeof window.onFormulusReady === 'function') {
                window.onFormulusReady();
              }
            })();
          `;
          webViewRef.current.injectJavaScript(ensureApiScript);
        }
        hasLoadedOnceRef.current = true;
        if (onLoadEndProp) {
          onLoadEndProp();
        }
      }}
      onHttpError={syntheticEvent => {
        const {nativeEvent} = syntheticEvent;
        console.error('CustomWebView HTTP error:', nativeEvent);
      }}
      injectedJavaScriptBeforeContentLoaded={injectionScript}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      allowFileAccess={true}
      allowUniversalAccessFromFileURLs={true}
      allowFileAccessFromFileURLs={true}
      allowingReadAccessToURL={
        Platform.OS === 'ios' ? 'file:///...' : undefined
      }
      startInLoadingState={true}
      originWhitelist={['*']}
      renderLoading={() => (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    />
  );
});

export default CustomAppWebView;
