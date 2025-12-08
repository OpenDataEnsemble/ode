import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import {useNavigation} from '@react-navigation/native';
import {AuthStackParamList} from '../types/NavigationTypes';
import {Button, Input} from '../components/common';
import QRScannerModal from '../components/QRScannerModal';
import {serverConfigService} from '../services/ServerConfigService';

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList>;

interface LoginScreenProps {
  onLogin?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({onLogin}) => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [serverUrl, setServerUrl] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    serverUrl?: string;
    username?: string;
    password?: string;
  }>({});
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

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!serverUrl.trim()) {
      newErrors.serverUrl = 'Server URL is required';
    } else {
      try {
        const url = new URL(serverUrl);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          newErrors.serverUrl = 'URL must be HTTP or HTTPS';
        }
      } catch {
        newErrors.serverUrl = 'Please enter a valid URL';
      }
    }

    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await new Promise<void>(resolve => setTimeout(() => resolve(), 1500));

      if (onLogin) {
        onLogin();
      }
    } catch (error) {
      Alert.alert(
        'Sign In Failed',
        error instanceof Error
          ? error.message
          : 'Invalid credentials. Please try again.',
        [{text: 'OK'}],
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = (data: any) => {
    try {
      const dataString = typeof data === 'string' ? data : JSON.stringify(data);
      const configData = JSON.parse(dataString);
      if (configData.serverUrl) {
        setServerUrl(configData.serverUrl);
        setErrors(prev => ({...prev, serverUrl: undefined}));
      }
      if (configData.username) {
        setUsername(configData.username);
      }
      if (configData.password) {
        setPassword(configData.password);
      }
    } catch (err) {
      Alert.alert('Error', 'Invalid QR code format');
    }
    setQrScannerVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>
            Enter your credentials to access Formulus
          </Text>

          <View style={styles.form}>
            <Input
              label="Server URL"
              placeholder="https://example.com"
              value={serverUrl}
              onChangeText={text => {
                setServerUrl(text);
                setErrors(prev => ({...prev, serverUrl: undefined}));
              }}
              error={errors.serverUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              testID="login-server-url-input"
            />

            <Input
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChangeText={text => {
                setUsername(text);
                setErrors(prev => ({...prev, username: undefined}));
              }}
              error={errors.username}
              autoCapitalize="none"
              autoCorrect={false}
              testID="login-username-input"
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={text => {
                setPassword(text);
                setErrors(prev => ({...prev, password: undefined}));
              }}
              error={errors.password}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              testID="login-password-input"
            />

            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}
              testID="login-show-password-toggle">
              <Text style={styles.passwordToggleText}>
                {showPassword ? 'Hide' : 'Show'} Password
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setRememberMe(!rememberMe)}
              testID="login-remember-me-checkbox">
              <View
                style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkboxCheckmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Remember Me</Text>
            </TouchableOpacity>

            <Button
              title="Sign In"
              onPress={handleSignIn}
              variant="primary"
              size="large"
              fullWidth
              loading={loading}
              disabled={loading}
              testID="login-sign-in-button"
            />

            <Button
              title="Scan QR Code"
              onPress={() => setQrScannerVisible(true)}
              variant="secondary"
              size="medium"
              fullWidth
              testID="login-scan-qr-button"
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => {
                Alert.alert(
                  'Forgot Password',
                  'This feature will be available soon.',
                );
              }}
              testID="login-forgot-password-link">
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  form: {
    gap: 4,
  },
  passwordToggle: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: -8,
    marginBottom: 8,
  },
  passwordToggleText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxCheckmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333333',
  },
  forgotPassword: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default LoginScreen;
