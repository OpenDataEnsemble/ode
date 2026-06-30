import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../../locales/en.json';

let initialized = false;

export async function ensureI18nForTests(): Promise<void> {
  if (initialized || i18n.isInitialized) {
    initialized = true;
    return;
  }
  await i18n.use(initReactI18next).init({
    lng: 'en',
    resources: { en: { translation: en } },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });
  initialized = true;
}
