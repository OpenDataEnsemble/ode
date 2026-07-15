/**
 * Locale utilities (mirrored from formulus/src/lib/locale.ts for Formplayer).
 */

export const ODE_UI_LOCALES = ['en', 'pt', 'fr'] as const;
export type OdeUiLocale = (typeof ODE_UI_LOCALES)[number];

export function normalizeLocaleTag(tag: string): string {
  return tag.trim().replace(/_/g, '-').toLowerCase();
}

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

/** Resolve locale from bridge params; falls back to en. */
export function resolveFormplayerLocale(
  paramsLocale: unknown,
  fallback = 'en',
): OdeUiLocale {
  if (typeof paramsLocale === 'string' && paramsLocale.trim()) {
    const matched = matchOdeCatalogLocale(paramsLocale);
    if (matched) return matched;
  }
  const fromFallback = matchOdeCatalogLocale(fallback);
  return fromFallback ?? 'en';
}
