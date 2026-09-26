import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  type ColorValue,
} from 'react-native';
import {
  Camera,
  CameraType,
  type CodeFormat,
} from 'react-native-camera-kit-no-google';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  type Permission,
} from 'react-native-permissions';
import { colors } from '../theme/colors';
import { odeSpacing, odeButton } from '../theme/odeDesign';
import Button from './common/Button';
import {
  delayBeforeCameraOpen,
  markCameraReleased,
} from '../services/cameraReopenGate';

const { width } = Dimensions.get('window');

/** iOS supports all listed types; Android (no-google fork) scans QR only — see library README. */
const IOS_BARCODE_TYPES: CodeFormat[] = [
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
  'itf-14',
];

export interface ScannerModalResults {
  fieldId: string | undefined;
  status: 'success' | 'cancelled';
  message?: string;
  data?: {
    type: 'qrcode';
    value: string | undefined;
    format: CodeFormat | unknown;
    timestamp: string;
  };
}

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  fieldId?: string;
  onResult?: (result: ScannerModalResults) => void;
}

const cameraPermission: Permission | undefined = Platform.select({
  ios: PERMISSIONS.IOS.CAMERA,
  android: PERMISSIONS.ANDROID.CAMERA,
});

const QRScannerModalImpl: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  fieldId,
  onResult,
}) => {
  const [isScanning, setIsScanning] = useState(true);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [perm, setPerm] = useState<'checking' | 'granted' | 'denied'>(
    'checking',
  );
  const resultSentRef = useRef(false);
  const [cameraArmed, setCameraArmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setIsScanning(true);
      setScannedData(null);
      resultSentRef.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Re-check permission when the modal opens, but do not bounce granted →
  // checking → granted. That remounts <Camera> and races CameraX unbind.
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    (async () => {
      if (!cameraPermission) {
        if (!cancelled) setPerm('granted');
        return;
      }
      let status = await check(cameraPermission);
      if (status === RESULTS.DENIED) {
        status = await request(cameraPermission);
      }
      if (cancelled) return;
      setPerm(status === RESULTS.GRANTED ? 'granted' : 'denied');
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const previewActive =
    visible && perm === 'granted' && isScanning && scannedData == null;

  useEffect(() => {
    if (!previewActive) {
      return () => {
        markCameraReleased();
      };
    }

    const timer = setTimeout(() => {
      setCameraArmed(true);
    }, delayBeforeCameraOpen());

    return () => {
      clearTimeout(timer);
      setCameraArmed(false);
      markCameraReleased();
    };
  }, [previewActive]);

  const requestCameraPermission = useCallback(async () => {
    if (!cameraPermission) {
      setPerm('granted');
      return;
    }
    const status = await request(cameraPermission);
    setPerm(status === RESULTS.GRANTED ? 'granted' : 'denied');
  }, []);

  const onReadCode = useCallback(
    (event: {
      nativeEvent: { codeStringValue: string; codeFormat: CodeFormat };
    }) => {
      if (!isScanning || resultSentRef.current) return;
      const value = event.nativeEvent.codeStringValue;
      const format = event.nativeEvent.codeFormat;
      setScannedData(value || '');
      setIsScanning(false);
      resultSentRef.current = true;
      onResult?.({
        fieldId: fieldId || undefined,
        status: 'success',
        data: {
          type: 'qrcode',
          value: value,
          format,
          timestamp: new Date().toISOString(),
        },
      });
    },
    [isScanning, fieldId, onResult],
  );

  const handleCancel = () => {
    onResult?.({
      fieldId: fieldId || undefined,
      status: 'cancelled',
      message: 'QR code scanning cancelled by user',
    });
    onClose();
  };

  const handleRetry = () => {
    setIsScanning(true);
    setScannedData(null);
    resultSentRef.current = false;
  };

  const handleConfirm = () => onClose();

  if (!visible) return null;

  if (perm === 'checking') {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={colors.neutral.white} />
        </View>
      </Modal>
    );
  }

  if (perm === 'denied') {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Camera permission is required to scan QR codes. Select continue to
              grant these permissions.
            </Text>
            <View style={styles.permissionButtonRow}>
              <Button
                title="Continue"
                onPress={requestCameraPermission}
                variant="primary"
                style={styles.permissionButton}
              />
              <Button
                title="Cancel"
                onPress={handleCancel}
                variant="tertiary"
                style={styles.cancelButtonFormulus}
              />
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <View style={styles.container}>
        {cameraArmed && previewActive ? (
          <Camera
            style={styles.camera}
            cameraType={CameraType.Back}
            scanBarcode={isScanning}
            showFrame
            scanThrottleDelay={500}
            allowedBarcodeTypes={
              Platform.OS === 'android' ? ['qr'] : IOS_BARCODE_TYPES
            }
            onReadCode={onReadCode}
          />
        ) : (
          <View style={[styles.camera, styles.centered]}>
            <ActivityIndicator size="large" color={colors.neutral.white} />
          </View>
        )}
        <View style={styles.overlay}>
          <View style={styles.topOverlay}>
            <Text style={styles.instructionText}>
              {scannedData
                ? 'Code Scanned!'
                : Platform.OS === 'android'
                  ? 'Point camera at QR code'
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
                  <Button
                    title="Scan Again"
                    onPress={handleRetry}
                    variant="secondary"
                    style={styles.optionButton}
                  />
                  <Button
                    title="Confirm"
                    onPress={handleConfirm}
                    variant="primary"
                    style={styles.optionButton}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.permissionButtonRow}>
                <Button
                  title="Cancel"
                  onPress={handleCancel}
                  variant="tertiary"
                  style={styles.cancelButtonFormulus}
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.black },
  centered: { justifyContent: 'center', alignItems: 'center' },
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
    borderColor: colors.semantic.scanner.success as unknown as ColorValue,
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
    color: colors.semantic.scanner.success as unknown as ColorValue,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    fontFamily: 'monospace',
  },
  buttonRow: { flexDirection: 'row', gap: 20 },
  permissionButtonRow: {
    alignItems: 'center',
    marginTop: odeSpacing.xs,
    gap: odeSpacing.sm,
  },
  permissionButton: {
    marginVertical: 0,
    flex: 0,
    maxHeight: odeButton.standaloneMaxHeight,
    width: odeButton.standaloneWidth,
    alignSelf: 'center',
  },
  optionButton: { flex: 1 },
  cancelButtonFormulus: {
    marginTop: 0,
    flex: 0,
    maxHeight: odeButton.standaloneMaxHeight,
    width: odeButton.standaloneWidth,
    alignSelf: 'center',
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
});

export default QRScannerModalImpl;
