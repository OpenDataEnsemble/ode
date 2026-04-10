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
import { ConfirmModalProvider } from './src/contexts/ConfirmModalContext';
import { appEvents, Listener } from './src/webview/FormulusMessageHandlers.ts';
import FormplayerModal, {
  FormplayerModalHandle,
} from './src/components/FormplayerModal';
import QRScannerModal from './src/components/QRScannerModal';
import SignatureCaptureModal from './src/components/SignatureCaptureModal';
import MainAppNavigator from './src/navigation/MainAppNavigator';
import { FormInitData } from './src/webview/FormulusInterfaceDefinition.ts';
import { FormSpec } from './src/services';

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

  type FormplayerStackEntry = {
    id: string;
    formSpec: FormSpec;
    params: Record<string, unknown> | null;
    observationId: string | null;
    savedData: Record<string, unknown> | null;
    operationId: string | null;
    returnOnly?: boolean;  // For child forms opened from linkedtable
  };

  const [formplayerStack, setFormplayerStack] = useState<
    FormplayerStackEntry[]
  >([]);
  const formplayerModalRefs = React.useRef(
    new Map<string, FormplayerModalHandle | null>(),
  );

  const initializeStackEntry = React.useCallback(
    (entry: FormplayerStackEntry) => {
      let attempt = 0;

      const tryInitialize = () => {
        const modalHandle = formplayerModalRefs.current.get(entry.id);
        if (!modalHandle) {
          if (attempt < 20) {
            attempt += 1;
            setTimeout(tryInitialize, 100);
          }
          return;
        }

        setTimeout(() => {
          modalHandle.initializeForm(
            entry.formSpec,
            entry.params,
            entry.observationId,
            entry.savedData,
            entry.operationId,
            entry.returnOnly,  // ← Pass returnOnly flag
          );
        }, 200);
      };

      tryInitialize();
    },
    [],
  );

  const closeFormplayerEntry = React.useCallback((entryId: string) => {
    formplayerModalRefs.current.delete(entryId);
    setFormplayerStack(current =>
      current.filter(entry => entry.id !== entryId),
    );
  }, []);

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
      const { formType, observationId, params, savedData, operationId, returnOnly } =
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

        const entryId =
          operationId ||
          `${formType}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const entry: FormplayerStackEntry = {
          id: entryId,
          formSpec,
          params: params || null,
          observationId: observationId || null,
          savedData: savedData || null,
          operationId: operationId || null,
          returnOnly: returnOnly || false,  // Include returnOnly flag
        };

        setFormplayerStack(current => [...current, entry]);
        initializeStackEntry(entry);
      } catch (error) {
        console.error('[App] Error opening formplayer:', error);
        Alert.alert(
          'Error',
          `Failed to open form: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    };

    const handleCloseFormplayer = () => {
      setFormplayerStack(current => {
        if (current.length === 0) {
          return current;
        }
        const next = current.slice(0, -1);
        const removed = current[current.length - 1];
        formplayerModalRefs.current.delete(removed.id);
        return next;
      });
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
  }, [closeFormplayerEntry, initializeStackEntry]);

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={themeColors.surface}
      />
      <NavigationContainer theme={navigationTheme}>
        <MainAppNavigator />
        {formplayerStack.map((entry, index) => (
          <FormplayerModal
            key={entry.id}
            ref={instance => {
              if (instance) {
                formplayerModalRefs.current.set(entry.id, instance);
              } else {
                formplayerModalRefs.current.delete(entry.id);
              }
            }}
            visible={true}
            isActive={index === formplayerStack.length - 1}
            onClose={() => {
              closeFormplayerEntry(entry.id);
            }}
          />
        ))}
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
          <ConfirmModalProvider>
            <AppInner />
          </ConfirmModalProvider>
        </AppThemeProvider>
      </SyncProvider>
    </SafeAreaProvider>
  );
}

export default App;
