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
import { appVersionService } from '../services/AppVersionService';
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
import {
  classifyServerChange,
  resolvePreviousServerUrl,
} from '../services/ServerSwitchDecision';
import { syncService } from '../services/SyncService';
import {
  getSettingsHydrationCredentialPair,
  getSettingsHydrationSnapshot,
  loadSettingsHydrationFromStorage,
} from '../services/SettingsHydrationCache';
import { Button, LocalePicker } from '../components/common';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
import Logo from '../../assets/images/logo.png';
import { Moon, Monitor, Sun, Languages } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { localeSettingsService } from '../services/LocaleSettingsService';
import { type UiLocalePreference } from '../lib/locale';
import { syncFormulusI18nLanguage } from '../i18n';

type SettingsScreenNavigationProp = BottomTabNavigationProp<
  MainTabParamList,
  'Settings'
>;

const SettingsScreen = () => {
  const { t } = useTranslation();
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
  const [version, setVersion] = useState('');
  const [uiLocalePreference, setUiLocalePreference] =
    useState<UiLocalePreference>('auto');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setVersion(await appVersionService.getFullVersion());
      } catch {
        setVersion('');
      }
    };
    load();
  }, []);

  useEffect(() => {
    void localeSettingsService.load().then(() => {
      if (mountedRef.current) {
        setUiLocalePreference(localeSettingsService.getPreference());
      }
    });
  }, []);

  const handleLocalePreference = useCallback(
    async (preference: UiLocalePreference) => {
      setUiLocalePreference(preference);
      await localeSettingsService.setPreference(preference);
      await syncFormulusI18nLanguage();
    },
    [],
  );

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
      // Authoritative source of truth for "what server were we connected to?"
      // Component state (`initialServerUrl`) can be empty during hydration or
      // when the screen is entered directly from the Welcome flow (PR #601),
      // which previously caused the wipe warning to be silently skipped.
      const trimmedInitial = await resolvePreviousServerUrl(
        initialServerUrl,
        () => serverConfigService.getServerUrl(),
      );

      const decision = classifyServerChange(url, trimmedInitial);
      if (decision.kind === 'invalid') {
        ToastService.showLong(decision.message);
        return false;
      }
      const normalizedUrl = decision.normalizedUrl;

      if (decision.kind === 'first-time') {
        // First server URL — nothing to "wipe"; avoid the switch-server dialog.
        await serverConfigService.saveServerUrl(normalizedUrl);
        setInitialServerUrl(normalizedUrl);
        setServerUrl(normalizedUrl);
        return true;
      }

      if (decision.kind === 'same') {
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
          ToastService.showShort(t('settings.switchedServerCleared'));
        };

        const syncThenReset = async () => {
          try {
            await syncService.syncObservations(true);
            await performReset();
            return true;
          } catch (error) {
            console.error('Sync before server switch failed:', error);
            ToastService.showLong(
              t('settings.syncBeforeSwitchFailed', {
                error: getUserFacingSyncErrorMessage(error),
              }),
            );
            return false;
          }
        };

        return await new Promise<boolean>(resolve => {
          const hasPending = pendingObservations > 0 || pendingAttachments > 0;
          const message = hasPending
            ? t('settings.switchServerPendingMessage', {
                observations: pendingObservations,
                attachments: pendingAttachments,
              })
            : t('settings.switchServerWipeMessage');

          const buttons = hasPending
            ? [
                {
                  text: t('common.cancel'),
                  variant: 'tertiary' as const,
                  onPress: () => {
                    setServerUrl(trimmedInitial);
                    resolve(false);
                  },
                },
                {
                  text: t('settings.proceedWithoutSync'),
                  variant: 'danger' as const,
                  onPress: () => {
                    (async () => {
                      try {
                        await performReset();
                        resolve(true);
                      } catch (error) {
                        console.error('Failed to switch server:', error);
                        ToastService.showLong(t('settings.switchServerFailed'));
                        resolve(false);
                      }
                    })();
                  },
                },
                {
                  text: t('settings.syncThenSwitch'),
                  variant: 'primary' as const,
                  onPress: () => {
                    (async () => {
                      if (syncService.getIsSyncing()) {
                        ToastService.showShort(t('settings.syncInProgress'));
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
                  text: t('common.cancel'),
                  variant: 'tertiary' as const,
                  onPress: () => {
                    setServerUrl(trimmedInitial);
                    resolve(false);
                  },
                },
                {
                  text: t('settings.yesWipeAndSwitch'),
                  variant: 'danger' as const,
                  onPress: () => {
                    (async () => {
                      try {
                        await performReset();
                        resolve(true);
                      } catch (error) {
                        console.error('Failed to switch server:', error);
                        ToastService.showLong(t('settings.switchServerFailed'));
                        resolve(false);
                      }
                    })();
                  },
                },
              ];

          showConfirm({
            title: t('settings.switchServerTitle'),
            message,
            buttons,
          });
        });
      } catch (error) {
        console.error('Failed to prepare server switch:', error);
        ToastService.showLong(t('settings.checkPendingFailed'));
        return false;
      }
    },
    [initialServerUrl, showConfirm, t],
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
      ToastService.showLong(t('settings.httpTransportWarning'));
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
      ToastService.showShort(t('settings.loginSuccess'));
      navigation.navigate('Sync');
    } catch (error) {
      console.error('Login failed:', error);
      const message = isVersionMismatchError(error)
        ? error.message
        : t('settings.loginFailed', {
            message: t('settings.loginFailedCredentials'),
          });
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
    t,
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
            ToastService.showShort(t('settings.loginSuccess'));
            navigation.navigate('Sync');
          } catch (error) {
            console.error('Auto-login failed:', error);
            ToastService.showLong(
              t('settings.loginFailed', {
                message: t('settings.loginFailedCredentials'),
              }),
            );
          }
        } else {
          void loadSettingsHydrationFromStorage();
          ToastService.showShort(t('settings.updated'));
        }
      } catch (error) {
        console.error('Failed to process QR code:', error);
        ToastService.showLong(
          t('settings.qrError', { message: t('settings.qrInvalid') }),
        );
      }
    } else {
      ToastService.showLong(t('settings.qrScanFailed'));
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
        style={[
          styles.container,
          { backgroundColor: colors.neutral.transparent },
        ]}
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
              {t('settings.title')}
            </Text>
          </View>
        </View>

        <ScrollView
          style={[styles.card, { backgroundColor: colors.neutral.transparent }]}
          contentContainerStyle={styles.cardContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <Text
            style={[
              styles.sectionHeader,
              styles.sectionHeaderFirst,
              { color: sectionHeaderColor },
            ]}>
            {t('settings.appSettings')}
          </Text>
          <Text style={[styles.titleSmall, { color: themeColors.onSurface }]}>
            {t('settings.subtitle')}
          </Text>

          <View style={styles.inputContainer}>
            <ODEInput
              placeholder={t('settings.serverUrl')}
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              rightAccessory={
                <TouchableOpacity
                  style={styles.qrButton}
                  onPress={() => setShowQRScanner(true)}
                  accessibilityLabel={t('settings.scanQr')}>
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
            placeholder={t('settings.username')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <PasswordInput
            placeholder={t('settings.password')}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            showLabel={false}
          />

          <Button
            title={isLoggingIn ? t('settings.loggingIn') : t('settings.login')}
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
                {t('settings.theme.label')}
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

          <View style={styles.themesInlineRow}>
            <View style={styles.themesInlineLeft}>
              <Languages size={22} color={themeColors.onSurface as string} />
              <Text
                style={[
                  styles.appSettingsLabel,
                  { color: themeColors.onSurface },
                ]}>
                {t('settings.language.label')}
              </Text>
            </View>
            <View style={styles.languagePickerWrap}>
              <LocalePicker
                value={uiLocalePreference}
                onChange={pref => void handleLocalePreference(pref)}
              />
            </View>
          </View>

          <View style={styles.versionContainer}>
            {!!version && (
              <Text style={[styles.version, { color: themeColors.onSurface }]}>
                v{version}
              </Text>
            )}
            {!!version && (
              <Text
                style={[
                  styles.versionCodename,
                  { color: themeColors.onSurface },
                ]}>
                Young Ossicone
              </Text>
            )}
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
    backgroundColor: colors.neutral.transparent,
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: colors.neutral.transparent,
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
  languageOptionsRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: odeSpacing.xs,
    justifyContent: 'flex-end',
  },
  languageChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: odeSpacing.sm,
    paddingVertical: odeSpacing.xxs,
  },
  languageChipText: {
    fontSize: odeTypography.bodySm,
  },
  languagePickerWrap: {
    flex: 1,
    alignItems: 'flex-end',
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
