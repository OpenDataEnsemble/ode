import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import { Input as ODEInput, PasswordInput } from '../components/common';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Keychain from 'react-native-keychain';
import {
  login,
  isVersionMismatchError,
  getUserFacingSyncErrorMessage,
} from '../api/synkronus/Auth';
import {
  normalizeServerUrl,
  serverConfigService,
} from '../services/ServerConfigService';
import QRScannerModal, {
  ScannerModalResults,
} from '../components/QRScannerModal';
import { QRSettingsService } from '../services/QRSettingsService';
import { MainTabParamList } from '../types/NavigationTypes';
import Icon from '@react-native-vector-icons/material-design-icons';
import { ToastService } from '../services/ToastService';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useConfirmModal } from '../contexts/ConfirmModalContext';
import colors from '../theme/colors';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeScreenHeaderHeight,
} from '../theme/odeDesign';
import { serverSwitchService } from '../services/ServerSwitchService';
import { syncService } from '../services/SyncService';
import {
  getSettingsHydrationCredentialPair,
  getSettingsHydrationSnapshot,
  loadSettingsHydrationFromStorage,
} from '../services/SettingsHydrationCache';
import { Button } from '../components/common';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
import Logo from '../../assets/images/logo.png';
import { Moon, Monitor, Sun } from 'lucide-react-native';

const HTTP_TRANSPORT_TOAST =
  'HTTP is allowed, but we recommend HTTPS so traffic is encrypted (https://).';

type SettingsScreenNavigationProp = BottomTabNavigationProp<
  MainTabParamList,
  'Settings'
>;

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { themeColors, themeMode, setThemeMode, resolvedMode } = useAppTheme();
  const shellStyle = useScreenShellStyle();
  const { showConfirm } = useConfirmModal();
  const isDark = resolvedMode === 'dark';
  const sectionHeaderColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[800] as string);
  const initialSnap = getSettingsHydrationSnapshot();
  const initialCreds = getSettingsHydrationCredentialPair(initialSnap);
  const [serverUrl, setServerUrl] = useState(() =>
    initialSnap.ready ? (initialSnap.serverUrl ?? '') : '',
  );
  const [initialServerUrl, setInitialServerUrl] = useState(() =>
    initialSnap.ready ? (initialSnap.serverUrl ?? '') : '',
  );
  const [username, setUsername] = useState(() => initialCreds?.username ?? '');
  const [password, setPassword] = useState(() => initialCreds?.password ?? '');
  const [isHydrating, setIsHydrating] = useState(() => !initialSnap.ready);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const snap = await loadSettingsHydrationFromStorage();
        if (cancelled || !mountedRef.current) {
          return;
        }

        if (snap.ready && snap.serverUrl) {
          setInitialServerUrl(snap.serverUrl);
          setServerUrl(prev => (prev.trim() === '' ? snap.serverUrl! : prev));
        }

        const creds = getSettingsHydrationCredentialPair(snap);
        if (creds) {
          setUsername(prev => (prev.trim() === '' ? creds.username : prev));
          setPassword(prev => (prev.trim() === '' ? creds.password : prev));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        if (!cancelled && mountedRef.current) {
          setIsHydrating(false);
        }
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleServerSwitchIfNeeded = useCallback(
    async (url: string): Promise<boolean> => {
      const norm = normalizeServerUrl(url);
      if (!norm.ok) {
        ToastService.showLong(norm.message);
        return false;
      }
      const normalizedUrl = norm.href;

      const trimmedInitial = initialServerUrl.trim();
      if (!trimmedInitial) {
        // First server URL — nothing to "wipe"; avoid the switch-server dialog.
        await serverConfigService.saveServerUrl(normalizedUrl);
        setInitialServerUrl(normalizedUrl);
        setServerUrl(normalizedUrl);
        return true;
      }

      const initialNorm = normalizeServerUrl(trimmedInitial);
      const initialComparable = initialNorm.ok
        ? initialNorm.href
        : trimmedInitial.toLowerCase();

      if (normalizedUrl === initialComparable) {
        await serverConfigService.saveServerUrl(normalizedUrl);
        return true;
      }

      try {
        const [pendingObservations, pendingAttachments] = await Promise.all([
          serverSwitchService.getPendingObservationCount(),
          serverSwitchService.getPendingAttachmentCount(),
        ]);

        const performReset = async () => {
          await serverSwitchService.resetForServerChange(normalizedUrl);
          setInitialServerUrl(normalizedUrl);
          setServerUrl(normalizedUrl);
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
              `${getUserFacingSyncErrorMessage(error)}\n\nPlease retry or proceed without syncing.`,
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
                        resolve(false);
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

  const handleLogin = useCallback(async () => {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!serverUrl.trim() || !trimmedUsername || !trimmedPassword) {
      return;
    }

    if (isLoggingIn) {
      return;
    }

    const norm = normalizeServerUrl(serverUrl);
    if (!norm.ok) {
      ToastService.showLong(norm.message);
      return;
    }

    if (norm.isHttp) {
      ToastService.showLong(HTTP_TRANSPORT_TOAST);
    }

    setServerUrl(norm.href);

    const serverReady = await handleServerSwitchIfNeeded(norm.href);
    if (!serverReady) {
      return;
    }

    setIsLoggingIn(true);
    try {
      await serverConfigService.saveServerUrl(norm.href);

      await Keychain.setGenericPassword(trimmedUsername, trimmedPassword);
      await login(trimmedUsername, trimmedPassword);
      void loadSettingsHydrationFromStorage();
      ToastService.showShort('Successfully logged in!');
      navigation.navigate('Sync');
    } catch (error) {
      console.error('Login failed:', error);
      const message = isVersionMismatchError(error)
        ? error.message
        : `Login failed: ${error && 'Please check your credentials.'}`;
      ToastService.showLong(message);
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

        if (settings.serverUrl.toLowerCase().startsWith('http://')) {
          ToastService.showLong(HTTP_TRANSPORT_TOAST);
        }

        setServerUrl(settings.serverUrl);
        setUsername(settings.username);
        setPassword(settings.password);

        if (settings.username && settings.password) {
          await serverConfigService.saveServerUrl(settings.serverUrl);

          await Keychain.setGenericPassword(
            settings.username,
            settings.password,
          );
          try {
            await login(settings.username, settings.password);
            void loadSettingsHydrationFromStorage();
            ToastService.showShort('Successfully logged in!');
            navigation.navigate('Sync');
          } catch (error) {
            console.error('Auto-login failed:', error);
            const errorMessage =
              error && 'Failed to login. Please check your credentials.';
            ToastService.showLong(`Login failed: ${errorMessage}`);
          }
        } else {
          void loadSettingsHydrationFromStorage();
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
    return isHydrating || isFieldsEmpty || isLoggingIn;
  }, [serverUrl, username, password, isHydrating, isLoggingIn]);

  return (
    <View style={shellStyle}>
      <SafeAreaView
        style={[styles.container, { backgroundColor: 'transparent' }]}
        edges={['top']}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: themeColors.primary as string,
              borderBottomColor: themeColors.divider as string,
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
              Settings
            </Text>
          </View>
        </View>

        <ScrollView
          style={[styles.card, { backgroundColor: 'transparent' }]}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <Text
            style={[
              styles.sectionHeader,
              styles.sectionHeaderFirst,
              { color: sectionHeaderColor },
            ]}>
            App Settings
          </Text>
          <Text style={[styles.titleSmall, { color: themeColors.onSurface }]}>
            Please enter the details for your synkronus server
          </Text>

          <View style={styles.inputContainer}>
            <ODEInput
              placeholder="Server URL"
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
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
            autoCapitalize="none"
            autoCorrect={false}
          />

          <PasswordInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            showLabel={false}
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

          <View
            style={{
              height: odeBorderWidth.hairline,
              backgroundColor: themeColors.divider as string,
              marginVertical: odeSpacing.md,
            }}
          />

          <View style={styles.themesInlineRow}>
            <View style={styles.themesInlineLeft}>
              <Icon name="palette" size={22} color={themeColors.onSurface} />
              <Text
                style={[
                  styles.appSettingsLabel,
                  { color: themeColors.onSurface },
                ]}>
                Theme:
              </Text>
            </View>

            <View style={styles.themesInlineIcons}>
              <TouchableOpacity
                style={styles.themeIconButton}
                onPress={() => setThemeMode('system')}
                accessibilityRole="button"
                accessibilityLabel="Theme: System">
                <Monitor
                  size={22}
                  color={
                    themeMode === 'system'
                      ? (themeColors.primary as string)
                      : (themeColors.onSurface as string)
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.themeIconButton}
                onPress={() => setThemeMode('light')}
                accessibilityRole="button"
                accessibilityLabel="Theme: Light">
                <Sun
                  size={22}
                  color={
                    themeMode === 'light'
                      ? (themeColors.primary as string)
                      : (themeColors.onSurface as string)
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.themeIconButton}
                onPress={() => setThemeMode('dark')}
                accessibilityRole="button"
                accessibilityLabel="Theme: Dark">
                <Moon
                  size={22}
                  color={
                    themeMode === 'dark'
                      ? (themeColors.primary as string)
                      : (themeColors.onSurface as string)
                  }
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.versionContainer}>
            <Text style={[styles.version, { color: themeColors.onSurface }]}>
              v1.0.0
            </Text>
            <Text
              style={[
                styles.versionCodename,
                { color: themeColors.onSurface },
              ]}>
              Young Ossicone
            </Text>
          </View>
        </ScrollView>

        <QRScannerModal
          visible={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onResult={handleQRResult}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'flex-start',
    width: '100%',
    padding: odeSpacing.md,
    minHeight: odeScreenHeaderHeight,
    borderBottomWidth: odeBorderWidth.hairline,
    borderRadius: 0,
    overflow: 'hidden',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
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
    fontSize: odeTypography.screenTitle,
    fontWeight: 'bold',
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
    paddingHorizontal: odeSpacing.md,
    paddingTop: odeSpacing.md,
    paddingBottom: 40,
  },
  titleSmall: {
    fontSize: odeTypography.bodySm,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'left',
  },
  sectionHeader: {
    fontSize: odeTypography.body,
    fontWeight: '600',
    marginBottom: odeSpacing.sm,
  },
  sectionHeaderFirst: {
    // cardContent.paddingTop already gives header-to-content gap; keep section gap consistent.
    marginTop: 0,
  },
  appSettingsSectionHeader: {
    marginTop: odeSpacing.md,
  },
  appSettingsLabel: {
    fontSize: odeTypography.body,
  },
  themesInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: odeSpacing.sm,
    paddingVertical: odeSpacing.sm,
  },
  themesInlineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.xs,
  },
  themesInlineIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.sm,
  },
  themeIconButton: {
    padding: odeSpacing.xs,
  },
  inputContainer: {
    marginBottom: 1,
  },
  qrButton: {
    paddingRight: 16,
  },
  versionContainer: {
    alignItems: 'center',
    paddingTop: odeSpacing.md,
    paddingBottom: odeSpacing.lg,
  },
  versionCodename: {
    fontSize: 12,
    marginTop: odeSpacing.xxs,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default SettingsScreen;
