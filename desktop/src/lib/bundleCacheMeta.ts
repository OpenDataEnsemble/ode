const PREFIX = 'ode.desktop.bundleCache.v1.';

export interface BundleCacheEntry {
  /** Last known version strings from Synkronus (JSON stringified array). */
  versionsJson: string;
  fetchedAt: string;
}

export function bundleCacheKey(profileId: string): string {
  return `${PREFIX}${profileId}`;
}

export function readBundleCache(profileId: string): BundleCacheEntry | null {
  try {
    const raw = localStorage.getItem(bundleCacheKey(profileId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as BundleCacheEntry;
  } catch {
    return null;
  }
}

export function writeBundleCache(
  profileId: string,
  entry: BundleCacheEntry,
): void {
  localStorage.setItem(bundleCacheKey(profileId), JSON.stringify(entry));
}
