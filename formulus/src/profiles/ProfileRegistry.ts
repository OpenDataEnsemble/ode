import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import * as Keychain from 'react-native-keychain';
import { normalizeServerUrl } from '../services/ServerConfigService';
import { profileActivity } from './ProfileActivity';
import { initializeProfileRuntime, getActiveProfile, updateRuntimeProfile } from './ProfileRuntime';
import { ensureProfileDirectories, profileRootFor, profileCacheRootFor } from './ProfilePaths';
import { createProfileId, profileDatabaseExists, deleteProfileDatabase } from './nativeProfileLifecycle';
import { isLegacyProfileKey, LEGACY_DIRECTORIES, migrateLegacyProfile } from './ProfileMigration';
import { assertProfileId, PROFILE_REGISTRY_KEY, profileKeychainService, profileStoragePrefix } from './ProfileTypes';
import type { Profile, ProfileRegistryData } from './ProfileTypes';

export type { Profile } from './ProfileTypes';

function parseRegistry(raw: string): ProfileRegistryData {
  const value: ProfileRegistryData = JSON.parse(raw);
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.profiles) || !value.profiles.length || !Array.isArray(value.deletedProfiles)) throw new Error('Invalid profile registry; refusing to create an empty replacement');
  const ids = new Set<string>();
  const databases = new Set<string>();
  for (const profile of [...value.profiles, ...value.deletedProfiles]) {
    assertProfileId(profile.id);
    if (ids.has(profile.id) || databases.has(profile.dbName) || (profile.dbName !== 'formulus' && profile.dbName !== `formulus_${profile.id}`)) throw new Error('Invalid or duplicate profile identity');
    ids.add(profile.id);
    databases.add(profile.dbName);
  }
  for (const profile of value.profiles) {
    if (typeof profile.label !== 'string' || !profile.label.trim() || typeof profile.serverUrl !== 'string' || typeof profile.username !== 'string' || typeof profile.urlLocked !== 'boolean' || typeof profile.legacyClientId !== 'boolean' || typeof profile.legacyWebStorage !== 'boolean' || (profile.urlLocked && !profile.serverUrl)) throw new Error('Invalid profile metadata');
    if (profile.serverUrl && !normalizeServerUrl(profile.serverUrl).ok) throw new Error('Invalid stored server URL');
  }
  if (!value.profiles.some(profile => profile.id === value.activeProfileId)) throw new Error('Selected profile is missing or deleted');
  if (value.legacyWebStorageProfileId !== null) {
    assertProfileId(value.legacyWebStorageProfileId);
    if (!ids.has(value.legacyWebStorageProfileId)) throw new Error('Unknown legacy browser-storage owner');
  }
  if (value.migration !== null && (!value.migration || typeof value.migration.complete !== 'boolean' || !value.profiles.some(profile => profile.id === value.migration!.profileId))) throw new Error('Invalid profile migration journal');
  return value;
}

function normalizeConnection(raw: string): string {
  if (!raw.trim()) return '';
  const result = normalizeServerUrl(raw);
  if (!result.ok) throw new Error('Invalid profile server URL');
  return result.href;
}

class ProfileRegistry {
  private data: ProfileRegistryData | null = null;
  private initialization: Promise<void> | null = null;
  private mutationQueue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();

  private current(): ProfileRegistryData {
    if (!this.data) throw new Error('Profile registry is not ready');
    return this.data;
  }

  private async persist(next: ProfileRegistryData): Promise<void> {
    await AsyncStorage.setItem(PROFILE_REGISTRY_KEY, JSON.stringify(next));
    this.data = next;
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* Observers must not invalidate a durable commit. */ }
    }
  }

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    return profileActivity.run('Update profile registry', () => {
      const result = this.mutationQueue.then(operation);
      this.mutationQueue = result.catch(() => undefined);
      return result;
    });
  }

  initialize(): Promise<void> {
    if (!this.initialization) this.initialization = this.initializeImpl();
    return this.initialization;
  }

  private async initializeImpl(): Promise<void> {
    const raw = await AsyncStorage.getItem(PROFILE_REGISTRY_KEY);
    if (raw !== null) {
      this.data = parseRegistry(raw);
    } else {
      const profilesRoot = `${RNFS.DocumentDirectoryPath}/profiles`;
      if (await RNFS.exists(profilesRoot)) {
        if ((await RNFS.readDir(profilesRoot)).length) throw new Error('Profile files exist without their registry. Restore the registry before continuing.');
      }
      const keys = (await AsyncStorage.getAllKeys()).filter(isLegacyProfileKey);
      let legacy = keys.length > 0 || await profileDatabaseExists('formulus');
      for (const directory of LEGACY_DIRECTORIES) {
        if (await RNFS.exists(`${RNFS.DocumentDirectoryPath}/${directory}`)) legacy = true;
      }
      const credentials = await Keychain.getGenericPassword();
      // Keychain alone may survive an iOS uninstall. Never attach it to a new URL.
      const directUrl = await AsyncStorage.getItem('@server_url');
      const settings = await AsyncStorage.getItem('@settings');
      const oldUrl = directUrl || (settings ? JSON.parse(settings).serverUrl : '') || '';
      const serverUrl = normalizeConnection(oldUrl);
      const user = await AsyncStorage.getItem('@user');
      const username = credentials ? credentials.username : user ? JSON.parse(user).username || '' : '';
      const id = await createProfileId();
      const profile: Profile = {
        id, label: 'Default', serverUrl, username: serverUrl ? username : '',
        dbName: legacy ? 'formulus' : `formulus_${id}`,
        urlLocked: Boolean(serverUrl), legacyClientId: legacy, legacyWebStorage: legacy,
      };
      // Journal the immutable destination before moving a single file or key.
      await this.persist({ schemaVersion: 1, activeProfileId: id, profiles: [profile], deletedProfiles: [], legacyWebStorageProfileId: legacy ? id : null, migration: { profileId: id, complete: false } });
    }
    const state = this.current();
    if (state.migration && !state.migration.complete) {
      const owner = state.profiles.find(profile => profile.id === state.migration!.profileId)!;
      await migrateLegacyProfile(owner.id, Boolean(owner.serverUrl));
      await this.persist({ ...state, migration: { ...state.migration, complete: true } });
    }
    await this.cleanupDeletedProfiles();
    const active = this.current().profiles.find(profile => profile.id === this.current().activeProfileId)!;
    await ensureProfileDirectories(active.id);
    initializeProfileRuntime(active);
  }

  list(): Profile[] { return this.current().profiles.map(profile => ({ ...profile })); }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  getDeletedProfileIds(): string[] { return this.current().deletedProfiles.map(profile => profile.id); }
  getLegacyWebStorageProfileId(): string | null { return this.current().legacyWebStorageProfileId; }

  add(label = 'Profile', connection: { serverUrl?: string; username?: string } = {}): Promise<Profile> {
    return this.mutate(async () => {
      const id = await createProfileId();
      if ([...this.current().profiles, ...this.current().deletedProfiles].some(profile => profile.id === id)) throw new Error('Duplicate generated profile ID');
      const profile: Profile = { id, label: label.trim() || 'Profile', serverUrl: normalizeConnection(connection.serverUrl || ''), username: connection.username?.trim() || '', dbName: `formulus_${id}`, urlLocked: false, legacyClientId: false, legacyWebStorage: false };
      // Commit ownership first; startup can recreate directories if interrupted.
      await this.persist({ ...this.current(), profiles: [...this.current().profiles, profile] });
      this.emit();
      return { ...profile };
    });
  }

  rename(id: string, label: string): Promise<void> {
    return this.mutate(async () => {
      if (!label.trim() || !this.current().profiles.some(profile => profile.id === id)) throw new Error('Invalid profile name or ID');
      const profiles = this.current().profiles.map(profile => profile.id === id ? { ...profile, label: label.trim() } : profile);
      await this.persist({ ...this.current(), profiles });
      if (getActiveProfile().id === id) updateRuntimeProfile(profiles.find(profile => profile.id === id)!);
      this.emit();
    });
  }

  updateConnection(update: { serverUrl?: string; username?: string; urlLocked?: boolean }): Promise<void> {
    const id = getActiveProfile().id;
    return this.mutate(async () => {
      const current = this.current().profiles.find(profile => profile.id === id);
      if (!current) throw new Error('Profile has been deleted');
      const serverUrl = update.serverUrl === undefined ? current.serverUrl : normalizeConnection(update.serverUrl);
      if (current.urlLocked && serverUrl !== current.serverUrl) throw new Error('Profile server URL is permanently locked');
      if (current.urlLocked && update.urlLocked === false) throw new Error('Profile server URL cannot be unlocked');
      if (update.urlLocked && !serverUrl) throw new Error('Cannot bind an empty server URL');
      const next = { ...current, serverUrl, username: update.username ?? current.username, urlLocked: current.urlLocked || update.urlLocked === true };
      await this.persist({ ...this.current(), profiles: this.current().profiles.map(profile => profile.id === id ? next : profile) });
      updateRuntimeProfile(next);
      this.emit();
    });
  }

  /** Transition-only: changes next-boot selection, never running identity. */
  async commitSelection(id: string, deleteId?: string): Promise<void> {
    const state = this.current();
    if (!state.profiles.some(profile => profile.id === id) || id === deleteId) throw new Error('Invalid next profile');
    const deleted = deleteId ? state.profiles.find(profile => profile.id === deleteId) : undefined;
    if (deleteId && (!deleted || state.profiles.length < 2)) throw new Error('Cannot delete this profile');
    await this.persist({
      ...state, activeProfileId: id,
      profiles: state.profiles.filter(profile => profile.id !== deleteId),
      deletedProfiles: deleted ? [...state.deletedProfiles, { id: deleted.id, dbName: deleted.dbName, nativeCleanupComplete: false }] : state.deletedProfiles,
      migration: state.migration?.profileId === deleteId ? null : state.migration,
    });
    // Do not publish the new selection to the old shell or mutate runtime identity.
  }

  /** Bootstrap only, before any database or WebView can open. */
  async cleanupDeletedProfiles(): Promise<void> {
    for (const deleted of this.current().deletedProfiles) {
      if (deleted.nativeCleanupComplete) continue;
      try {
        const prefix = profileStoragePrefix(deleted.id);
        const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix));
        if (keys.length) await AsyncStorage.multiRemove(keys);
        await Keychain.resetGenericPassword({ service: profileKeychainService(deleted.id) });
        if (await Keychain.getGenericPassword({ service: profileKeychainService(deleted.id) })) throw new Error('Profile credentials could not be removed');
        for (const path of [profileRootFor(deleted.id), profileCacheRootFor(deleted.id)]) {
          if (await RNFS.exists(path)) await RNFS.unlink(path);
        }
        if (await deleteProfileDatabase(deleted.dbName)) {
          const state = this.current();
          await this.persist({ ...state, deletedProfiles: state.deletedProfiles.map(item => item.id === deleted.id ? { ...item, nativeCleanupComplete: true } : item) });
        }
      } catch {
        // Keep the durable tombstone; never resurrect data after partial deletion.
        console.warn('Profile cleanup deferred until a subsequent cold launch');
      }
    }
  }
}

export const profileRegistry = new ProfileRegistry();
