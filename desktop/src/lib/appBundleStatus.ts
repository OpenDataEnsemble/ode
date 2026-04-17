import type { AppBundleState } from '../types/domain';

/** True when the server’s current manifest differs from what we last applied locally. */
export function appBundleUpdateAvailable(
  manifest: { version: string; hash: string } | null,
  local: AppBundleState | null,
): boolean {
  if (!manifest) {
    return false;
  }
  if (!local) {
    return true;
  }
  return (
    manifest.version !== local.activeVersion ||
    manifest.hash !== local.activeHash
  );
}

/** Server-reported versions that are not yet present in `archivedVersions`. */
export function serverVersionsNotDownloaded(
  serverVersions: string[],
  archived: string[],
): string[] {
  const have = new Set(archived);
  return serverVersions.filter(v => !have.has(v));
}
