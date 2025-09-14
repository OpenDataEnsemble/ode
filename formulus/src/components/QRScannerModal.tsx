import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Camera, useCameraDevices, useFrameProcessor, useCameraPermission } from 'react-native-vision-camera';
import { scanBarcodes, BarcodeFormat } from 'vision-camera-code-scanner';
import { appEvents } from '../webview/FormulusMessageHandlers';

const { width, height } = Dimensions.get('window');

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  fieldId?: string;
  onResult?: (result: any) => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({
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

  // Request camera permission when modal opens
  useEffect(() => {
    if (visible && !hasPermission) {
      requestPermission();
    }
  }, [visible, hasPermission, requestPermission]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setIsScanning(true);
      setScannedData(null);
      resultSentRef.current = false;
    }
  }, [visible]);

  // Frame processor for barcode scanning
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'
    
    if (!isScanning) return;
    
    try {
      const barcodes = scanBarcodes(frame, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.PDF417,
        BarcodeFormat.AZTEC,
      ]);
      
      if (barcodes.length > 0 && !resultSentRef.current) {
        const barcode = barcodes[0];
        console.log('Barcode detected:', barcode);
        
        // Use runOnJS to call React state updates from worklet
        const handleBarcodeDetected = (value: string, format: string) => {
          'worklet'
          console.log('Processing barcode:', value, format);
          setScannedData(value);
          setIsScanning(false);
          resultSentRef.current = true;
          
          // Send result back to handler
          if (onResult && fieldId) {
            onResult({
              fieldId,
              status: 'success',
              data: {
                type: 'qrcode',
                value: value,
                format: format,
                timestamp: new Date().toISOString()
              }
            });
          }
        };
        
        // Call the handler function
        if (barcode.displayValue) {
          handleBarcodeDetected(barcode.displayValue, String(barcode.format));
        }
      }
    } catch (error) {
      console.error('Frame processor error:', error);
    }
  }, [isScanning, fieldId, onResult]);

  const handleCancel = () => {
    if (onResult && fieldId) {
      onResult({
        fieldId,
        status: 'cancelled',
        message: 'QR code scanning cancelled by user'
      });
    }
    onClose();
  };

  const handleRetry = () => {
    setIsScanning(true);
    setScannedData(null);
    resultSentRef.current = false;
  };

  const handleConfirm = () => {
    onClose();
  };

  if (!visible) {
    return null;
  }

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
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
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
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
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
          frameProcessor={frameProcessor}
        />
        
        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Top overlay */}
          <View style={styles.topOverlay}>
            <Text style={styles.instructionText}>
              {scannedData ? 'Code Scanned!' : 'Point camera at QR code or barcode'}
            </Text>
          </View>
          
          {/* Scanning frame */}
          <View style={styles.scanFrame}>
            <View style={styles.scanArea} />
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          
          {/* Bottom overlay with controls */}
          <View style={styles.bottomOverlay}>
            {scannedData ? (
              <View style={styles.resultContainer}>
                <Text style={styles.resultLabel}>Scanned:</Text>
                <Text style={styles.resultText} numberOfLines={3}>
                  {scannedData}
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                    <Text style={styles.buttonText}>Scan Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                    <Text style={styles.buttonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
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
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  instructionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  scanFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 250,
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#00ff00',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  resultContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  resultLabel: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
  },
  resultText: {
    color: '#00ff00',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    fontFamily: 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginVertical: 10,
  },
  retryButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  confirmButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'white',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cancelButtonText: {
    color: 'white',
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
    color: 'white',
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
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
  },
});

export default QRScannerModal;
