/**
 * Manifest and AsyncStorage version strings should be compared and stored
 * consistently — the API may include stray whitespace.
 */
export function normalizeAppBundleVersion(
  v: string | null | undefined,
): string {
  return (v ?? '0').trim();
}
