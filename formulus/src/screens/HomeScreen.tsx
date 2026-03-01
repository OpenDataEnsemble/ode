import React, { useEffect, useState, useRef } from 'react';
import {
  BackHandler,
  StyleSheet,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import CustomAppWebView, {
  CustomAppWebViewHandle,
} from '../components/CustomAppWebView';
import BlurredScreenBackground from '../components/BlurredScreenBackground';
import { colors } from '../theme/colors';
import { appEvents, Listener } from '../webview/FormulusMessageHandlers';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useConfirmModal } from '../contexts/ConfirmModalContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HomeScreen = ({ navigation }: { navigation: any }) => {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [webViewKey, setWebViewKey] = useState(0);
  const [isPlaceholder, setIsPlaceholder] = useState(false);
  const customAppRef = useRef<CustomAppWebViewHandle>(null);
  const { reloadTheme, resolvedMode } = useAppTheme();
  const { showConfirm } = useConfirmModal();

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

        showConfirm({
          title: 'Exit app?',
          message: 'Are you sure you want to exit Formulus?',
          buttons: [
            { text: 'Cancel', onPress: () => {}, variant: 'tertiary' },
            {
              text: 'Exit',
              variant: 'danger',
              onPress: () => BackHandler.exitApp(),
            },
          ],
        });
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => subscription.remove();
    }, [showConfirm]),
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
        setIsPlaceholder(true);
      } else {
        // (Re-)load the custom app's config so that all native UI elements
        // (tab bar, headers, modals) update to match the app's branding.
        // This triggers a context update → re-render across all consumers.
        await reloadTheme();

        const customAppUri = `file://${filePath}`;
        console.log('[HomeScreen] Using custom app URI:', customAppUri);
        setLocalUri(customAppUri);
        setIsPlaceholder(false);
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

  // Keep placeholder screen theme in sync with in-app theme selection.
  useEffect(() => {
    if (!localUri || !isPlaceholder || !customAppRef.current) {
      return;
    }
    const js = `
      (function() {
        try {
          if (window.__formulusSetTheme) {
            window.__formulusSetTheme('${resolvedMode}');
          }
        } catch (e) {
          // no-op
        }
      })();
    `;
    customAppRef.current.injectJavaScript(js);
  }, [resolvedMode, localUri, isPlaceholder]);

  if (!localUri) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.semantic.info.medium} />
      </View>
    );
  }

  const content = (
    <>
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
          onNavigateToSync={() => navigation.navigate('Sync')}
          onNavigateToSettings={() => navigation.navigate('Settings')}
          transparentBackground={isPlaceholder}
        />
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isPlaceholder ? (
        <BlurredScreenBackground>{content}</BlurredScreenBackground>
      ) : (
        content
      )}
    </SafeAreaView>
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
