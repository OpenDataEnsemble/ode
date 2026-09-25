import { getProfileCredentials } from '../profiles/ProfileKeychain';
import { serverConfigService } from './ServerConfigService';
import { profileActivity } from '../profiles/ProfileActivity';
import { getActiveProfile } from '../profiles/ProfileRuntime';

export type SettingsHydrationSnapshot =
  | { ready: false }
  | {
      ready: true;
      serverUrl: string | null;
      credentials: false | { username: string; password: string };
    };

let snapshot: SettingsHydrationSnapshot = { ready: false };

let inflight: Promise<SettingsHydrationSnapshot> | null = null;
let generation = 0;
let snapshotProfileId: string | null = null;

function normalizeCredentials(
  raw: Awaited<ReturnType<typeof getProfileCredentials>>,
): false | { username: string; password: string } {
  if (!raw) {
    return false;
  }
  return { username: raw.username, password: raw.password };
}

async function fetchSnapshot(
  requestedGeneration: number,
  profileId: string,
): Promise<SettingsHydrationSnapshot> {
  const serverUrl = await serverConfigService.getServerUrl();
  const credentials = await getProfileCredentials();
  const next: SettingsHydrationSnapshot = {
    ready: true,
    serverUrl,
    credentials: normalizeCredentials(credentials),
  };
  if (
    requestedGeneration !== generation ||
    getActiveProfile().id !== profileId
  ) {
    throw new Error('Profile changed while loading settings');
  }
  snapshot = next;
  return next;
}

/**
 * Single-flight read from AsyncStorage + Keychain. Call early (e.g. main app
 * shell, More menu) so the first native Keychain hit happens off the Settings
 * screen critical path.
 */
export function loadSettingsHydrationFromStorage(): Promise<SettingsHydrationSnapshot> {
  profileActivity.assertAvailable();
  const profileId = getActiveProfile().id;
  if (snapshotProfileId !== profileId) {
    invalidateSettingsHydrationCache();
    snapshotProfileId = profileId;
  }
  if (inflight) {
    return inflight;
  }
  const requestedGeneration = generation;
  const request = profileActivity
    .run('Load profile settings', () =>
      fetchSnapshot(requestedGeneration, profileId),
    )
    .finally(() => {
      if (inflight === request) {
        inflight = null;
      }
    });
  inflight = request;
  return inflight;
}

export function getSettingsHydrationSnapshot(): SettingsHydrationSnapshot {
  return snapshotProfileId === getActiveProfile().id
    ? snapshot
    : { ready: false };
}

/** Typed helper for initial form state (Keychain may have no generic password). */
export function getSettingsHydrationCredentialPair(
  snap: SettingsHydrationSnapshot,
): { username: string; password: string } | null {
  if (!snap.ready || snap.credentials === false) {
    return null;
  }
  return snap.credentials;
}

/** When storage may no longer match the cache (e.g. after server switch). */
export function invalidateSettingsHydrationCache(): void {
  generation += 1;
  snapshot = { ready: false };
  inflight = null;
}
