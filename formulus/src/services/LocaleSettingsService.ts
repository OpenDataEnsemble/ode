import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNLocalize from 'react-native-localize';
import {
  resolveActiveLocale,
  type OdeUiLocale,
  type UiLocalePreference,
} from '../lib/locale';
import AppConfigService from './AppConfigService';

const STORAGE_KEY = '@ode/uiLocale';

export class LocaleSettingsService {
  private static instance: LocaleSettingsService | null = null;

  private preference: UiLocalePreference = 'auto';
  private loaded = false;

  static getInstance(): LocaleSettingsService {
    if (!LocaleSettingsService.instance) {
      LocaleSettingsService.instance = new LocaleSettingsService();
    }
    return LocaleSettingsService.instance;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (
        stored === 'auto' ||
        stored === 'en' ||
        stored === 'pt' ||
        stored === 'fr'
      ) {
        this.preference = stored;
      }
    } catch (err) {
      console.warn('[LocaleSettingsService] Failed to load preference:', err);
    }
    this.loaded = true;
  }

  getPreference(): UiLocalePreference {
    return this.preference;
  }

  async setPreference(preference: UiLocalePreference): Promise<void> {
    this.preference = preference;
    this.loaded = true;
    await AsyncStorage.setItem(STORAGE_KEY, preference);
  }

  getDeviceLocale(): string {
    try {
      const locales = RNLocalize.getLocales();
      if (locales.length > 0 && locales[0]?.languageTag) {
        return locales[0].languageTag;
      }
    } catch {
      // ignore
    }
    return 'en';
  }

  /**
   * Resolved catalog locale for Formplayer bridge and i18next.
   */
  async resolveActiveLocale(
    sessionOverride?: string | null,
  ): Promise<OdeUiLocale> {
    await this.load();
    const appConfig = await AppConfigService.getInstance().getConfig();
    return resolveActiveLocale({
      preference: this.preference,
      deviceLocale: this.getDeviceLocale(),
      bundleDefaultLocale: appConfig?.defaultLocale ?? null,
      sessionOverride,
    });
  }
}

export const localeSettingsService = LocaleSettingsService.getInstance();
