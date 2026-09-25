import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { appVersionService } from '../services/AppVersionService';

import Icon from '@react-native-vector-icons/material-design-icons';

import { useAppTheme } from '../contexts/AppThemeContext';

import colors from '../theme/colors';
import {
  odeSpacing,
  odeTypography,
  odeBorderWidth,
  odeScreenHeaderHeight,
} from '../theme/odeDesign';
import { LocalePicker, FormLocalePicker } from '../components/common';
import { useScreenShellStyle } from '../hooks/useScreenShellStyle';
import Logo from '../../assets/images/logo.png';
import { Moon, Monitor, Sun, Languages } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { localeSettingsService } from '../services/LocaleSettingsService';
import { formLocaleSettingsService } from '../services/FormLocaleSettingsService';
import { formLocaleIndexService } from '../services/FormLocaleIndexService';
import { type UiLocalePreference } from '../lib/locale';
import { FORM_LOCALE_DEFAULT } from '../lib/formLocale';
import { syncFormulusI18nLanguage } from '../i18n';
import { appEvents } from '../webview/FormulusMessageHandlers';

const SettingsScreen = () => {
  const { t } = useTranslation();

  const { themeColors, themeMode, setThemeMode, resolvedMode } = useAppTheme();
  const shellStyle = useScreenShellStyle();

  const isDark = resolvedMode === 'dark';
  const sectionHeaderColor = isDark
    ? (colors.neutral[200] as string)
    : (colors.neutral[800] as string);

  const [version, setVersion] = useState('');
  const [uiLocalePreference, setUiLocalePreference] =
    useState<UiLocalePreference>('auto');
  const [formLocalePreference, setFormLocalePreference] =
    useState<string>(FORM_LOCALE_DEFAULT);
  const [scannedFormLocales, setScannedFormLocales] = useState<string[]>([]);
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
    void formLocaleSettingsService.load().then(() => {
      if (mountedRef.current) {
        setFormLocalePreference(formLocaleSettingsService.getPreference());
      }
    });
    void formLocaleIndexService.getLocales().then(locales => {
      if (mountedRef.current) {
        setScannedFormLocales(locales);
      }
    });
  }, []);

  useEffect(() => {
    const onBundleUpdated = () => {
      void formLocaleIndexService.getLocales().then(locales => {
        if (mountedRef.current) {
          setScannedFormLocales(locales);
        }
      });
    };
    appEvents.addListener('bundleUpdated', onBundleUpdated);
    return () => appEvents.removeListener('bundleUpdated', onBundleUpdated);
  }, []);

  const handleFormLocalePreference = useCallback(async (preference: string) => {
    setFormLocalePreference(preference);
    await formLocaleSettingsService.setPreference(preference);
  }, []);

  const handleLocalePreference = useCallback(
    async (preference: UiLocalePreference) => {
      setUiLocalePreference(preference);
      await localeSettingsService.setPreference(preference);
      await syncFormulusI18nLanguage();
    },
    [],
  );

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
                accessibilityLabel={t('settings.theme.system')}>
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
                accessibilityLabel={t('settings.theme.light')}>
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
                accessibilityLabel={t('settings.theme.dark')}>
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
                {t('settings.appInterface.label')}
              </Text>
            </View>
            <View style={styles.languagePickerWrap}>
              <LocalePicker
                value={uiLocalePreference}
                onChange={pref => void handleLocalePreference(pref)}
              />
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
                {t('settings.formsLanguage.label')}
              </Text>
            </View>
            <View style={styles.languagePickerWrap}>
              <FormLocalePicker
                value={formLocalePreference}
                locales={scannedFormLocales}
                disabled={scannedFormLocales.length === 0}
                onChange={pref => void handleFormLocalePreference(pref)}
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
