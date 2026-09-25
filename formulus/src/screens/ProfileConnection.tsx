import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Icon from '@react-native-vector-icons/material-design-icons';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../components/common';
import QRScannerModal, {
  ScannerModalResults,
} from '../components/QRScannerModal';
import { useAppTheme } from '../contexts/AppThemeContext';
import { withAlpha } from '../theme/colors';
import { useConfirmModal } from '../contexts/ConfirmModalContext';
import type { MainTabParamList } from '../navigation/ProfileNavigationTypes';
import { profileRegistry } from '../profiles/ProfileRegistry';
import { getActiveProfile } from '../profiles/ProfileRuntime';
import {
  login,
  isRateLimitedError,
  isVersionMismatchError,
} from '../api/synkronus/Auth';
import {
  normalizeServerUrl,
  serverConfigService,
} from '../services/ServerConfigService';
import {
  QRSettingsService,
  SettingsUpdate,
} from '../services/QRSettingsService';
import {
  getSettingsHydrationCredentialPair,
  loadSettingsHydrationFromStorage,
} from '../services/SettingsHydrationCache';
import { ToastService } from '../services/ToastService';
import { odeSpacing, odeTypography } from '../theme/odeDesign';
import type { RunProfileAction } from './ProfilesScreen';
import { ProfileUIError } from './profileUiErrors';

type Props = {
  profile: ReturnType<typeof getActiveProfile>;
  busy: boolean;
  runAction: RunProfileAction;
  creation?: {
    name: string;
    initialSettings?: SettingsUpdate;
    onCreate: (connection: {
      serverUrl: string;
      username: string;
      password: string;
    }) => Promise<void>;
  };
  onNewProfileFromQR?: (settings: SettingsUpdate) => void;
};

const ProfileConnection = ({
  profile,
  busy,
  runAction,
  creation,
  onNewProfileFromQR,
}: Props) => {
  const { t } = useTranslation();
  const { themeColors } = useAppTheme();
  const { showConfirm } = useConfirmModal();
  const navigation =
    useNavigation<BottomTabNavigationProp<MainTabParamList, 'Profiles'>>();
  const isCreating = !!creation;
  const initialServerUrl = creation?.initialSettings?.serverUrl;
  const initialUsername = creation?.initialSettings?.username;
  const initialPassword = creation?.initialSettings?.password;
  const [serverUrl, setServerUrl] = useState(
    isCreating ? initialServerUrl || '' : profile.serverUrl || '',
  );
  const [username, setUsername] = useState(
    isCreating ? initialUsername || '' : profile.username || '',
  );
  const [password, setPassword] = useState(initialPassword || '');
  const [showPassword, setShowPassword] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const focusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      focusedRef.current = true;
      setShowPassword(false);
      if (isCreating) {
        setServerUrl(initialServerUrl || '');
        setUsername(initialUsername || '');
        setPassword(initialPassword || '');
        setHydrating(false);
        return () => {
          focusedRef.current = false;
          setShowScanner(false);
          setPassword('');
        };
      }
      setHydrating(true);
      setPassword('');
      const active = getActiveProfile();
      setServerUrl(active.serverUrl || '');
      setUsername(active.username || '');
      void loadSettingsHydrationFromStorage()
        .then(snapshot => {
          if (cancelled || getActiveProfile().id !== profile.id) return;
          const credentials = getSettingsHydrationCredentialPair(snapshot);
          if (credentials) {
            setUsername(credentials.username);
            setPassword(credentials.password);
          }
        })
        .catch(() => {
          if (!cancelled) ToastService.showLong(t('profiles.hydrationFailed'));
        })
        .finally(() => {
          if (!cancelled) setHydrating(false);
        });
      return () => {
        cancelled = true;
        focusedRef.current = false;
        setShowScanner(false);
        setPassword('');
      };
    }, [
      profile.id,
      isCreating,
      initialServerUrl,
      initialUsername,
      initialPassword,
      t,
    ]),
  );

  const assertCurrent = () => {
    if (!focusedRef.current || getActiveProfile().id !== profile.id) {
      throw new ProfileUIError('profiles.changed');
    }
  };

  const normalizedUrl = (raw: string) => {
    const normalized = normalizeServerUrl(raw);
    if (!normalized.ok) throw new ProfileUIError('profiles.invalidUrl');
    return normalized;
  };

  const warnHttp = (isHttp: boolean) => {
    if (isHttp) ToastService.showLong(t('settings.httpTransportWarning'));
  };

  const signIn = async (url: string, user: string, pass: string) => {
    assertCurrent();
    if (!(await serverConfigService.isHealthEndpointOk(url))) {
      throw new ProfileUIError('profiles.healthFailed');
    }
    assertCurrent();
    try {
      await login(user, pass);
    } catch (error) {
      throw new ProfileUIError(
        isVersionMismatchError(error)
          ? 'profiles.versionMismatch'
          : isRateLimitedError(error)
            ? 'settings.loginThrottled'
            : 'profiles.loginFailed',
      );
    }
    assertCurrent();
    await profileRegistry.updateConnection({ username: user, urlLocked: true });
    ToastService.showShort(t('settings.loginSuccess'));
    navigation.navigate('Sync');
  };

  const saveConnection = async (url: string, user: string) => {
    assertCurrent();
    const current = getActiveProfile();
    const previous = current.serverUrl
      ? normalizeServerUrl(current.serverUrl)
      : null;
    if (current.urlLocked && (!previous?.ok || previous.href !== url)) {
      throw new ProfileUIError('profiles.urlLocked');
    }
    await profileRegistry.updateConnection({ serverUrl: url, username: user });
    assertCurrent();
  };

  const handleLogin = () => {
    if (hydrating || !serverUrl.trim() || !username.trim() || !password) return;
    void runAction(async () => {
      const normalized = normalizedUrl(serverUrl);
      warnHttp(normalized.isHttp);
      setServerUrl(normalized.href);
      await saveConnection(normalized.href, username.trim());
      await signIn(normalized.href, username.trim(), password);
    }, 'profiles.connectionFailed');
  };

  const handleCreate = () => {
    if (!creation?.name.trim() || busy) return;
    void runAction(async () => {
      assertCurrent();
      if (password && (!serverUrl.trim() || !username.trim()))
        throw new ProfileUIError('profiles.credentialsIncomplete');
      const normalized = serverUrl.trim() ? normalizedUrl(serverUrl) : null;
      if (normalized) warnHttp(normalized.isHttp);
      await creation.onCreate({
        serverUrl: normalized?.href || '',
        username: username.trim(),
        password: password.trim(),
      });
    }, 'profiles.addFailed');
  };

  const handleQRResult = (result: ScannerModalResults) => {
    setShowScanner(false);
    if (result.status === 'cancelled') return;
    if (result.status !== 'success' || !result.data?.value) {
      ToastService.showLong(t('settings.qrScanFailed'));
      return;
    }
    const value = result.data.value;
    void runAction(async () => {
      let settings: SettingsUpdate;
      try {
        settings = await QRSettingsService.processQRCode(value);
      } catch {
        throw new ProfileUIError('settings.qrInvalid');
      }
      assertCurrent();
      const normalized = normalizedUrl(settings.serverUrl);
      settings = { ...settings, serverUrl: normalized.href };
      warnHttp(normalized.isHttp);
      if (creation) {
        setServerUrl(settings.serverUrl);
        setUsername(settings.username);
        setPassword(settings.password);
        return;
      }
      const current = getActiveProfile();
      const previous = current.serverUrl
        ? normalizeServerUrl(current.serverUrl)
        : null;
      if (
        current.urlLocked &&
        (!previous?.ok || previous.href !== settings.serverUrl)
      ) {
        showConfirm({
          title: t('profiles.qrNewTitle'),
          message: t('profiles.qrNewMessage'),
          buttons: [
            {
              text: t('common.cancel'),
              variant: 'tertiary',
              onPress: () => {},
            },
            {
              text: t('profiles.add'),
              variant: 'primary',
              onPress: () => onNewProfileFromQR?.(settings),
            },
          ],
        });
        return;
      }
      setServerUrl(settings.serverUrl);
      setUsername(settings.username);
      setPassword(settings.password);
      await saveConnection(settings.serverUrl, settings.username);
      if (settings.username && settings.password) {
        await signIn(settings.serverUrl, settings.username, settings.password);
      } else {
        ToastService.showShort(t('profiles.connectionSaved'));
      }
    }, 'profiles.connectionFailed');
  };

  const disabled = busy || hydrating;
  return (
    <View style={styles.section}>
      {!creation && (
        <>
          <Text style={[styles.heading, { color: themeColors.onSurface }]}>
            {t('profiles.connectionTitle', { label: profile.label })}
          </Text>
          {!profile.urlLocked && (
            <Text style={[styles.hint, { color: themeColors.onSurface }]}>
              {t('profiles.connectionHint')}
            </Text>
          )}
        </>
      )}
      <TouchableOpacity
        style={[styles.scanButton, { borderColor: themeColors.secondary }]}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('profiles.scanQr')}
        accessibilityState={{ disabled }}
        onPress={() => setShowScanner(true)}>
        <Icon name="qrcode-scan" size={20} color={themeColors.secondary} />
        <Text style={[styles.scanText, { color: themeColors.secondary }]}>
          {t('profiles.scanQr')}
        </Text>
      </TouchableOpacity>
      {(creation || !profile.urlLocked) && (
        <View
          style={[
            styles.trustNotice,
            {
              backgroundColor: withAlpha(themeColors.primary as string, 0.12),
              borderColor: themeColors.primary,
            },
          ]}
          accessible
          accessibilityRole="alert">
          <Icon
            name="alert-circle-outline"
            size={22}
            color={themeColors.primary}
          />
          <Text style={[styles.trustText, { color: themeColors.onSurface }]}>
            {t('profiles.trustWarning')}
          </Text>
        </View>
      )}
      <Input
        placeholder={t('settings.serverUrl')}
        value={serverUrl}
        onChangeText={setServerUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        disabled={disabled || (!creation && profile.urlLocked)}
      />
      <Input
        placeholder={t('settings.username')}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        disabled={disabled}
      />
      <Input
        placeholder={t('settings.password')}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoCorrect={false}
        disabled={disabled}
        secureTextEntry={!showPassword}
        rightAccessory={
          <TouchableOpacity
            style={styles.passwordToggle}
            accessibilityRole="button"
            accessibilityLabel={t(
              showPassword ? 'profiles.hidePassword' : 'profiles.showPassword',
            )}
            onPress={() => setShowPassword(value => !value)}>
            <Icon
              name={showPassword ? 'eye-off' : 'eye'}
              size={22}
              color={themeColors.primary}
            />
          </TouchableOpacity>
        }
      />
      {creation ? (
        <Button
          title={t('profiles.add')}
          onPress={handleCreate}
          loading={busy}
          disabled={disabled || !creation.name.trim()}
          fullWidth
          size="large"
        />
      ) : (
        <Button
          title={t(busy ? 'profiles.working' : 'settings.login')}
          onPress={handleLogin}
          loading={busy}
          disabled={
            disabled || !serverUrl.trim() || !username.trim() || !password
          }
          fullWidth
          size="large"
        />
      )}
      <QRScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onResult={handleQRResult}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: odeSpacing.md, gap: odeSpacing.xs },
  heading: { fontSize: odeTypography.sectionTitle, fontWeight: '600' },
  hint: { fontSize: odeTypography.bodySm, marginBottom: odeSpacing.sm },
  trustNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: odeSpacing.sm,
    padding: odeSpacing.md,
    borderWidth: 1,
    borderRadius: odeSpacing.sm,
  },
  trustText: { flex: 1, fontSize: odeTypography.bodySm },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: odeSpacing.xs,
    borderWidth: 1,
    borderRadius: odeSpacing.xs,
    padding: odeSpacing.sm,
    minHeight: 48,
  },
  scanText: { fontSize: odeTypography.bodySm, fontWeight: '600' },
  passwordToggle: {
    padding: odeSpacing.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ProfileConnection;
