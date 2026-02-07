import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
  SyntheticEvent,
} from 'react';
import { View, ActivityIndicator, AppState, StyleSheet } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useIsFocused } from '@react-navigation/native';
import { Platform } from 'react-native';
import { readFileAssets, MainBundlePath, readFile } from 'react-native-fs';
import { FormulusWebViewMessageManager } from '../webview/FormulusWebViewHandler';
import { FormInitData } from '../webview/FormulusInterfaceDefinition';
import { colors } from '../theme/colors';

export interface CustomAppWebViewHandle {
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  injectJavaScript: (script: string) => void;
  sendFormInit: (formData: FormInitData) => Promise<void>;
  sendAttachmentData: (attachmentData: File) => Promise<void>;
}

interface CustomAppWebViewProps {
  appUrl: string;
  appName?: string; // To identify the source of logs
  onLoadEndProp?: () => void; // Propagate WebView's onLoadEnd event
  onCanGoBackChange?: (canGoBack: boolean) => void; // Notify parent when WebView back-navigability changes
}

const INJECTION_SCRIPT_PATH =
  Platform.OS === 'android'
    ? 'webview/FormulusInjectionScript.js'
    : 'FormulusInjectionScript.js';

const hashNavigationTrackingScript = `
    (function() {
      if (window.__formulusHashNavInstalled) return;
      window.__formulusHashNavInstalled = true;

      // Track the initial URL so we can determine canGoBack.
      // We consider "can go back" = the browser history length is > 1
      // AND we are not at the initial entry point.
      var initialHref = window.location.href;
      var navigationDepth = 0;

      function notifyCanGoBack() {
        var canGoBack = navigationDepth > 0;
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'hashNavigationStateChange',
            canGoBack: canGoBack,
            url: window.location.href,
            depth: navigationDepth
          }));
        } catch(e) { /* ignore if bridge not ready */ }
      }

      // Intercept pushState / replaceState so we can track depth accurately
      var origPushState = history.pushState;
      history.pushState = function() {
        origPushState.apply(this, arguments);
        navigationDepth++;
        notifyCanGoBack();
      };

      var origReplaceState = history.replaceState;
      history.replaceState = function() {
        origReplaceState.apply(this, arguments);
        // replaceState doesn't add depth
        notifyCanGoBack();
      };

      window.addEventListener('popstate', function() {
        navigationDepth = Math.max(0, navigationDepth - 1);
        notifyCanGoBack();
      });

      window.addEventListener('hashchange', function() {
        // hashchange after pushState is already handled, but if the hash
        // was changed directly (e.g. location.hash = ...) we catch it here.
        // We bump depth only if it wasn't already bumped by pushState.
        notifyCanGoBack();
      });
    })();
  `;

const consoleLogScript = `
    (function() {
      // Helper function to serialize arguments, including Error objects
      function serializeArgs(args) {
        return Array.from(args).map(arg => {
          // Handle Error objects specially
          if (arg instanceof Error) {
            return {
              __isError: true,
              name: arg.name,
              message: arg.message,
              stack: arg.stack
            };
          }
          // Handle other objects
          if (typeof arg === 'object' && arg !== null) {
            try {
              // Try to stringify, but catch circular references
              JSON.stringify(arg);
              return arg;
            } catch (e) {
              return String(arg);
            }
          }
          return arg;
        });
      }

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
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.log', args: serializeArgs(arguments)}));
      };
      console.warn = function() { 
        originalConsole.warn.apply(console, arguments);
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.warn', args: serializeArgs(arguments)}));
      };
      console.error = function() { 
        originalConsole.error.apply(console, arguments);
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.error', args: serializeArgs(arguments)}));
      };
      console.info = function() { 
        originalConsole.info.apply(console, arguments);
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.info', args: serializeArgs(arguments)}));
      };
      console.debug = function() { 
        originalConsole.debug.apply(console, arguments);
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.debug', args: serializeArgs(arguments)}));
      };
      console.debug("Log transport initialized");
    })();
  `;

const CustomAppWebView = forwardRef<
  CustomAppWebViewHandle,
  CustomAppWebViewProps
>(({ appUrl, appName, onLoadEndProp, onCanGoBackChange }, ref) => {
  const webViewRef = useRef<WebView | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const canGoBackRef = useRef(false);

  const onCanGoBackChangeRef = useRef(onCanGoBackChange);
  useEffect(() => {
    onCanGoBackChangeRef.current = onCanGoBackChange;
  }, [onCanGoBackChange]);

  const [injectionScript, setInjectionScript] =
    useState<string>(consoleLogScript);
  const injectionScriptRef = useRef<string>(consoleLogScript);
  const [isScriptReady, setIsScriptReady] = useState(false);

  useEffect(() => {
    const loadScript = async () => {
      try {
        let script = '';

        if (Platform.OS === 'android') {
          // Path A: Use the Android-only asset reader
          script = await readFileAssets(INJECTION_SCRIPT_PATH);
        } else {
          const iosPath = `${MainBundlePath}/${INJECTION_SCRIPT_PATH}`;
          script = await readFile(iosPath, 'utf8');
        }

        const fullScript =
          consoleLogScript +
          '\n' +
          hashNavigationTrackingScript +
          '\n' +
          script;
        setInjectionScript(fullScript);
        setIsScriptReady(true);
      } catch (err) {
        // Logic for if the file is missing entirely
        console.error('Failed to load injection script with error:', err);
        // setIsScriptReady(true);
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

        if (eventData.type === 'hashNavigationStateChange') {
          const newCanGoBack = !!eventData.canGoBack;
          if (canGoBackRef.current !== newCanGoBack) {
            canGoBackRef.current = newCanGoBack;
            onCanGoBackChangeRef.current?.(newCanGoBack);
          }
          return;
        }

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
      } catch (error: unknown) {
        console.error('Error parsing event data:', error);
        // If parsing fails, let the original handler deal with it
      }

      // Call the original handler for all other messages
      originalHandleMessage.call(manager, event);
    };

    return manager;
  }, [appName]);

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      const newCanGoBack = navState.canGoBack;
      if (canGoBackRef.current !== newCanGoBack) {
        canGoBackRef.current = newCanGoBack;
        onCanGoBackChange?.(newCanGoBack);
      }
    },
    [onCanGoBackChange],
  );

  // Expose imperative handle
  useImperativeHandle(
    ref,
    () => ({
      reload: () => webViewRef.current?.reload?.(),
      goBack: () => webViewRef.current?.goBack?.(),
      goForward: () => webViewRef.current?.goForward?.(),
      canGoBack: () => canGoBackRef.current,
      injectJavaScript: (script: string) =>
        webViewRef.current?.injectJavaScript(script),
      sendFormInit: (formData: FormInitData) =>
        messageManager.sendFormInit(formData),
      sendAttachmentData: (attachmentData: File) =>
        messageManager.sendAttachmentData(attachmentData),
    }),
    [messageManager],
  );

  const handleError = (syntheticEvent: SyntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error(
      '[CustomAppWebView] WebView error',
      nativeEvent,
      'appUrl:',
      appUrl,
    );
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.semantic.info.ios} />
      </View>
    );
  }

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: appUrl }}
      onNavigationStateChange={handleNavigationStateChange}
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
        const { nativeEvent } = syntheticEvent;
        console.error('CustomWebView HTTP error:', nativeEvent);
      }}
      injectedJavaScriptBeforeContentLoaded={injectionScript}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      allowFileAccess={true}
      allowUniversalAccessFromFileURLs={true}
      allowFileAccessFromFileURLs={true}
      // iOS requires read access to the directory containing the file, not just the file itself
      // For custom apps from DocumentDirectoryPath, allow access to the app directory
      // For bundled assets (MainBundlePath), allow access to the bundle root
      allowingReadAccessToURL={
        Platform.OS === 'ios'
          ? appUrl.includes(MainBundlePath)
            ? `file://${MainBundlePath}`
            : appUrl.substring(0, appUrl.lastIndexOf('/'))
          : undefined
      }
      startInLoadingState={true}
      originWhitelist={['*']}
      renderLoading={() => (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.semantic.info.ios} />
        </View>
      )}
    />
  );
});

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CustomAppWebView;
