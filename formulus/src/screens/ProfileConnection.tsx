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
import { useConfirmModal } from '../contexts/ConfirmModalContext';
import type { MainTabParamList } from '../navigation/ProfileNavigationTypes';
import { transitionToProfiles } from '../navigation/ProfileNavigationIntent';
import { profileRegistry } from '../profiles/ProfileRegistry';
import { getActiveProfile } from '../profiles/ProfileRuntime';
import { switchProfile } from '../profiles/ProfileTransitions';
import * as ProfileKeychain from '../profiles/ProfileKeychain';
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
};

const ProfileConnection = ({ profile, busy, runAction }: Props) => {
  const { t } = useTranslation();
  const { themeColors } = useAppTheme();
  const { showConfirm } = useConfirmModal();
  const navigation =
    useNavigation<BottomTabNavigationProp<MainTabParamList, 'Profiles'>>();
  const [serverUrl, setServerUrl] = useState(profile.serverUrl || '');
  const [username, setUsername] = useState(profile.username || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const focusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      focusedRef.current = true;
      setHydrating(true);
      setShowPassword(false);
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
    }, [profile.id, t]),
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

  const createFromQR = (settings: SettingsUpdate) => {
    void runAction(async () => {
      assertCurrent();
      const created = await profileRegistry.add(undefined, {
        serverUrl: settings.serverUrl,
        username: settings.username,
      });
      // Switching requires a cold launch. Stage credentials only in native
      // secure storage; the new profile hydrates them for an explicit login.
      if (settings.username && settings.password) {
        try {
          const saved = await ProfileKeychain.setCredentialsForProfile(
            created.id,
            settings.username,
            settings.password,
          );
          if (saved === false) {
            throw new ProfileUIError('profiles.qrCredentialsFailed');
          }
        } catch {
          throw new ProfileUIError('profiles.qrCredentialsFailed');
        }
      }
      try {
        assertCurrent();
        await transitionToProfiles(() => switchProfile(created.id), created.id);
      } catch {
        throw new ProfileUIError('profiles.qrSwitchFailed');
      }

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
              onPress: () => createFromQR(settings),
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
      <Text style={[styles.heading, { color: themeColors.onSurface }]}>
        {t('profiles.connectionTitle', { label: profile.label })}
      </Text>
      <Text style={[styles.hint, { color: themeColors.onSurface }]}>
        {t(
          profile.urlLocked ? 'profiles.urlLocked' : 'profiles.connectionHint',
        )}
      </Text>
      <Input
        placeholder={t('settings.serverUrl')}
        value={serverUrl}
        onChangeText={setServerUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        disabled={disabled || profile.urlLocked}
      />
      <Button
        title={t('settings.scanQr')}
        variant="secondary"
        disabled={disabled}
        onPress={() => setShowScanner(true)}
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
  passwordToggle: {
    padding: odeSpacing.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ProfileConnection;
