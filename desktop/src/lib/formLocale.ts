import { tauriClient } from './tauriClient';
import { collectTranslationLocalesFromUiSchema } from './collectTranslationLocales';

export const FORM_LOCALE_DEFAULT = 'default' as const;
export type FormLocalePreference = typeof FORM_LOCALE_DEFAULT | string;

const STORAGE_KEY = '@ode/formLocale';

export function getDesktopFormLocalePreference(): FormLocalePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored != null && stored.trim()) {
      return stored.trim();
    }
  } catch {
    // ignore
  }
  return FORM_LOCALE_DEFAULT;
}

export function setDesktopFormLocalePreference(
  preference: FormLocalePreference,
): void {
  localStorage.setItem(STORAGE_KEY, preference);
}

export async function scanActiveBundleFormLocales(): Promise<string[]> {
  const forms = await tauriClient.listActiveBundleForms();
  const localeSet = new Set<string>();
  for (const form of forms) {
    try {
      const spec = await tauriClient.readBundleFormSpec(form.formType);
      for (const code of collectTranslationLocalesFromUiSchema(spec.uiSchema)) {
        localeSet.add(code);
      }
    } catch {
      // skip unreadable forms
    }
  }
  return Array.from(localeSet).sort((a, b) => a.localeCompare(b));
}

export function resolveDesktopFormLocale(
  sessionOverride?: string | null,
  savedFormLocale?: string | null,
): FormLocalePreference {
  if (typeof sessionOverride === 'string' && sessionOverride.trim()) {
    const trimmed = sessionOverride.trim();
    return trimmed.toLowerCase() === FORM_LOCALE_DEFAULT
      ? FORM_LOCALE_DEFAULT
      : trimmed;
  }
  if (typeof savedFormLocale === 'string' && savedFormLocale.trim()) {
    const trimmed = savedFormLocale.trim();
    return trimmed.toLowerCase() === FORM_LOCALE_DEFAULT
      ? FORM_LOCALE_DEFAULT
      : trimmed;
  }
  return getDesktopFormLocalePreference();
}
