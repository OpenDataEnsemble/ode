/**
 * Manifest and AsyncStorage version strings should be compared and stored
 * consistently — the API may include stray whitespace.
 */
export function normalizeAppBundleVersion(
  v: string | null | undefined,
): string {
  return (v ?? '0').trim();
}

/**
 * True when the whole string (after trim) parses to a finite {@link Number}.
 * Zero-padded integers (e.g. `"001"`, `"003"`) are valid.
 * Non-numeric values (e.g. sentinel strings from a misbehaving server) fail.
 */
export function isNumericAppBundleVersionString(v: string): boolean {
  const s = v.trim();
  if (s === '') {
    return false;
  }
  return Number.isFinite(Number(s));
}

/**
 * Whether two numeric version strings differ, using numeric comparison so
 * leading zeros do not matter (`"001"` vs `"1"` → same).
 */
export function appBundleVersionsDifferNumerically(
  a: string,
  b: string,
): boolean {
  return Number(a) !== Number(b);
}
