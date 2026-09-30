import type { ProfileLocalStorage } from '../types/FormulusInterfaceDefinition';

export interface ProfileStorageContext {
  __odeProfileId?: string;
  __odeLegacyWebStorageProfileId?: string | null;
  __odeDeletedProfileIds?: string[];
}

const legacyKeys = ['formulus_drafts', 'formulus_sticky_fields'];
const migrationMarker = 'legacy-migration-v1';

export function requireProfileId(id: unknown): string {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('Formplayer requires a host profile ID');
  }
  return id;
}

function removePrefix(storage: Storage, prefix: string): void {
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(prefix)) storage.removeItem(key);
  }
}

export function createNamespacedStorage(
  profileId: string,
  namespace: 'app' | 'formplayer',
  storage: Storage,
): ProfileLocalStorage {
  const prefix = `ode:${requireProfileId(profileId)}:${namespace}:`;
  return Object.freeze({
    getItem: (key: string) => storage.getItem(prefix + key),
    setItem: (key: string, value: string) =>
      storage.setItem(prefix + key, value),
    removeItem: (key: string) => storage.removeItem(prefix + key),
    clear: () => removePrefix(storage, prefix),
  });
}

/** Explicitly initialized per document, before draft selection or sticky lookup. */
export class FormplayerProfileStorage implements ProfileLocalStorage {
  private profileId: string | null = null;
  private storage: ProfileLocalStorage | null = null;

  initialize(context: ProfileStorageContext, storage: Storage): void {
    const id = requireProfileId(context.__odeProfileId);
    if (this.profileId !== null && this.profileId !== id) {
      throw new Error(
        'A Formplayer document cannot change profiles; remount it',
      );
    }
    const deletedIds = context.__odeDeletedProfileIds ?? [];
    if (!Array.isArray(deletedIds))
      throw new Error('Invalid deleted profile IDs');
    deletedIds.forEach(requireProfileId);
    // Cleanup must precede migration, including when a cold origin is first opened.
    for (const deletedId of deletedIds)
      removePrefix(storage, `ode:${deletedId}:`);
    const owner = context.__odeLegacyWebStorageProfileId;
    if (owner && deletedIds.includes(owner)) {
      legacyKeys.forEach(key => storage.removeItem(key));
    }
    if (deletedIds.includes(id))
      throw new Error('Active profile has been deleted');
    const scoped = createNamespacedStorage(id, 'formplayer', storage);
    if (owner === id && scoped.getItem(migrationMarker) !== '1') {
      for (const key of legacyKeys) {
        const legacy = storage.getItem(key);
        if (legacy !== null && scoped.getItem(key) === null) {
          scoped.setItem(key, legacy);
        }
      }
      // Last write: interrupted/quota-failed migrations can retry without overwriting
      // already scoped data. Legacy sources remain for designated-owner deletion.
      scoped.setItem(migrationMarker, '1');
    }
    this.profileId = id;
    this.storage = scoped;
  }

  private get ref(): ProfileLocalStorage {
    if (!this.storage)
      throw new Error('Formplayer profile storage is not initialized');
    return this.storage;
  }

  getItem(key: string): string | null {
    return this.ref.getItem(key);
  }
  setItem(key: string, value: string): void {
    this.ref.setItem(key, value);
  }
  removeItem(key: string): void {
    this.ref.removeItem(key);
  }
  clear(): void {
    this.ref.clear();
  }
}

export const formplayerStorage = new FormplayerProfileStorage();

export function initializeFormplayerStorage(paramsProfileId?: unknown): void {
  const context = window as Window & ProfileStorageContext;
  const id = requireProfileId(context.__odeProfileId);
  if (paramsProfileId !== undefined && paramsProfileId !== id) {
    throw new Error('Form init profile does not match its host document');
  }
  formplayerStorage.initialize(context, window.localStorage);
}
