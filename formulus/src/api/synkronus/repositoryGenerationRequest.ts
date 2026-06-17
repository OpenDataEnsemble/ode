/**
 * Resolves which repository_generation value (if any) to send on sync requests.
 *
 * Some builds or migrations may persist the default epoch `1` before any
 * observation cursor exists. Against a server whose epoch is >1, sending `1`
 * looks like an explicit mismatch and yields 409. When there is no real
 * observation sync cursor yet, treat that stored `1` as "unspecified" so the
 * client omits header/body and the server adopts the current epoch (same as a
 * missing key).
 */
export function effectiveRepositoryGenerationForRequest(
  storedRaw: string | null,
  lastSeenVersionRaw: string | null,
): number | null {
  if (storedRaw == null) {
    return null;
  }
  const n = Number(storedRaw);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  const lastSeen = lastSeenVersionRaw?.trim() ?? '';
  const noObservationCursorYet = lastSeen === '' || lastSeen === '0';
  if (n === 1 && noObservationCursorYet) {
    return null;
  }
  return n;
}
