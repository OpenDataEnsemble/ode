import React, { useState, useEffect } from 'react';
import {View,Text,TextInput,TouchableOpacity,StyleSheet,SafeAreaView,ScrollView,Alert,ActivityIndicator} from 'react-native';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login } from '../api/synkronus/Auth';
import QRScannerModal from '../components/QRScannerModal';
import { QRSettingsService } from '../services/QRSettingsService';

const SettingsScreen = () => {
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Load settings when component mounts
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await AsyncStorage.getItem('@settings');
        if (settings) {
          const { serverUrl: savedUrl } = JSON.parse(settings);
          setServerUrl(savedUrl || '');          
        }
      } catch (error) {
        console.error('Failed to load settings', error);
      } finally {
        setIsLoading(false);
      }
      const credentials = await loadCredentials();
      if (credentials) {
        setUsername(credentials.username);
        setPassword(credentials.password);
      }
    };

    loadSettings();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Username and password are required')
      return
    }
    try {
      setIsLoggingIn(true)
      await login(username, password)
      console.log('Logged in!')
    } catch (err) {
      console.error('Login failed', err)
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function resetCredentials() {
    try {
      await Keychain.resetGenericPassword();
      console.log('Credentials reset successfully.');
    } catch (error) {
      console.error('Keychain couldn\'t be accessed!', error);
    }
  }

  async function loadCredentials(): Promise<{ username: string, password: string } | null> {
    try {
      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        console.log('Credentials loaded successfully:', credentials.username, credentials.password);
        return {username: credentials.username, password: credentials.password};
      } else {
        console.log('No credentials stored.');
        return null;
      }
    } catch (error) {
      console.error('Keychain couldn\'t be accessed!', error);
      return null;
    }
  }
  async function saveCredentials(username: string, password: string) {
    try {
      await Keychain.setGenericPassword(username, password);
      console.log('Credentials saved successfully!');
    } catch (error) {
      console.error('Keychain couldn\'t be accessed!', error);
      throw new Error('Keychain couldn\'t be accessed for safe credential storage!');
    }
  }
  
  const handleSave = async () => {
    // Prevent saving if only one of username/password is provided
    if ((username && !password) || (!username && password)) {
      Alert.alert('Error', 'Both username and password are required to save credentials');
      return;
    }

    try {
      setIsSaving(true);
      
      // Save settings to AsyncStorage
      await AsyncStorage.setItem('@settings', JSON.stringify({
        serverUrl
      }));

      // Save username and password in keychain
      if (username && password) {
        await saveCredentials(username, password);
      } else {
        await resetCredentials();
      }
      
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQRScan = () => {
    setShowQRScanner(true);
  };

  const handleQRResult = async (result: any) => {
    console.log('QR scan result:', result);
    
    if (result.status === 'success' && result.data?.value) {
      try {
        const settings = await QRSettingsService.processQRCode(result.data.value);
        
        // Update the UI with the new settings
        setServerUrl(settings.serverUrl);
        setUsername(settings.username);
        setPassword(settings.password);
        
        Alert.alert('Success', 'Settings updated from QR code');
      } catch (error) {
        console.error('QR processing error:', error);
        Alert.alert('Error', `Failed to process QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else if (result.status === 'cancelled') {
      console.log('QR scan cancelled');
    } else {
      Alert.alert('Error', result.message || 'Failed to scan QR code');
    }
    
    setShowQRScanner(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.sectionHeader}>Settings</Text>
        <View style={styles.divider} />
        
        <View style={styles.section}>
          <Text style={styles.label}>Synkronus URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://example.com"
            placeholderTextColor="#999"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            keyboardType="url"
            autoCorrect={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="Your username"
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
          />
        </View>

        <TouchableOpacity 
          style={styles.qrButton}
          onPress={handleQRScan}
        >
          <Text style={styles.qrButtonText}>📱 Scan QR Code</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.button,
            isSaving && styles.buttonDisabled
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.buttonText}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.button,
            isLoggingIn && styles.buttonDisabled
          ]}
          onPress={handleLogin}
          disabled={isLoggingIn}
        >
          <Text style={styles.buttonText}>
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onResult={handleQRResult}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 16,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  qrButton: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  qrButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;