import React, { useEffect, useState, useRef } from 'react';
import {
  Alert,
  BackHandler,
  StyleSheet,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import CustomAppWebView, {
  CustomAppWebViewHandle,
} from '../components/CustomAppWebView';
import { colors } from '../theme/colors';
import { appEvents, Listener } from '../webview/FormulusMessageHandlers';
import { useAppTheme } from '../contexts/AppThemeContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HomeScreen = ({ navigation }: { navigation: any }) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [webViewKey, setWebViewKey] = useState(0);
  const customAppRef = useRef<CustomAppWebViewHandle>(null);
  const { reloadTheme } = useAppTheme();

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS !== 'android') {
        return;
      }

      const onBackPress = () => {
        if (customAppRef.current?.canGoBack?.()) {
          customAppRef.current.goBack();
          return true;
        }

        Alert.alert('Exit app?', 'Are you sure you want to exit Formulus?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Exit',
            style: 'destructive',
            onPress: () => BackHandler.exitApp(),
          },
        ]);
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => subscription.remove();
    }, []),
  );

  const checkAndSetAppUri = async () => {
    try {
      const filePath = `${RNFS.DocumentDirectoryPath}/app/index.html`;
      console.log('[HomeScreen] Checking for custom app at:', filePath);
      const fileExists = await RNFS.exists(filePath);
      console.log('[HomeScreen] Custom app exists:', fileExists);

      if (!fileExists) {
        let placeholderUri: string;
        if (Platform.OS === 'android') {
          placeholderUri = 'file:///android_asset/webview/placeholder_app.html';
        } else {
          // On iOS, assets linked via react-native.config.js are placed in the main bundle
          placeholderUri = `file://${RNFS.MainBundlePath}/placeholder_app.html`;
        }
        console.log('[HomeScreen] Using placeholder URI:', placeholderUri);
        setLocalUri(placeholderUri);
      } else {
        // (Re-)load the custom app's config so that all native UI elements
        // (tab bar, headers, modals) update to match the app's branding.
        // This triggers a context update → re-render across all consumers.
        await reloadTheme();

        const customAppUri = `file://${filePath}`;
        console.log('[HomeScreen] Using custom app URI:', customAppUri);
        setLocalUri(customAppUri);
      }
    } catch (err) {
      console.warn('[HomeScreen] Failed to setup app URI:', err);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      checkAndSetAppUri();
    });
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      Promise.resolve().then(() => {
        checkAndSetAppUri();
      });
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const onBundleUpdated: Listener = () => {
      checkAndSetAppUri();
      setWebViewKey(prev => prev + 1);
    };
    appEvents.addListener('bundleUpdated', onBundleUpdated);
    return () => appEvents.removeListener('bundleUpdated', onBundleUpdated);
  }, []);

  useEffect(() => {
    if (localUri) {
      // Defer to avoid synchronous setState in effect
      Promise.resolve().then(() => {
        setIsLoading(false);
      });
    }
  }, [localUri]);

  if (!localUri) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.semantic.info.medium} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={colors.semantic.info.medium}
          style={styles.loading}
        />
      ) : (
        <CustomAppWebView
          key={webViewKey}
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
