import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import { Input as ODEInput } from '../components/common';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Keychain from 'react-native-keychain';
import { login, isVersionMismatchError } from '../api/synkronus/Auth';
import { serverConfigService } from '../services/ServerConfigService';
import QRScannerModal, {
  ScannerModalResults,
} from '../components/QRScannerModal';
import { QRSettingsService } from '../services/QRSettingsService';
import { MainTabParamList } from '../types/NavigationTypes';
import Icon from '@react-native-vector-icons/material-design-icons';
import { ToastService } from '../services/ToastService';
import { useAppTheme, ThemeMode } from '../contexts/AppThemeContext';
import { useConfirmModal } from '../contexts/ConfirmModalContext';
import colors, { withAlpha } from '../theme/colors';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeRadius,
} from '../theme/odeDesign';
import { serverSwitchService } from '../services/ServerSwitchService';
import { syncService } from '../services/SyncService';
import { Button } from '../components/common';
import BlurredScreenBackground from '../components/BlurredScreenBackground';
import Logo from '../../assets/images/logo.png';
import tokens from '@ode/tokens/dist/react-native/tokens-resolved';

type SettingsScreenNavigationProp = BottomTabNavigationProp<
  MainTabParamList,
  'Settings'
>;

const SettingsScreen = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { themeColors, themeMode, setThemeMode, resolvedMode } = useAppTheme();
  const { showConfirm } = useConfirmModal();
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const isDark = resolvedMode === 'dark';

  useFocusEffect(
    useCallback(() => {
      setAppSettingsOpen(false);
    }, []),
  );
  const odeOpacity = (tokens as { opacity?: Record<string, string> }).opacity;
  const themeChipBorderOpacityDark =
    odeOpacity?.['50'] != null ? Number(odeOpacity['50']) : 0.5;
  const themeChipBorderColorDark = isDark
    ? withAlpha(colors.neutral.white as string, themeChipBorderOpacityDark)
    : undefined;
  const sectionHeaderColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[800] as string);
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
    let processedUrl = serverUrl.trim();

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!processedUrl || !trimmedUsername || !trimmedPassword) {
      return;
    }

    if (!processedUrl.startsWith('https://')) {
      processedUrl = `https://${processedUrl}`;
    }

    if (processedUrl.endsWith('/')) {
      processedUrl = processedUrl.slice(0, -1);
    }

    if (isLoggingIn) {
      return;
    }

    const serverReady = await handleServerSwitchIfNeeded(processedUrl);
    if (!serverReady) {
      return;
    }

    setIsLoggingIn(true);
    try {
      // Ensure server URL is saved before login (required by getApi())
      await serverConfigService.saveServerUrl(processedUrl);

      await Keychain.setGenericPassword(trimmedUsername, trimmedPassword);
      await login(trimmedUsername, trimmedPassword);
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
            navigation.navigate('Sync');
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
          {/* Server Settings section */}
          <Text
            style={[
              styles.sectionHeader,
              styles.sectionHeaderFirst,
              { color: sectionHeaderColor },
            ]}>
            Server Settings
          </Text>
          <Text style={[styles.titleSmall, { color: themeColors.onSurface }]}>
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

          {/* App Settings section (expandable, themes) */}
          <Text
            style={[
              styles.sectionHeader,
              styles.appSettingsSectionHeader,
              { color: sectionHeaderColor },
            ]}>
            App Settings
          </Text>
          <TouchableOpacity
            style={styles.appSettingsHeader}
            activeOpacity={0.8}
            onPress={() => setAppSettingsOpen(open => !open)}>
            <View style={styles.appSettingsTitleRow}>
              <Icon name="palette" size={22} color={themeColors.onSurface} />
              <Text
                style={[
                  styles.appSettingsLabel,
                  { color: themeColors.onSurface },
                ]}>
                Themes
              </Text>
              <Icon
                name={appSettingsOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={themeColors.onSurface}
                style={styles.appSettingsChevron}
              />
            </View>
          </TouchableOpacity>
          {appSettingsOpen && (
            <View
              style={[
                styles.themesCardOuter,
                {
                  borderColor: themeColors.divider,
                  backgroundColor: themeColors.surface as string,
                },
              ]}>
              <Text
                style={[styles.themesTitle, { color: themeColors.onSurface }]}>
                Theme
              </Text>
              <View style={styles.themeOptionsColumn}>
                {(['system', 'dark', 'light'] as ThemeMode[]).map(mode => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.themeChip,
                      {
                        borderColor:
                          themeMode === mode
                            ? (themeColors.primary as string)
                            : isDark
                              ? (themeChipBorderColorDark as string)
                              : (colors.neutral[400] as string),
                      },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setThemeMode(mode)}>
                    <Text
                      style={[
                        styles.themeChipLabel,
                        {
                          color:
                            themeMode === mode
                              ? (themeColors.primary as string)
                              : isDark
                                ? (colors.neutral[200] as string)
                                : (colors.neutral[700] as string),
                        },
                      ]}>
                      {mode === 'system'
                        ? 'System'
                        : mode === 'dark'
                          ? 'Dark'
                          : 'Light'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.versionContainer}>
            <Text style={[styles.version, { color: themeColors.onSurface }]}>
              v1.0.0
            </Text>
          </View>
        </ScrollView>

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
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    fontSize: odeTypography.sectionTitle,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
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
    marginTop: odeSpacing.xl,
  },
  appSettingsSectionHeader: {
    marginTop: odeSpacing.xl,
  },
  appSettingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: odeSpacing.sm,
  },
  appSettingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: odeSpacing.sm,
  },
  appSettingsLabel: {
    fontSize: odeTypography.body,
  },
  appSettingsChevron: {
    marginLeft: odeSpacing.xxs,
  },
  themesCardOuter: {
    marginTop: odeSpacing.sm,
    borderRadius: odeRadius.card,
    borderWidth: odeBorderWidth.hairline,
    overflow: 'hidden',
    padding: odeSpacing.md,
  },
  themesTitle: {
    fontSize: odeTypography.sectionTitle,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: odeSpacing.sm,
  },
  themeOptionsColumn: {
    flexDirection: 'column',
    gap: odeSpacing.sm,
    alignItems: 'center',
  },
  themeChip: {
    paddingHorizontal: odeSpacing.lg,
    paddingVertical: odeSpacing.sm,
    borderRadius: odeRadius.inner,
    borderWidth: odeBorderWidth.hairline,
    backgroundColor: 'transparent',
    minWidth: '70%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeChipLabel: {
    fontSize: odeTypography.caption,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 1,
  },
  qrButton: {
    paddingRight: 16,
  },
  versionContainer: {
    alignItems: 'center',
    paddingTop: odeSpacing.xl,
    paddingBottom: odeSpacing.lg,
  },
});

export default SettingsScreen;
