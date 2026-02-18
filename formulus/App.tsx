import React, { useEffect, useMemo, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { StatusBar, useColorScheme } from 'react-native';
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
  const colorScheme = useColorScheme();
  const { themeColors } = useAppTheme();

  // Build the React Navigation theme dynamically from the custom app's colors.
  const navigationTheme = useMemo(() => {
    const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: colorScheme === 'dark',
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
  }, [colorScheme, themeColors]);

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
      if (formplayerVisibleRef.current) {
        return;
      }

      const { formType, observationId, params, savedData, operationId } =
        config;
      formplayerVisibleRef.current = true;
      setFormplayerVisible(true);

      const formService = await FormService.getInstance();
      const forms = formService.getFormSpecs();

      if (forms.length === 0) {
        return;
      }

      const formSpec = forms.find(form => form.id === formType);
      if (!formSpec) {
        return;
      }

      formplayerModalRef.current?.initializeForm(
        formSpec,
        params || null,
        observationId || null,
        savedData || null,
        operationId || null,
      );
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
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
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
