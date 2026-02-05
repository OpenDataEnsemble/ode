import React, { Component, ErrorInfo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

class VisionCameraErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError = () => ({ hasError: true });

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('QRScannerModal: VisionCamera error', error, info);
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

// Only load QRScannerModalImpl if VisionCamera native module is linked
let QRScannerModalImpl: React.ComponentType<QRScannerModalProps> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NativeModules } = require('react-native');
  if (NativeModules.CameraView) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    QRScannerModalImpl = require('./QRScannerModalImpl').default;
  }
} catch (e) {
  console.warn('QRScannerModal: VisionCamera not linked, using fallback', e);
}

const FallbackContent: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <View style={styles.container}>
    <View style={styles.fallbackContainer}>
      <Text style={styles.fallbackText}>
        QR scanner not available. Camera module (react-native-vision-camera) is
        not linked. Re-enable it in react-native.config.js and rebuild.
      </Text>
      <TouchableOpacity style={styles.button} onPress={onClose}>
        <Text style={styles.buttonText}>Close</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const QRScannerModal: React.FC<QRScannerModalProps> = props => {
  if (QRScannerModalImpl) {
    return (
      <VisionCameraErrorBoundary
        fallback={
          props.visible ? (
            <Modal visible animationType="slide" statusBarTranslucent>
              <FallbackContent onClose={props.onClose} />
            </Modal>
          ) : null
        }>
        <QRScannerModalImpl {...props} />
      </VisionCameraErrorBoundary>
    );
  }

  if (!props.visible) return null;

  return (
    <Modal visible={props.visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackText}>
            QR scanner not available. Camera module (react-native-vision-camera)
            is not linked. Re-enable it in react-native.config.js and rebuild.
          </Text>
          <TouchableOpacity style={styles.button} onPress={props.onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.black },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  fallbackText: {
    color: colors.neutral.white,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.semantic.info.ios,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.neutral.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default QRScannerModal;
