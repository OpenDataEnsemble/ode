import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import * as Keychain from 'react-native-keychain';
import {login, getUserInfo, logout, UserInfo} from '../api/synkronus/Auth';
import {serverConfigService} from '../services/ServerConfigService';
import QRScannerModal from '../components/QRScannerModal';
import {QRSettingsService} from '../services/QRSettingsService';
import {MainAppStackParamList} from '../types/NavigationTypes';
import {PasswordInput} from '../components/common';

type SettingsScreenNavigationProp = StackNavigationProp<
  MainAppStackParamList,
  'Settings'
>;

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedUrl = await serverConfigService.getServerUrl();
      if (savedUrl) {
        setServerUrl(savedUrl);
      }

      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        setUsername(credentials.username);
        setPassword(credentials.password);
      }

      // Check if user is logged in
      const userInfo = await getUserInfo();
      setLoggedInUser(userInfo);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('Error', 'Please enter a server URL');
      return;
    }

    setIsTesting(true);
    try {
      const result = await serverConfigService.testConnection(serverUrl);
      Alert.alert(result.success ? 'Success' : 'Error', result.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if ((username && !password) || (!username && password)) {
      Alert.alert('Error', 'Both username and password are required');
      return;
    }

    setIsSaving(true);
    try {
      await serverConfigService.saveServerUrl(serverUrl);

      if (username && password) {
        await Keychain.setGenericPassword(username, password);
      } else {
        await Keychain.resetGenericPassword();
      }

      Alert.alert('Success', 'Settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogin = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('Error', 'Server URL is required');
      return;
    }
    if (!username || !password) {
      Alert.alert('Error', 'Username and password are required');
      return;
    }

    setIsLoggingIn(true);
    try {
      // Save settings before login
      await serverConfigService.saveServerUrl(serverUrl);
      await Keychain.setGenericPassword(username, password);

      const userInfo = await login(username, password);
      setLoggedInUser(userInfo);
      Alert.alert(
        'Success',
        `Logged in as ${userInfo.username} (${userInfo.role})\nYou can now sync your app and data.`,
        [{text: 'OK', onPress: () => navigation.navigate('MainApp')}],
      );
    } catch (error: any) {
      console.error('Login failed:', error);
      const message =
        error?.response?.data?.message || error?.message || 'Login failed';
      Alert.alert('Login Failed', message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          setLoggedInUser(null);
          Alert.alert('Success', 'Logged out successfully');
        },
      },
    ]);
  };

  const handleQRResult = async (result: any) => {
    setShowQRScanner(false);

    if (result.status === 'success' && result.data?.value) {
      try {
        const settings = await QRSettingsService.processQRCode(
          result.data.value,
        );
        setServerUrl(settings.serverUrl);
        setUsername(settings.username);
        setPassword(settings.password);

        // Auto-login after QR scan
        try {
          const userInfo = await login(settings.username, settings.password);
          setLoggedInUser(userInfo);
          Alert.alert(
            'Success',
            'Settings updated and logged in successfully',
            [{text: 'OK', onPress: () => navigation.navigate('MainApp')}],
          );
        } catch (error: any) {
          Alert.alert(
            'Settings Updated',
            'QR code processed. Login failed - please check credentials.',
          );
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to process QR code');
      }
    } else if (result.status !== 'cancelled') {
      Alert.alert('Error', result.message || 'Failed to scan QR code');
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'admin':
        return styles.roleBadgeAdmin;
      case 'read-write':
        return styles.roleBadgeReadWrite;
      default:
        return styles.roleBadgeReadOnly;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Login Status Card */}
        {loggedInUser && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusTitle}>Logged In</Text>
              <View
                style={[
                  styles.roleBadge,
                  getRoleBadgeStyle(loggedInUser.role),
                ]}>
                <Text style={styles.roleBadgeText}>{loggedInUser.role}</Text>
              </View>
            </View>
            <Text style={styles.statusUsername}>{loggedInUser.username}</Text>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Synkronus Server URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://your-server.com"
            placeholderTextColor="#999"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            keyboardType="url"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.secondaryButton, isTesting && styles.disabled]}
            onPress={handleTestConnection}
            disabled={isTesting}>
            <Text style={styles.secondaryButtonText}>
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

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
          <PasswordInput
            label="Password"
            placeholder="••••••••"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => setShowQRScanner(true)}>
          <Text style={styles.buttonText}>📱 Scan QR Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, isSaving && styles.disabled]}
          onPress={handleSave}
          disabled={isSaving}>
          <Text style={styles.buttonText}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, isLoggingIn && styles.disabled]}
          onPress={handleLogin}
          disabled={isLoggingIn}>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  statusUsername: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeAdmin: {
    backgroundColor: '#FF3B30',
  },
  roleBadgeReadWrite: {
    backgroundColor: '#007AFF',
  },
  roleBadgeReadOnly: {
    backgroundColor: '#8E8E93',
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    alignSelf: 'flex-start',
  },
  logoutButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 16,
  },
  button: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButton: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButton: {
    height: 40,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  qrButton: {
    height: 50,
    borderRadius: 8,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default SettingsScreen;
