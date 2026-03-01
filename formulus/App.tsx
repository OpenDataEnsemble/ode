import React, { useEffect, useMemo, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { StatusBar, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-url-polyfill/auto';
import { FormService } from './src/services/FormService';
import { SyncProvider } from './src/contexts/SyncContext';
import { AppThemeProvider, useAppTheme } from './src/contexts/AppThemeContext';
import { appEvents, Listener } from './src/webview/FormulusMessageHandlers.ts';
import FormplayerModal, {
  FormplayerModalHandle,
} from './src/components/FormplayerModal';
import QRScannerModal from './src/components/QRScannerModal';
import SignatureCaptureModal from './src/components/SignatureCaptureModal';
import MainAppNavigator from './src/navigation/MainAppNavigator';
import { FormInitData } from './src/webview/FormulusInterfaceDefinition.ts';

/**
 * Inner component that consumes the AppTheme context to build a dynamic
 * React Navigation theme matching the custom app's branding.
 */
function AppInner(): React.JSX.Element {
  const { themeColors, resolvedMode } = useAppTheme();
  const isDark = resolvedMode === 'dark';

  // Build the React Navigation theme dynamically from the custom app's colors.
  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: themeColors.primary,
        background: themeColors.background,
        card: themeColors.surface,
        text: themeColors.onBackground,
        border: themeColors.divider,
        notification: themeColors.error,
      },
    };
  }, [isDark, themeColors]);

  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [qrScannerData, setQrScannerData] = useState<{
    fieldId: string;
    onResult: (result: unknown) => void;
  } | null>(null);

  const [signatureCaptureVisible, setSignatureCaptureVisible] = useState(false);
  const [signatureCaptureData, setSignatureCaptureData] = useState<{
    fieldId: string;
    onResult: (result: unknown) => void;
  } | null>(null);

  const [formplayerVisible, setFormplayerVisible] = useState(false);
  const formplayerModalRef = React.useRef<FormplayerModalHandle>(null);
  const formplayerVisibleRef = React.useRef(false);

  useEffect(() => {
    formplayerVisibleRef.current = formplayerVisible;
  }, [formplayerVisible]);

  useEffect(() => {
    FormService.getInstance();

    const handleOpenQRScanner = (data: {
      fieldId: string;
      onResult: (result: unknown) => void;
    }) => {
      setQrScannerData(data);
      setQrScannerVisible(true);
    };

    const handleOpenSignatureCapture = (data: {
      fieldId: string;
      onResult: (result: unknown) => void;
    }) => {
      setSignatureCaptureData(data);
      setSignatureCaptureVisible(true);
    };

    appEvents.addListener('openQRScanner', handleOpenQRScanner as Listener);
    appEvents.addListener(
      'openSignatureCapture',
      handleOpenSignatureCapture as Listener,
    );

    const handleOpenFormplayer = async (config: FormInitData) => {
      // If formplayer is already visible, close it first to allow opening a new form
      if (formplayerVisibleRef.current) {
        console.log(
          '[App] Formplayer already visible, closing first before opening new form',
        );
        formplayerVisibleRef.current = false;
        setFormplayerVisible(false);
        // Wait for modal to close before proceeding
        await new Promise<void>(resolve => setTimeout(() => resolve(), 300));
      }

      const { formType, observationId, params, savedData, operationId } =
        config;

      try {
        const formService = await FormService.getInstance();
        const forms = formService.getFormSpecs();

        if (forms.length === 0) {
          Alert.alert(
            'No Forms Available',
            'No forms are available. Please sync forms first.',
          );
          return;
        }

        const formSpec = forms.find(form => form.id === formType);
        if (!formSpec) {
          Alert.alert(
            'Form Not Found',
            `Form "${formType}" not found. Please sync forms first.`,
          );
          return;
        }

        // Set visible state first to mount the modal
        formplayerVisibleRef.current = true;
        setFormplayerVisible(true);

        // Wait for modal to mount and WebView to start loading before initializing form
        // This ensures the WebView ref is available and the modal is visible
        setTimeout(() => {
          formplayerModalRef.current?.initializeForm(
            formSpec,
            params || null,
            observationId || null,
            savedData || null,
            operationId || null,
          );
        }, 200);
      } catch (error) {
        console.error('[App] Error opening formplayer:', error);
        Alert.alert(
          'Error',
          `Failed to open form: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
        // Reset state on error
        formplayerVisibleRef.current = false;
        setFormplayerVisible(false);
      }
    };

    const handleCloseFormplayer = () => {
      formplayerVisibleRef.current = false;
      setFormplayerVisible(false);
    };

    appEvents.addListener(
      'openFormplayerRequested',
      handleOpenFormplayer as Listener,
    );
    appEvents.addListener('closeFormplayer', handleCloseFormplayer);

    return () => {
      appEvents.removeListener(
        'openQRScanner',
        handleOpenQRScanner as Listener,
      );
      appEvents.removeListener(
        'openSignatureCapture',
        handleOpenSignatureCapture as Listener,
      );
      appEvents.removeListener(
        'openFormplayerRequested',
        handleOpenFormplayer as Listener,
      );
      appEvents.removeListener('closeFormplayer', handleCloseFormplayer);
    };
  }, []);

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.surface}
      />
      <NavigationContainer theme={navigationTheme}>
        <MainAppNavigator />
        <FormplayerModal
          ref={formplayerModalRef}
          visible={formplayerVisible}
          onClose={() => {
            formplayerVisibleRef.current = false;
            setFormplayerVisible(false);
          }}
        />
      </NavigationContainer>

      <QRScannerModal
        visible={qrScannerVisible}
        onClose={() => {
          setQrScannerVisible(false);
          setQrScannerData(null);
        }}
        fieldId={qrScannerData?.fieldId}
        onResult={qrScannerData?.onResult}
      />

      <SignatureCaptureModal
        visible={signatureCaptureVisible}
        onClose={() => {
          setSignatureCaptureVisible(false);
          setSignatureCaptureData(null);
        }}
        fieldId={signatureCaptureData?.fieldId || ''}
        onSignatureCapture={(result: unknown) => {
          signatureCaptureData?.onResult?.(result);
        }}
      />
    </>
  );
}

/**
 * Root component.  Wraps everything in the AppThemeProvider so that the
 * custom app's brand colors are available to all native UI elements.
 */
function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <SyncProvider>
        <AppThemeProvider>
          <AppInner />
        </AppThemeProvider>
      </SyncProvider>
    </SafeAreaProvider>
  );
}

export default App;
