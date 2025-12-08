import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {useNavigation} from '@react-navigation/native';
import {AuthStackParamList} from '../types/NavigationTypes';
import {Button, Input} from '../components/common';
import QRScannerModal from '../components/QRScannerModal';
import {serverConfigService} from '../services/ServerConfigService';

type ServerConfigurationScreenNavigationProp =
  StackNavigationProp<AuthStackParamList>;

interface QRConfigData {
  serverUrl?: string;
  username?: string;
  password?: string;
}

const ServerConfigurationScreen: React.FC = () => {
  const navigation = useNavigation<ServerConfigurationScreenNavigationProp>();
  const [serverUrl, setServerUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [qrScannerVisible, setQrScannerVisible] = useState<boolean>(false);

  useEffect(() => {
    const loadServerUrl = async () => {
      try {
        const savedUrl = await serverConfigService.getServerUrl();
        if (savedUrl) {
          setServerUrl(savedUrl);
        }
      } catch (err) {
        console.error('Failed to load server URL:', err);
      }
    };
    loadServerUrl();
  }, []);

  const handleTestConnection = async () => {
    if (!serverUrl.trim()) {
      setError('Please enter a server URL');
      return;
    }

    setIsTesting(true);
    setError('');

    const result = await serverConfigService.testConnection(serverUrl);

    if (result.success) {
      Alert.alert('Success', result.message, [{text: 'OK'}]);
    } else {
      setError(result.message);
    }

    setIsTesting(false);
  };

  const handleSave = async () => {
    if (!serverUrl.trim()) {
      setError('Please enter a server URL');
      return;
    }

    try {
      const url = new URL(serverUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        setError('URL must be HTTP or HTTPS');
        return;
      }
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await serverConfigService.saveServerUrl(serverUrl);
      navigation.navigate('Login');
    } catch (err) {
      setError('Failed to save server URL. Please try again.');
      console.error('Failed to save server URL:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQRScan = (data: any) => {
    try {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const configData: QRConfigData = JSON.parse(dataString);
      if (configData.serverUrl) {
        setServerUrl(configData.serverUrl);
        setError('');
      }
      if (configData.serverUrl) {
        setTimeout(() => {
          handleTestConnection();
        }, 500);
      }
    } catch (err) {
      setError('Invalid QR code format');
    }
    setQrScannerVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Server Configuration</Text>
          <Text style={styles.subtitle}>
            Enter your server URL to connect to Formulus
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Server URL"
            placeholder="https://example.com"
            value={serverUrl}
            onChangeText={(text) => {
              setServerUrl(text);
              setError('');
            }}
            error={error}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            testID="server-url-input"
          />

          <View style={styles.buttonRow}>
            <Button
              title="Test Connection"
              onPress={handleTestConnection}
              variant="secondary"
              size="medium"
              loading={isTesting}
              disabled={!serverUrl.trim()}
              style={styles.testButton}
              testID="test-connection-button"
            />
            <Button
              title="Scan QR Code"
              onPress={() => setQrScannerVisible(true)}
              variant="tertiary"
              size="medium"
              style={styles.qrButton}
              testID="scan-qr-button"
            />
          </View>

          <Button
            title="Save & Continue"
            onPress={handleSave}
            variant="primary"
            size="large"
            fullWidth
            loading={isSaving}
            disabled={!serverUrl.trim() || !!error || isSaving}
            testID="save-continue-button"
          />
        </View>
      </ScrollView>

      <QRScannerModal
        visible={qrScannerVisible}
        onClose={() => setQrScannerVisible(false)}
        onResult={handleQRScan}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  testButton: {
    flex: 1,
  },
  qrButton: {
    flex: 1,
  },
});

export default ServerConfigurationScreen;

