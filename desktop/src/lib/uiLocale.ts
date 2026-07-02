/** Desktop UI locale — mirrors Formulus Settings key and resolution rules. */

const STORAGE_KEY = '@ode/uiLocale';
const ODE_UI_LOCALES = ['en', 'pt', 'fr'] as const;
export type DesktopUiLocale = (typeof ODE_UI_LOCALES)[number];
export type UiLocalePreference = 'auto' | DesktopUiLocale;

function normalizeLocaleTag(tag: string): string {
  return tag.trim().replace(/_/g, '-').toLowerCase();
}

function localeLookupCandidates(tag: string): string[] {
  const normalized = normalizeLocaleTag(tag);
  if (!normalized) return ['en'];
  const parts = normalized.split('-');
  const candidates: string[] = [normalized];
  if (parts.length > 1) candidates.push(parts[0]!);
  return candidates;
}

function matchOdeCatalogLocale(tag: string): DesktopUiLocale | null {
  for (const candidate of localeLookupCandidates(tag)) {
    if ((ODE_UI_LOCALES as readonly string[]).includes(candidate)) {
      return candidate as DesktopUiLocale;
    }
  }
  return null;
}

export function getDesktopLocalePreference(): UiLocalePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (
      stored === 'auto' ||
      stored === 'en' ||
      stored === 'pt' ||
      stored === 'fr'
    ) {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'auto';
}

export function setDesktopLocalePreference(
  preference: UiLocalePreference,
): void {
  localStorage.setItem(STORAGE_KEY, preference);
}

export function resolveDesktopUiLocale(
  sessionOverride?: string | null,
  bundleDefaultLocale?: string | null,
): DesktopUiLocale {
  if (sessionOverride) {
    const matched = matchOdeCatalogLocale(sessionOverride);
    if (matched) return matched;
  }

  const preference = getDesktopLocalePreference();
  if (preference !== 'auto') return preference;

  const device = navigator.language || 'en';
  const fromDevice = matchOdeCatalogLocale(device);
  if (fromDevice) return fromDevice;

  if (bundleDefaultLocale) {
    const fromBundle = matchOdeCatalogLocale(bundleDefaultLocale);
    if (fromBundle) return fromBundle;
  }

  return 'en';
}
