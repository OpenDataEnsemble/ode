import React, {useState, useRef} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Signature, {SignatureViewRef} from 'react-native-signature-canvas';

interface SignatureCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onSignatureCapture: (result: any) => void;
  fieldId: string;
}

const SignatureCaptureModal: React.FC<SignatureCaptureModalProps> = ({
  visible,
  onClose,
  onSignatureCapture,
  fieldId,
}) => {
  const [_isCapturing, setIsCapturing] = useState(false);
  const signatureRef = useRef<SignatureViewRef>(null);
  const {width, height} = Dimensions.get('window');

  const handleSignatureEnd = () => {
    setIsCapturing(false);
  };

  const handleSignatureBegin = () => {
    setIsCapturing(true);
  };

  const handleSaveSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    }
  };

  const handleSignatureResult = (signature: string) => {
    if (signature) {
      // Generate GUID for signature
      const generateGUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
          /[xy]/g,
          function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          },
        );
      };

      const signatureGuid = generateGUID();
      const filename = `${signatureGuid}.png`;

      // Extract base64 data from data URL
      const base64Data = signature.split(',')[1];

      const signatureResult = {
        fieldId,
        status: 'success',
        data: {
          type: 'signature',
          filename,
          base64: base64Data,
          url: signature,
          timestamp: new Date().toISOString(),
          metadata: {
            width: Math.round(width * 0.9),
            height: Math.round(height * 0.4),
            size: Math.round(base64Data.length * 0.75), // Approximate size
            strokeCount: 1, // Simplified for this implementation
          },
        },
      };

      onSignatureCapture(signatureResult);
      onClose();
    } else {
      Alert.alert('Error', 'No signature data captured. Please try again.');
    }
  };

  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const handleCancel = () => {
    const cancelResult = {
      fieldId,
      status: 'cancelled',
      message: 'User cancelled signature capture',
    };
    onSignatureCapture(cancelResult);
    onClose();
  };

  const signatureStyle = `
    .m-signature-pad {
      box-shadow: none;
      border: none;
      background-color: white;
    }
    .m-signature-pad--body {
      border: 2px dashed #ccc;
      border-radius: 8px;
      background-color: white;
    }
    .m-signature-pad--footer {
      display: none;
    }
    body, html {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Capture Signature</Text>
          <Text style={styles.subtitle}>
            Draw your signature in the area below
          </Text>
        </View>

        <View style={styles.signatureContainer}>
          <Signature
            ref={signatureRef}
            onEnd={handleSignatureEnd}
            onBegin={handleSignatureBegin}
            onOK={handleSignatureResult}
            onEmpty={() =>
              Alert.alert('Error', 'Please provide a signature before saving.')
            }
            descriptionText=""
            clearText="Clear"
            confirmText="Save"
            webStyle={signatureStyle}
            autoClear={false}
            imageType="image/png"
            style={styles.signature}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClearSignature}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSaveSignature}>
            <Text style={styles.saveButtonText}>Save Signature</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  signatureContainer: {
    flex: 1,
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  signature: {
    flex: 1,
    borderRadius: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    justifyContent: 'space-around',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  clearButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SignatureCaptureModal;
