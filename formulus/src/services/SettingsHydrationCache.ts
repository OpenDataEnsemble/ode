import * as Keychain from 'react-native-keychain';
import { serverConfigService } from './ServerConfigService';

export type SettingsHydrationSnapshot =
  | { ready: false }
  | {
      ready: true;
      serverUrl: string | null;
      credentials: false | { username: string; password: string };
    };

let snapshot: SettingsHydrationSnapshot = { ready: false };

let inflight: Promise<SettingsHydrationSnapshot> | null = null;

function normalizeCredentials(
  raw: Awaited<ReturnType<typeof Keychain.getGenericPassword>>,
): false | { username: string; password: string } {
  if (!raw || raw === false) {
    return false;
  }
  return { username: raw.username, password: raw.password };
}

async function fetchSnapshot(): Promise<SettingsHydrationSnapshot> {
  const [serverUrl, credentials] = await Promise.all([
    serverConfigService.getServerUrl(),
    Keychain.getGenericPassword(),
  ]);
  const next: SettingsHydrationSnapshot = {
    ready: true,
    serverUrl,
    credentials: normalizeCredentials(credentials),
  };
  snapshot = next;
  return next;
}

/**
 * Single-flight read from AsyncStorage + Keychain. Call early (e.g. main app
 * shell, More menu) so the first native Keychain hit happens off the Settings
 * screen critical path.
 */
export function loadSettingsHydrationFromStorage(): Promise<SettingsHydrationSnapshot> {
  if (inflight) {
    return inflight;
  }
  inflight = fetchSnapshot().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function getSettingsHydrationSnapshot(): SettingsHydrationSnapshot {
  return snapshot;
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
  snapshot = { ready: false };
}
