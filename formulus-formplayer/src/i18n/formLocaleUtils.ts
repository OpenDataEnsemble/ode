/** Resolve effective form translation locale from bridge params. */

export function resolveEffectiveFormLocale(params: unknown): string {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return 'default';
  }
  const formLocale = (params as Record<string, unknown>).formLocale;
  if (typeof formLocale !== 'string' || !formLocale.trim()) {
    return 'default';
  }
  const trimmed = formLocale.trim();
  return trimmed.toLowerCase() === 'default' ? 'default' : trimmed;
}

/** Stamp resolved form locale onto observation payload before submit. */
export function stampFormLocaleOnObservationData(
  data: Record<string, unknown>,
  formLocale: string,
): Record<string, unknown> {
  return { ...data, formLocale };
}
