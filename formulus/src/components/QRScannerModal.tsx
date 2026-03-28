import React, { Component, ErrorInfo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  NativeModules,
  TurboModuleRegistry,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import Button from './common/Button';

/** Native module is registered as RNCameraKitModule (not CameraKit). See react-native-camera-kit-no-google. */
function isCameraKitNativeLinked(): boolean {
  if (NativeModules.RNCameraKitModule != null) return true;
  if (NativeModules.CameraKit != null) return true;
  return TurboModuleRegistry.get('RNCameraKitModule') != null;
}

class QRScannerErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError = () => ({ hasError: true });

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('QRScannerModal: camera kit error', error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export interface ScannerModalResults {
  fieldId: string | undefined;
  status: 'success' | 'cancelled';
  message?: string;
  data?: {
    type: 'qrcode';
    value: string | undefined;
    format: unknown;
    timestamp: string;
  };
}

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  fieldId?: string;
  onResult?: (result: ScannerModalResults) => void;
}

// Only load QRScannerModalImpl if react-native-camera-kit-no-google is linked
let QRScannerModalImpl: React.ComponentType<QRScannerModalProps> | null = null;
try {
  if (isCameraKitNativeLinked()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    QRScannerModalImpl = require('./QRScannerModalImpl').default;
  }
} catch (e) {
  console.warn('QRScannerModal: CameraKit not linked, using fallback', e);
}

const FallbackContent: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <SafeAreaView
    style={styles.container}
    edges={['top', 'bottom', 'left', 'right']}>
    <ScrollView
      style={styles.fallbackScrollView}
      contentContainerStyle={styles.fallbackScrollContent}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.fallbackText}>
        QR scanner not available. Camera module
        (react-native-camera-kit-no-google) is not linked. Rebuild the native
        app after installing the dependency.
      </Text>
      <View style={styles.fallbackButtonWrap}>
        <Button
          title="Close"
          onPress={onClose}
          variant="secondary"
          size="medium"
        />
      </View>
    </ScrollView>
  </SafeAreaView>
);

const QRScannerModal: React.FC<QRScannerModalProps> = props => {
  if (QRScannerModalImpl) {
    return (
      <QRScannerErrorBoundary
        fallback={
          props.visible ? (
            <Modal visible animationType="slide" statusBarTranslucent>
              <FallbackContent onClose={props.onClose} />
            </Modal>
          ) : null
        }>
        <QRScannerModalImpl {...props} />
      </QRScannerErrorBoundary>
    );
  }

  if (!props.visible) return null;

  return (
    <Modal visible={props.visible} animationType="slide" statusBarTranslucent>
      <FallbackContent onClose={props.onClose} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.black },
  fallbackScrollView: { flex: 1 },
  fallbackScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  fallbackText: {
    color: colors.neutral.white,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  fallbackButtonWrap: {
    alignSelf: 'center',
    maxWidth: '100%',
  },
});

export default QRScannerModal;
