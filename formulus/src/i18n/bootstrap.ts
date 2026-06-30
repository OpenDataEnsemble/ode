import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import pt from '../locales/pt.json';
import fr from '../locales/fr.json';
import { localeSettingsService } from '../services/LocaleSettingsService';
import { i18n } from './instance';

const resources = {
  en: { translation: en },
  pt: { translation: pt },
  fr: { translation: fr },
};

let initPromise: Promise<typeof i18n> | null = null;

export async function initFormulusI18n(): Promise<typeof i18n> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await localeSettingsService.load();
    const locale = await localeSettingsService.resolveActiveLocale();

    if (!i18n.isInitialized) {
      await i18n.use(initReactI18next).init({
        resources,
        lng: locale,
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
        compatibilityJSON: 'v4',
      });
    } else {
      await i18n.changeLanguage(locale);
    }

    return i18n;
  })();

  return initPromise;
}

/** Re-apply locale after Settings change. */
export async function syncFormulusI18nLanguage(): Promise<void> {
  const locale = await localeSettingsService.resolveActiveLocale();
  await i18n.changeLanguage(locale);
}
