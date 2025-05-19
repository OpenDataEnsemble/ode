import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import RNFS from 'react-native-fs';
import { appEvents, formulusMessageHandlers } from '../webview/formulusMessageHandlers';
import FormplayerModal from '../components/FormplayerModal';
import CustomAppWebView, { CustomAppWebViewHandle } from '../components/CustomAppWebView';

const PLACEHOLDER_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <title>Custom App Placeholder</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: sans-serif; text-align: center; padding: 40px; }
      h1 { color: #4A90E2; }
    </style>
  </head>
  <body>
    <h1>Your Custom App</h1>
    <p>This is an placeholder. Your app will appear here after sync.</p>
    <script>
    function waitForFormulus(cb, tries = 50) {
      if (window.formulus && typeof window.formulus.getVersion === 'function') {
        cb();
      } else if (tries > 0) {
        setTimeout(() => waitForFormulus(cb, tries - 1), 100);
      } else {
        document.body.insertAdjacentHTML('beforeend', '<p>Formulus version: unavailable</p>');
      }
    }
    
    document.addEventListener('DOMContentLoaded', function() {
      waitForFormulus(function() {
        const version = window.formulus?.getVersion?.();
        console.log(version);
        document.body.insertAdjacentHTML('beforeend', '<p>Formulus version: ' + version + '</p>');
      });
    });
    </script>
  </body>
</html>
`;

const HomeScreen = ({ navigation }: any) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [formplayerVisible, setFormplayerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const customAppRef = useRef<CustomAppWebViewHandle>(null);
  const overwriteHtml = true;

  useEffect(() => {
    const setupPlaceholder = async () => {
      try {
        const folderPath = `${RNFS.DocumentDirectoryPath}/user_app/payload`;
        const filePath = `${folderPath}/index.html`;
        // Ensure the directory exists
        const folderExists = await RNFS.exists(folderPath);
        if (!folderExists) {
          await RNFS.mkdir(folderPath);
        }
        // Ensure the file exists
        const fileExists = await RNFS.exists(filePath);
        if (!fileExists || overwriteHtml) {
          await RNFS.writeFile(filePath, PLACEHOLDER_HTML, 'utf8');
        }
        setLocalUri(`file://${filePath}`);
      } catch (err) {
        console.warn('Failed to setup placeholder HTML:', err);
      }
    };
    setupPlaceholder();
  }, []);

  // Set up event listener for opening formplayer
  useEffect(() => {
    // Handler function for the openFormplayer event
    const handleOpenFormplayer = () => {
      setFormplayerVisible(true);
    };

    // Add event listener
    appEvents.addListener('openFormplayer', handleOpenFormplayer);

    // Clean up event listener on component unmount
    return () => {
      appEvents.removeListener('openFormplayer', handleOpenFormplayer);
    };
  }, []);
  
  // Update isLoading when localUri is set
  useEffect(() => {
    if (localUri) {
      setIsLoading(false);
    }
  }, [localUri]);

  if (!localUri) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  const handleCustomAppMessage = (messageType: string, data: any) => {
    console.log('Received message from CustomAppWebView:', messageType, data);
    
    // Handle specific message types
    switch (messageType) {
      case 'openFormplayer':
        setFormplayerVisible(true);
        break;
      // Add other message handlers as needed
      default:
        console.log('Unhandled message type:', messageType);
    }
  };

  const handleWebViewMessage = async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      const { type, ...data } = message;
      const handler = formulusMessageHandlers[type] || formulusMessageHandlers.__default__;
      
      // Ensure webViewRef exists before calling the handler
      if (customAppRef.current?.webViewRef) {
        handler({ 
          data, 
          webViewRef: customAppRef.current.webViewRef, 
          event 
        });
      } else {
        console.warn('WebView reference is not available');
      }
    } catch (err) {
      console.warn('Failed to handle WebView message:', err);
    }
  };

  // This useEffect was moved above the conditional return statement

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loading} />
      ) : (
        /* Main WebView for custom app using our new component */
        <CustomAppWebView
          ref={customAppRef}
          appUrl={localUri || ''}
          onMessage={handleCustomAppMessage}
        />
      )}
      
      {/* Test button to open formplayer (can be removed in production) */}
      <TouchableOpacity 
        style={styles.testButton} 
        onPress={() => setFormplayerVisible(true)}
      >
        <Text style={styles.testButtonText}>Open Formplayer</Text>
      </TouchableOpacity>
      

      
      {/* Formplayer Modal */}
      <FormplayerModal 
        visible={formplayerVisible} 
        onClose={() => setFormplayerVisible(false)} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    elevation: 3,
  },
  adminButton: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    backgroundColor: '#9C27B0', // Purple color for admin button
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    elevation: 3,
  },
  testButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default HomeScreen;
