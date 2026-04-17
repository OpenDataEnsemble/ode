import { GeneratedSyncGateway } from './GeneratedSyncGateway';

export * from './SyncGateway';

export const syncGateway = new GeneratedSyncGateway();

function clientIdStorageKey(profileId: string) {
  return `custodian.sync.clientId.${profileId}`;
}

export function getOrCreateClientId(profileId: string) {
  if (!profileId || typeof window === 'undefined') {
    return crypto.randomUUID();
  }
  const key = clientIdStorageKey(profileId);
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}
