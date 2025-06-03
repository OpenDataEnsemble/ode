import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, Text, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import FormplayerModal from '../components/FormplayerModal';
import CustomAppWebView, { CustomAppWebViewHandle } from '../components/CustomAppWebView';
import { appEvents } from '../webview/FormulusMessageHandlers'; // Import appEvents


const HomeScreen = ({ navigation }: any) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [formplayerVisible, setFormplayerVisible] = useState(false);
  const [formplayerConfig, setFormplayerConfig] = useState<any>(null); // State to hold formplayer launch config
  const [isLoading, setIsLoading] = useState(true);
  const customAppRef = useRef<CustomAppWebViewHandle>(null);

  useEffect(() => {
    const setupPlaceholder = async () => {
      try {
        const filePath = `${RNFS.DocumentDirectoryPath}/app/index.html`;
        const fileExists = await RNFS.exists(filePath);
        if (!fileExists) {
          // USE PLACEHOLDER
          const placeholderUri = Platform.OS === 'android' 
            ? 'file:///android_asset/webview/placeholder_app.html'
            : 'file:///webview/placeholder_app.html'; // Add iOS path
          console.log('Using placeholder HTML at:', placeholderUri);
          setLocalUri(placeholderUri);
        } else {
          console.log('Using custom app HTML at:', filePath);          
          setLocalUri(`file://${filePath}`);
        }
      } catch (err) {
        console.warn('Failed to setup placeholder HTML:', err);
      }
    };
   
    setupPlaceholder();
  }, []);

  useEffect(() => {
    const handleOpenFormplayer = (config: any) => {
      console.log('HomeScreen: openFormplayerRequested event received', config);
      setFormplayerConfig(config); // Store the config (formId, params, savedData)
      setFormplayerVisible(true);   // Show the modal
    };

    appEvents.addListener('openFormplayerRequested', handleOpenFormplayer);

    return () => {
      appEvents.removeListener('openFormplayerRequested', handleOpenFormplayer);
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  
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


  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loading} />
      ) : (
        /* Main WebView for custom app using our new component */
        <CustomAppWebView
          ref={customAppRef}
          appUrl={localUri || ''}
          appName="custom_app"
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
        onClose={() => {
          setFormplayerVisible(false);
          setFormplayerConfig(null); // Clear config when closing
        }} 
        initialConfig={formplayerConfig} // Pass the config to the modal
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
