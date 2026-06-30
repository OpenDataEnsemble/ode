/**
 * UI locale resolution for Formulus and Formplayer bridge.
 * ODE ships en, pt, fr catalogs; other tags fall back through normalization.
 */

export const ODE_UI_LOCALES = ['en', 'pt', 'fr'] as const;
export type OdeUiLocale = (typeof ODE_UI_LOCALES)[number];

/** User preference stored in Settings (auto = follow device). */
export type UiLocalePreference = 'auto' | OdeUiLocale;

export const UI_LOCALE_PREFERENCE_OPTIONS: {
  value: UiLocalePreference;
  labelKey: string;
}[] = [
  { value: 'auto', labelKey: 'settings.language.auto' },
  { value: 'en', labelKey: 'settings.language.en' },
  { value: 'pt', labelKey: 'settings.language.pt' },
  { value: 'fr', labelKey: 'settings.language.fr' },
];

/** Normalize BCP-47 tag for catalog lookup (lowercase, hyphen). */
export function normalizeLocaleTag(tag: string): string {
  return tag.trim().replace(/_/g, '-').toLowerCase();
}

/** Candidate tags to try for a locale (e.g. pt-BR → pt-br, pt). */
export function localeLookupCandidates(tag: string): string[] {
  const normalized = normalizeLocaleTag(tag);
  if (!normalized) return ['en'];
  const parts = normalized.split('-');
  const candidates: string[] = [normalized];
  if (parts.length > 1) {
    candidates.push(parts[0]!);
  }
  return candidates;
}

export function isOdeUiLocale(tag: string): tag is OdeUiLocale {
  return (ODE_UI_LOCALES as readonly string[]).includes(tag);
}

/**
 * Map a device or bundle tag to the nearest ODE catalog locale, or null if none match.
 */
export function matchOdeCatalogLocale(
  tag: string,
  supported: readonly string[] = ODE_UI_LOCALES,
): OdeUiLocale | null {
  for (const candidate of localeLookupCandidates(tag)) {
    if ((supported as readonly string[]).includes(candidate)) {
      return candidate as OdeUiLocale;
    }
  }
  return null;
}

export interface ResolveActiveLocaleInput {
  preference: UiLocalePreference;
  deviceLocale: string;
  bundleDefaultLocale?: string | null;
  /** Optional per-session override from openFormplayer params. */
  sessionOverride?: string | null;
}

/**
 * Resolve the active UI locale for Formplayer and shell i18n.
 * Precedence: session override → explicit preference → device (auto) → bundle default → en.
 */
export function resolveActiveLocale(
  input: ResolveActiveLocaleInput,
): OdeUiLocale {
  const { preference, deviceLocale, bundleDefaultLocale, sessionOverride } =
    input;

  if (sessionOverride) {
    const matched = matchOdeCatalogLocale(sessionOverride);
    if (matched) return matched;
  }

  if (preference !== 'auto' && isOdeUiLocale(preference)) {
    return preference;
  }

  const fromDevice = matchOdeCatalogLocale(deviceLocale);
  if (fromDevice) return fromDevice;

  if (bundleDefaultLocale) {
    const fromBundle = matchOdeCatalogLocale(bundleDefaultLocale);
    if (fromBundle) return fromBundle;
  }

  return 'en';
}
