import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { generateFormulusInjectionScript } from '../webview/FormulusInjectionScript';
import { 
  createFormulusMessageHandler, 
  sendFormInit, 
  sendAttachmentData, 
  sendSavePartialComplete 
} from '../webview/FormulusWebViewHandler';

interface CustomAppWebViewProps {
  appUrl: string;
  onMessage?: (messageType: string, data: any) => void;
}

export interface CustomAppWebViewHandle {
  webViewRef: React.RefObject<WebView | null>;
}

const CustomAppWebView = forwardRef<CustomAppWebViewHandle, CustomAppWebViewProps>(({ appUrl, onMessage }, ref) => {
  const webViewRef = useRef<WebView | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  
  // Expose the webViewRef to the parent component
  useImperativeHandle(ref, () => ({
    webViewRef
  }));
  
  // Get the JavaScript interface for the WebView from the shared injection script
  const formulusApi = generateFormulusInjectionScript();

  useEffect(() => {
    console.log('Custom App WebView initialized, loading URL:', appUrl);
  }, [appUrl]);

  // Handle form initialization
  const handleInitForm = () => {
    // In a real implementation, you would get these values from your app state or storage
    const formId = `app_${Date.now()}`;
    const params = { locale: 'en', theme: 'default' };
    const savedData = {}; // Any previously saved data for this app
    
    setAppId(formId);
    
    // Send the initialization data back to the Custom App
    if (webViewRef.current) {
      sendFormInit(webViewRef as React.RefObject<WebView>, {
        formId,
        params,
        savedData
      });
    }
    
    console.log('App initialized with ID:', formId);
    
    // Notify parent component if callback provided
    if (onMessage) {
      onMessage('initForm', { formId });
    }
  };
  
  // Handle saving partial form data
  const handleSavePartial = (formId: string, data: any) => {
    // In a real implementation, you would save this data to your app's storage
    console.log('Saving partial data for app:', formId, data);
    
    // Send a confirmation back to the Custom App
    if (webViewRef.current) {
      sendSavePartialComplete(webViewRef as React.RefObject<WebView>, formId, true);
    }
    
    // Notify parent component if callback provided
    if (onMessage) {
      onMessage('savePartial', { formId, data });
    }
  };
  
  // Handle form submission
  const handleSubmitForm = (formId: string, finalData: any) => {
    // In a real implementation, you would process and store the final form data
    console.log('App data submitted:', formId, finalData);
    
    // Notify parent component if callback provided
    if (onMessage) {
      onMessage('submitForm', { formId, finalData });
    }
  };
  
  // Handle camera request
  const handleRequestCamera = (fieldId: string) => {
    console.log('Camera requested for field:', fieldId);
    
    // Notify parent component if callback provided
    if (onMessage) {
      onMessage('requestCamera', { fieldId });
    }
  };
  
  // Handle location request
  const handleRequestLocation = (fieldId: string) => {
    console.log('Location requested for field:', fieldId);
    
    // Notify parent component if callback provided
    if (onMessage) {
      onMessage('requestLocation', { fieldId });
    }
  };
  
  // Create a message handler for the Custom App WebView using our reusable handler
  const handleWebViewMessage = createFormulusMessageHandler(webViewRef as React.RefObject<WebView>, {
    onInitForm: handleInitForm,
    onSavePartial: handleSavePartial,
    onSubmitForm: handleSubmitForm,
    onRequestCamera: handleRequestCamera,
    onRequestLocation: handleRequestLocation,
    // Add handlers for other message types as needed
    onError: (err) => console.error('Failed to handle Custom App WebView message:', err)
  });

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: appUrl }}
        style={styles.webview}
        onMessage={handleWebViewMessage}
        injectedJavaScript={formulusApi}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        originWhitelist={['file://*']}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});

export default CustomAppWebView;
