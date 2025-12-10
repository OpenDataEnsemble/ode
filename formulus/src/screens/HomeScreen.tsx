import React, {useEffect, useState, useRef} from 'react';
import {StyleSheet, View, ActivityIndicator, Platform} from 'react-native';
import RNFS from 'react-native-fs';
import CustomAppWebView, {
  CustomAppWebViewHandle,
} from '../components/CustomAppWebView';

const HomeScreen = ({navigation}: any) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const customAppRef = useRef<CustomAppWebViewHandle>(null);

  const checkAndSetAppUri = async () => {
    try {
      const filePath = `${RNFS.DocumentDirectoryPath}/app/index.html`;
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        const placeholderUri =
          Platform.OS === 'android'
            ? 'file:///android_asset/webview/placeholder_app.html'
            : 'file:///webview/placeholder_app.html';
        setLocalUri(placeholderUri);
      } else {
        setLocalUri(`file://${filePath}`);
      }
    } catch (err) {
      console.warn('Failed to setup app URI:', err);
    }
  };

  useEffect(() => {
    checkAndSetAppUri();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      checkAndSetAppUri();
    });
    return unsubscribe;
  }, [navigation]);

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
        <ActivityIndicator
          size="large"
          color="#4A90E2"
          style={styles.loading}
        />
      ) : (
        <CustomAppWebView
          ref={customAppRef}
          appUrl={localUri}
          appName="custom_app"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;
