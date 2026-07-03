import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FORM_LOCALE_DEFAULT,
  isStaleFormLocalePreference,
  resolveActiveFormLocale,
  type FormLocalePreference,
} from '../lib/formLocale';
import { formLocaleIndexService } from './FormLocaleIndexService';

const STORAGE_KEY = '@ode/formLocale';

export class FormLocaleSettingsService {
  private static instance: FormLocaleSettingsService | null = null;

  private preference: FormLocalePreference = FORM_LOCALE_DEFAULT;
  private loaded = false;

  static getInstance(): FormLocaleSettingsService {
    if (!FormLocaleSettingsService.instance) {
      FormLocaleSettingsService.instance = new FormLocaleSettingsService();
    }
    return FormLocaleSettingsService.instance;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored != null && stored.trim()) {
        this.preference = stored.trim();
      }
    } catch (err) {
      console.warn(
        '[FormLocaleSettingsService] Failed to load preference:',
        err,
      );
    }
    this.loaded = true;
  }

  getPreference(): FormLocalePreference {
    return this.preference;
  }

  async setPreference(preference: FormLocalePreference): Promise<void> {
    this.preference = preference;
    this.loaded = true;
    await AsyncStorage.setItem(STORAGE_KEY, preference);
  }

  /**
   * Resolved form translation locale for Formplayer (`params.formLocale`).
   */
  async resolveActiveFormLocale(
    sessionOverride?: string | null,
    savedFormLocale?: string | null,
  ): Promise<FormLocalePreference> {
    await this.load();
    const availableLocales = await formLocaleIndexService.getLocales();

    if (
      !sessionOverride &&
      !savedFormLocale &&
      isStaleFormLocalePreference(this.preference, availableLocales)
    ) {
      await this.setPreference(FORM_LOCALE_DEFAULT);
    }

    return resolveActiveFormLocale({
      preference: this.preference,
      availableLocales,
      sessionOverride,
      savedFormLocale,
    });
  }
}

export const formLocaleSettingsService =
  FormLocaleSettingsService.getInstance();
