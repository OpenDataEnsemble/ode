import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, Text, Platform, Alert } from 'react-native';
import RNFS from 'react-native-fs';
import FormplayerModal, { FormplayerModalHandle } from '../components/FormplayerModal';
import CustomAppWebView, { CustomAppWebViewHandle } from '../components/CustomAppWebView';
import { appEvents } from '../webview/FormulusMessageHandlers'; // Import appEvents
import { FormService } from '../services/FormService';

const HomeScreen = ({ navigation }: any) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [formplayerVisible, setFormplayerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const customAppRef = useRef<CustomAppWebViewHandle>(null);
  const formplayerModalRef = useRef<FormplayerModalHandle>(null);

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
    console.log('HomeScreen: MOUNTED'); // Added for debugging mount/unmount
    
    // Subscribe to FormService cache invalidation to refresh form specs
    let unsubscribeFromCache: (() => void) | null = null;
    
    const initCacheSubscription = async () => {
      try {
        const formService = await FormService.getInstance();
        unsubscribeFromCache = formService.onCacheInvalidated(() => {
          console.log('HomeScreen: FormService cache invalidated, form specs refreshed');
        });
      } catch (error) {
        console.error('HomeScreen: Failed to subscribe to FormService cache invalidation:', error);
      }
    };
    
    initCacheSubscription();
    
    const handleOpenFormplayer = async (config: any) => {
      console.log('HomeScreen: openFormplayerRequested event received', config);

      const { formType, observationId, params, savedData } = config;
      
      setFormplayerVisible(true);
      // Use the ref-based approach to initialize the form
      const formService = await FormService.getInstance();
      const forms = formService.getFormSpecs();
      
      if (forms.length === 0) {
        Alert.alert(
          'No Forms Available', 
          'No form specifications have been downloaded yet. Please go to Settings to configure your server, then use the Sync screen to download the app bundle.',
          [{ text: 'OK' }]
        );
        console.warn('No forms available - app bundle needs to be downloaded');
        return;
      }
      
      const formSpec = forms.find((form) => form.id === formType);
      if (!formSpec) {
        Alert.alert(
          'Form Not Found', 
          `The requested form "${formType}" was not found. Available forms: ${forms.map(f => f.id).join(', ')}`,
          [{ text: 'OK' }]
        );
        console.warn(`Form ${formType} not found. Available forms:`, forms.map(f => f.id));
        return;
      }
      //TODO: Handle edit mode
      formplayerModalRef.current?.initializeForm(
        formSpec,
        params || null, // params if any
        observationId || null, // observation ID for edit mode
        savedData || null // Saved data if any
      );
    };

    const handleCloseFormplayer = (data: any) => {
      console.log('HomeScreen: closeFormplayer event received', data);
      setFormplayerVisible(false);
    };

    appEvents.addListener('openFormplayerRequested', handleOpenFormplayer);
    appEvents.addListener('closeFormplayer', handleCloseFormplayer);

    return () => {
      console.log('HomeScreen: UNMOUNTING'); // Added for debugging mount/unmount
      appEvents.removeListener('openFormplayerRequested', handleOpenFormplayer);
      appEvents.removeListener('closeFormplayer', handleCloseFormplayer);
      
      // Cleanup FormService cache subscription
      if (unsubscribeFromCache) {
        unsubscribeFromCache();
      }
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

  const handleClick = () => {
    console.log('HomeScreen: handleClick event received');
    setFormplayerVisible(true);
    const bgPath = "file:///data/user/0/com.formulus/files/app/assets/sapiens-Dt1gTJ5Q.jpg";
    // Check if bgPath exists
    RNFS.exists(bgPath).then((exists) => {
      if (exists) {
        console.log('Background image exists at:', bgPath);
      } else {
        console.log('Background image does not exist at:', bgPath);
      }
    });
  };

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
        onPress={() => handleClick()}
      >
        <Text style={styles.testButtonText}>Open Formplayer</Text>
      </TouchableOpacity>
      

      
      {/* Formplayer Modal */}
      <FormplayerModal 
        ref={formplayerModalRef}
        visible={formplayerVisible} 
        onClose={() => {
          setFormplayerVisible(false);
        }}
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
