import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Platform } from 'react-native';
import { readFileAssets } from 'react-native-fs';
import { createFormulusMessageHandler, sendFormInit, sendAttachmentData, sendSavePartialComplete } from '../webview/FormulusWebViewHandler';

export interface CustomAppWebViewHandle {
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  injectJavaScript: (script: string) => void;
}

interface CustomAppWebViewProps {
  appUrl: string;
}

const INJECTION_SCRIPT_PATH = Platform.OS === 'android' 
  ? 'webview/FormulusInjectionScript.js'
  : 'FormulusInjectionScript.js';

const consoleLogScript = `
    (function() {
      console.debug("Initializing console log transport");
      window.ReactNativeWebView.postMessage(JSON.stringify({type: 'console.log', args: ['Initializing console log transport']}));

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

const CustomAppWebView = forwardRef<CustomAppWebViewHandle, CustomAppWebViewProps>(({ appUrl }, ref) => {
  const webViewRef = useRef<WebView | null>(null);

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    reload: () => webViewRef.current?.reload?.(),
    goBack: () => webViewRef.current?.goBack?.(),
    goForward: () => webViewRef.current?.goForward?.(),
    injectJavaScript: (script: string) => webViewRef.current?.injectJavaScript(script),
  }), []);

  // JS injection: load script from assets and prepend consoleLogScript
  const [injectionScript, setInjectionScript] = useState<string>(consoleLogScript);
  useEffect(() => {
    const loadScript = async () => {
      try {
        const script = await readFileAssets(INJECTION_SCRIPT_PATH);
        setInjectionScript(consoleLogScript + '\n' + script);
      } catch (err) {
        setInjectionScript(consoleLogScript); // fallback
        console.warn('Failed to load injection script:', err);
      }
    };
    loadScript();
  }, []);

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
  };


  const handleWebViewMessage = createFormulusMessageHandler(webViewRef);

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: appUrl }}
      onMessage={handleWebViewMessage}
      onError={handleError}
      onLoadStart={() => console.log('CustomWebView starting to load URL:', appUrl)}
      onLoadEnd={() => console.log('CustomWebView finished loading')}
      onHttpError={(syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.error('CustomWebView HTTP error:', nativeEvent);
      }}
      injectedJavaScriptBeforeContentLoaded={injectionScript}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      allowFileAccess={true}
      allowUniversalAccessFromFileURLs={true}
      allowFileAccessFromFileURLs={true}
      startInLoadingState={true}
      renderLoading={() => (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
    />
  );
});

export default CustomAppWebView;
