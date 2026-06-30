import React, { useState, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Signature, { SignatureViewRef } from 'react-native-signature-canvas';
import { colors } from '../theme/colors';
import Button from './common/Button';
import { useTranslation } from 'react-i18next';

interface SignatureCaptureModalProps {
  visible: boolean;
  onClose: () => void;
  onSignatureCapture: (result: unknown) => void;
  fieldId: string;
}

const SignatureCaptureModal: React.FC<SignatureCaptureModalProps> = ({
  visible,
  onClose,
  onSignatureCapture,
  fieldId,
}) => {
  const { t } = useTranslation();
  const [_isCapturing, setIsCapturing] = useState(false);
  const signatureRef = useRef<SignatureViewRef>(null);
  const { width, height } = Dimensions.get('window');

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
            const r = Math.floor(Math.random() * 16);
            const v = c === 'x' ? r : (r % 4) + 8;
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
      Alert.alert(t('common.error'), t('signature.noData'));
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
      background-color: ${colors.neutral.white};
    }
    .m-signature-pad--body {
      border: 2px dashed ${colors.ui.gray.medium};
      border-radius: 8px;
      background-color: ${colors.neutral.white};
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
              Alert.alert(t('common.error'), t('signature.required'))
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
          <Button
            title="Clear"
            onPress={handleClearSignature}
            variant="tertiary"
            size="medium"
          />
          <Button
            title="Cancel"
            onPress={handleCancel}
            variant="secondary"
            size="medium"
          />
          <Button
            title="Save Signature"
            onPress={handleSaveSignature}
            variant="primary"
            size="medium"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  header: {
    padding: 20,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[300],
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.neutral[800],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  signatureContainer: {
    flex: 1,
    margin: 20,
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    elevation: 3,
    shadowColor: colors.neutral.black,
    shadowOffset: { width: 0, height: 2 },
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
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[300],
    justifyContent: 'space-around',
    gap: 12,
  },
});

export default SignatureCaptureModal;
