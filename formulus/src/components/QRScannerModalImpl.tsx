import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import {
  Camera,
  useCameraDevices,
  useCodeScanner,
  useCameraPermission,
  CodeType,
} from 'react-native-vision-camera';
import { colors } from '../theme/colors';
const { width } = Dimensions.get('window');

export interface ScannerModalResults {
  fieldId: string | undefined;
  status: 'success' | 'cancelled';
  message?: string;
  data?: {
    type: 'qrcode';
    value: string | undefined;
    format: CodeType | unknown;
    timestamp: string;
  };
}

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  fieldId?: string;
  onResult?: (result: ScannerModalResults) => void;
}

const QRScannerModalImpl: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  fieldId,
  onResult,
}) => {
  const [isScanning, setIsScanning] = useState(true);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const devices = useCameraDevices();
  const device = devices.find(d => d.position === 'back');
  const resultSentRef = useRef(false);

  useEffect(() => {
    if (visible && !hasPermission) {
      requestPermission();
    }
  }, [visible, hasPermission, requestPermission]);

  useEffect(() => {
    if (!visible) return;
    Promise.resolve().then(() => {
      setIsScanning(true);
      setScannedData(null);
      resultSentRef.current = false;
    });
  }, [visible]);

  const codeScanner = useCodeScanner({
    codeTypes: [
      'qr',
      'ean-13',
      'ean-8',
      'code-128',
      'code-39',
      'code-93',
      'upc-a',
      'upc-e',
      'data-matrix',
      'pdf-417',
      'aztec',
      'codabar',
      'itf',
    ],
    onCodeScanned: codes => {
      if (!isScanning || resultSentRef.current || codes.length === 0) return;
      const code = codes[0];
      setScannedData(code.value || '');
      setIsScanning(false);
      resultSentRef.current = true;
      if (onResult) {
        onResult({
          fieldId: fieldId || undefined,
          status: 'success',
          data: {
            type: 'qrcode',
            value: code.value,
            format: code.type,
            timestamp: new Date().toISOString(),
          },
        });
      }
    },
  });

  const handleCancel = () => {
    if (onResult) {
      onResult({
        fieldId: fieldId || undefined,
        status: 'cancelled',
        message: 'QR code scanning cancelled by user',
      });
    }
    onClose();
  };

  const handleRetry = () => {
    setIsScanning(true);
    setScannedData(null);
    resultSentRef.current = false;
  };

  const handleConfirm = () => onClose();

  if (!visible) return null;

  if (!hasPermission) {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Camera permission is required to scan QR codes
            </Text>
            <TouchableOpacity style={styles.button} onPress={requestPermission}>
              <Text style={styles.buttonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  if (!device) {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>No camera device found</Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <View style={styles.container}>
        <Camera
          style={styles.camera}
          device={device}
          isActive={visible && isScanning}
          codeScanner={codeScanner}
        />
        <View style={styles.overlay}>
          <View style={styles.topOverlay}>
            <Text style={styles.instructionText}>
              {scannedData
                ? 'Code Scanned!'
                : 'Point camera at QR code or barcode'}
            </Text>
          </View>
          <View style={styles.scanFrame}>
            <View style={styles.scanArea} />
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.bottomOverlay}>
            {scannedData ? (
              <View style={styles.resultContainer}>
                <Text style={styles.resultLabel}>Scanned:</Text>
                <Text style={styles.resultText} numberOfLines={3}>
                  {scannedData}
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleRetry}>
                    <Text style={styles.buttonText}>Scan Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleConfirm}>
                    <Text style={styles.buttonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.black },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  topOverlay: {
    flex: 1,
    backgroundColor: colors.ui.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  instructionText: {
    color: colors.neutral.white,
    fontSize: 18,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  scanFrame: { alignItems: 'center', justifyContent: 'center', height: 250 },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: colors.neutral.transparent,
    backgroundColor: colors.neutral.transparent,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.semantic.scanner.success,
    borderWidth: 3,
  },
  topLeft: {
    top: -15,
    left: width / 2 - 125 - 15,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  topRight: {
    top: -15,
    right: width / 2 - 125 - 15,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bottomLeft: {
    bottom: -15,
    left: width / 2 - 125 - 15,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: -15,
    right: width / 2 - 125 - 15,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: colors.ui.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  resultContainer: { alignItems: 'center', paddingHorizontal: 20 },
  resultLabel: {
    color: colors.neutral.white,
    fontSize: 16,
    marginBottom: 10,
  },
  resultText: {
    color: colors.semantic.scanner.success,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    fontFamily: 'monospace',
  },
  buttonRow: { flexDirection: 'row', gap: 20 },
  button: {
    backgroundColor: colors.semantic.info.ios,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginVertical: 10,
  },
  retryButton: {
    backgroundColor: colors.semantic.warning[500],
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  confirmButton: {
    backgroundColor: colors.semantic.success[500],
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: colors.neutral.transparent,
    borderWidth: 2,
    borderColor: colors.neutral.white,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.neutral.white,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cancelButtonText: {
    color: colors.neutral.white,
    fontSize: 16,
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionText: {
    color: colors.neutral.white,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    color: colors.neutral.white,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
  },
});

export default QRScannerModalImpl;
