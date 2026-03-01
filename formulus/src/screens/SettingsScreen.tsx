import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { Input as ODEInput } from '../components/common';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Keychain from 'react-native-keychain';
import { login } from '../api/synkronus/Auth';
import { serverConfigService } from '../services/ServerConfigService';
import QRScannerModal, {
  ScannerModalResults,
} from '../components/QRScannerModal';
import { QRSettingsService } from '../services/QRSettingsService';
import { MainTabParamList } from '../types/NavigationTypes';
import Icon from '@react-native-vector-icons/material-design-icons';
import { ToastService } from '../services/ToastService';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useConfirmModal } from '../contexts/ConfirmModalContext';
import { serverSwitchService } from '../services/ServerSwitchService';
import { syncService } from '../services/SyncService';
import { Button } from '../components/common';
import BlurredScreenBackground from '../components/BlurredScreenBackground';
import Logo from '../../assets/images/logo.png';

type SettingsScreenNavigationProp = BottomTabNavigationProp<
  MainTabParamList,
  'Settings'
>;

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { themeColors } = useAppTheme();
  const { showConfirm } = useConfirmModal();
  const [serverUrl, setServerUrl] = useState('');
  const [initialServerUrl, setInitialServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadSettings();
    });
  }, []);

  const handleServerSwitchIfNeeded = useCallback(
    async (url: string): Promise<boolean> => {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        ToastService.showLong('Please enter a server URL');
        return false;
      }

      // If unchanged, just ensure it's saved
      if (trimmedUrl === initialServerUrl) {
        await serverConfigService.saveServerUrl(trimmedUrl);
        return true;
      }

      try {
        const [pendingObservations, pendingAttachments] = await Promise.all([
          serverSwitchService.getPendingObservationCount(),
          serverSwitchService.getPendingAttachmentCount(),
        ]);

        const performReset = async () => {
          await serverSwitchService.resetForServerChange(trimmedUrl);
          setInitialServerUrl(trimmedUrl);
          setServerUrl(trimmedUrl);
          ToastService.showShort('Switched server and cleared local data.');
        };

        const syncThenReset = async () => {
          try {
            await syncService.syncObservations(true);
            await performReset();
            return true;
          } catch (error) {
            console.error('Sync before server switch failed:', error);
            ToastService.showLong(
              'Sync failed. Please retry or proceed without syncing.',
            );
            return false;
          }
        };

        return await new Promise<boolean>(resolve => {
          const hasPending = pendingObservations > 0 || pendingAttachments > 0;
          const message = hasPending
            ? `Unsynced observations: ${pendingObservations}\nUnsynced attachments: ${pendingAttachments}\n\nSync is recommended before switching.`
            : 'Switching servers will wipe all local data for the previous server.';

          const buttons = hasPending
            ? [
                {
                  text: 'Cancel',
                  variant: 'tertiary' as const,
                  onPress: () => {
                    setServerUrl(initialServerUrl);
                    resolve(false);
                  },
                },
                {
                  text: 'Proceed without syncing',
                  variant: 'danger' as const,
                  onPress: () => {
                    (async () => {
                      try {
                        await performReset();
                        resolve(true);
                      } catch (error) {
                        console.error('Failed to switch server:', error);
                        ToastService.showLong(
                          'Failed to switch server. Please try again.',
                        );
                        resolve(false);
                      }
                    })();
                  },
                },
                {
                  text: 'Sync then switch',
                  variant: 'primary' as const,
                  onPress: () => {
                    (async () => {
                      if (syncService.getIsSyncing()) {
                        ToastService.showShort('Sync already in progress...');
                        return;
                      }
                      const ok = await syncThenReset();
                      resolve(ok);
                    })();
                  },
                },
              ]
            : [
                {
                  text: 'Cancel',
                  variant: 'tertiary' as const,
                  onPress: () => {
                    setServerUrl(initialServerUrl);
                    resolve(false);
                  },
                },
                {
                  text: 'Yes, wipe & switch',
                  variant: 'danger' as const,
                  onPress: () => {
                    (async () => {
                      try {
                        await performReset();
                        resolve(true);
                      } catch (error) {
                        console.error('Failed to switch server:', error);
                        ToastService.showLong(
                          'Failed to switch server. Please try again.',
                        );
                        resolve(false);
                      }
                    })();
                  },
                },
              ];

          showConfirm({
            title: 'Switch server?',
            message,
            buttons,
          });
        });
      } catch (error) {
        console.error('Failed to prepare server switch:', error);
        ToastService.showLong('Unable to check pending data. Try again.');
        return false;
      }
    },
    [initialServerUrl],
  );

  const loadSettings = async () => {
    try {
      const savedUrl = await serverConfigService.getServerUrl();
      if (savedUrl) {
        setServerUrl(savedUrl);
        setInitialServerUrl(savedUrl);
      }

      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        setUsername(credentials.username);
        setPassword(credentials.password);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = useCallback(async () => {
    const trimmedUrl = serverUrl.trim();
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUrl || !trimmedUsername || !trimmedPassword) {
      return;
    }

    if (isLoggingIn) {
      return;
    }

    const serverReady = await handleServerSwitchIfNeeded(trimmedUrl);
    if (!serverReady) {
      return;
    }

    setIsLoggingIn(true);
    try {
      // Ensure server URL is saved before login (required by getApi())
      await serverConfigService.saveServerUrl(trimmedUrl);

      await Keychain.setGenericPassword(trimmedUsername, trimmedPassword);
      await login(trimmedUsername, trimmedPassword);
      ToastService.showShort('Successfully logged in!');
      navigation.navigate('Home');
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage =
        error && 'Failed to login. Please check your credentials.';
      ToastService.showLong(`Login failed: ${errorMessage}`);
    } finally {
      setIsLoggingIn(false);
    }
  }, [
    serverUrl,
    username,
    password,
    isLoggingIn,
    handleServerSwitchIfNeeded,
    navigation,
  ]);

  const handleQRResult = async (result: ScannerModalResults) => {
    setShowQRScanner(false);

    if (result.status === 'cancelled') {
      return;
    }

    if (result.status === 'success' && result.data?.value) {
      try {
        const settings = await QRSettingsService.processQRCode(
          result.data.value,
        );

        const serverReady = await handleServerSwitchIfNeeded(
          settings.serverUrl,
        );
        if (!serverReady) {
          return;
        }

        setServerUrl(settings.serverUrl);
        setUsername(settings.username);
        setPassword(settings.password);

        if (settings.username && settings.password) {
          // Ensure server URL is saved before login (required by getApi())
          await serverConfigService.saveServerUrl(settings.serverUrl);

          await Keychain.setGenericPassword(
            settings.username,
            settings.password,
          );
          try {
            await login(settings.username, settings.password);
            ToastService.showShort('Successfully logged in!');
            navigation.navigate('Home');
          } catch (error) {
            console.error('Auto-login failed:', error);
            const errorMessage =
              error && 'Failed to login. Please check your credentials.';
            ToastService.showLong(`Login failed: ${errorMessage}`);
          }
        } else {
          ToastService.showShort('Settings updated successfully');
        }
      } catch (error) {
        console.error('Failed to process QR code:', error);
        const errorMessage =
          error && 'Invalid QR code format. Please try again.';
        ToastService.showLong(`QR code error: ${errorMessage}`);
      }
    } else {
      ToastService.showLong('Failed to scan QR code. Please try again.');
    }
  };

  const isButtonDisabled = useMemo(() => {
    const isFieldsEmpty =
      !serverUrl.trim() || !username.trim() || !password.trim();
    return isFieldsEmpty || isLoggingIn;
  }, [serverUrl, username, password, isLoggingIn]);

  if (isLoading) {
    return (
      <BlurredScreenBackground>
        <View
          style={[
            styles.container,
            styles.centered,
            { backgroundColor: 'transparent' },
          ]}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      </BlurredScreenBackground>
    );
  }

  return (
    <BlurredScreenBackground>
      <SafeAreaView
        style={[styles.container, { backgroundColor: 'transparent' }]}
        edges={['top']}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: themeColors.primary as string,
            },
          ]}>
          <View style={styles.logoContainer}>
            <View
              style={[
                styles.logoWrapper,
                { borderColor: themeColors.onPrimary as string },
              ]}>
              <Image source={Logo} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={[styles.brandName, { color: themeColors.onPrimary }]}>
              ODE
            </Text>
          </View>
        </View>

        <ScrollView
          style={[styles.card, { backgroundColor: 'transparent' }]}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <Text style={[styles.title, { color: themeColors.onSurface }]}>
            Please enter the server you want to connect to.
          </Text>

          <View style={styles.inputContainer}>
            <ODEInput
              placeholder="Server URL"
              value={serverUrl}
              onChangeText={setServerUrl}
              rightAccessory={
                <TouchableOpacity
                  style={styles.qrButton}
                  onPress={() => setShowQRScanner(true)}
                  accessibilityLabel="Scan QR code">
                  <Icon
                    name="qrcode-scan"
                    size={24}
                    color={themeColors.primary}
                  />
                </TouchableOpacity>
              }
            />
          </View>

          <ODEInput
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
          />

          <ODEInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            title={isLoggingIn ? 'Logging in...' : 'Login'}
            onPress={handleLogin}
            variant="primary"
            size="large"
            loading={isLoggingIn}
            disabled={isButtonDisabled}
            fullWidth
          />
        </ScrollView>

        <View style={styles.versionContainer}>
          <Text style={[styles.version, { color: themeColors.onSurface }]}>
            v1.0.0
          </Text>
        </View>

        <QRScannerModal
          visible={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onResult={handleQRResult}
        />
      </SafeAreaView>
    </BlurredScreenBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
  },
  brandName: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1,
  },
  version: {
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    flex: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  cardContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 1,
  },
  qrButton: {
    paddingRight: 16,
  },
  versionContainer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
});

export default SettingsScreen;
