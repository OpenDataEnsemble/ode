import React, {useEffect, useState} from 'react';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {StatusBar} from 'react-native';
import 'react-native-url-polyfill/auto';
import {FormService} from './src/services/FormService';
import {SyncProvider} from './src/contexts/SyncContext';
import {appEvents} from './src/webview/FormulusMessageHandlers.ts';
import FormplayerModal, {
  FormplayerModalHandle,
} from './src/components/FormplayerModal';
import QRScannerModal from './src/components/QRScannerModal';
import SignatureCaptureModal from './src/components/SignatureCaptureModal';
import MainAppNavigator from './src/navigation/MainAppNavigator';

const LightNavigationTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    background: '#ffffff',
    card: '#ffffff',
    text: '#000000',
    primary: '#007AFF',
    border: DefaultTheme.colors.border,
    notification: DefaultTheme.colors.notification,
  },
};

function App(): React.JSX.Element {
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [qrScannerData, setQrScannerData] = useState<{
    fieldId: string;
    onResult: (result: any) => void;
  } | null>(null);

  const [signatureCaptureVisible, setSignatureCaptureVisible] = useState(false);
  const [signatureCaptureData, setSignatureCaptureData] = useState<{
    fieldId: string;
    onResult: (result: any) => void;
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
      onResult: (result: any) => void;
    }) => {
      setQrScannerData(data);
      setQrScannerVisible(true);
    };

    const handleOpenSignatureCapture = (data: {
      fieldId: string;
      onResult: (result: any) => void;
    }) => {
      setSignatureCaptureData(data);
      setSignatureCaptureVisible(true);
    };

    appEvents.addListener('openQRScanner', handleOpenQRScanner);
    appEvents.addListener('openSignatureCapture', handleOpenSignatureCapture);

    const handleOpenFormplayer = async (config: any) => {
      if (formplayerVisibleRef.current) {
        return;
      }

      const {formType, observationId, params, savedData, operationId} = config;
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

    appEvents.addListener('openFormplayerRequested', handleOpenFormplayer);
    appEvents.addListener('closeFormplayer', handleCloseFormplayer);

    return () => {
      appEvents.removeListener('openQRScanner', handleOpenQRScanner);
      appEvents.removeListener(
        'openSignatureCapture',
        handleOpenSignatureCapture,
      );
      appEvents.removeListener('openFormplayerRequested', handleOpenFormplayer);
      appEvents.removeListener('closeFormplayer', handleCloseFormplayer);
    };
  }, []);

  return (
    <SyncProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <NavigationContainer theme={LightNavigationTheme}>
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
        onSignatureCapture={(result: any) => {
          signatureCaptureData?.onResult?.(result);
        }}
      />
    </SyncProvider>
  );
}

export default App;
