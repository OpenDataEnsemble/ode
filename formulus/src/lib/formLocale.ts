import { localeLookupCandidates, normalizeLocaleTag } from './locale';

export const FORM_LOCALE_DEFAULT = 'default' as const;
export type FormLocalePreference = typeof FORM_LOCALE_DEFAULT | string;

export function isDefaultFormLocale(tag: string): boolean {
  return tag.trim().toLowerCase() === FORM_LOCALE_DEFAULT;
}

export function sortFormLocaleCodes(locales: string[]): string[] {
  return [...locales].sort((a, b) => a.localeCompare(b));
}

function localeInUnion(tag: string, available: string[]): boolean {
  if (isDefaultFormLocale(tag)) return true;
  const normalized = normalizeLocaleTag(tag);
  const availableNorm = new Set(available.map(normalizeLocaleTag));
  if (availableNorm.has(normalized)) return true;
  for (const candidate of localeLookupCandidates(tag)) {
    if (availableNorm.has(candidate)) return true;
  }
  return false;
}

export interface ResolveActiveFormLocaleInput {
  preference: FormLocalePreference;
  availableLocales: string[];
  /** `openFormplayer` params.formLocale when provided. */
  sessionOverride?: string | null;
  /** Prior observation metadata on edit. */
  savedFormLocale?: string | null;
}

/**
 * Resolve the form translation locale for a Formplayer session.
 * Precedence: session override → saved observation → Settings → default.
 * Settings-only stale tags fall back to default (session/saved accept any BCP-47).
 */
export function resolveActiveFormLocale(
  input: ResolveActiveFormLocaleInput,
): FormLocalePreference {
  const { preference, availableLocales, sessionOverride, savedFormLocale } =
    input;

  if (typeof sessionOverride === 'string' && sessionOverride.trim()) {
    const trimmed = sessionOverride.trim();
    return isDefaultFormLocale(trimmed) ? FORM_LOCALE_DEFAULT : trimmed;
  }

  if (typeof savedFormLocale === 'string' && savedFormLocale.trim()) {
    const trimmed = savedFormLocale.trim();
    return isDefaultFormLocale(trimmed) ? FORM_LOCALE_DEFAULT : trimmed;
  }

  if (isDefaultFormLocale(preference)) {
    return FORM_LOCALE_DEFAULT;
  }

  if (localeInUnion(preference, availableLocales)) {
    return preference;
  }

  return FORM_LOCALE_DEFAULT;
}

export function isStaleFormLocalePreference(
  preference: FormLocalePreference,
  availableLocales: string[],
): boolean {
  if (isDefaultFormLocale(preference)) return false;
  return !localeInUnion(preference, availableLocales);
}
