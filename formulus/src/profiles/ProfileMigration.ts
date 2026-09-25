import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import * as Keychain from 'react-native-keychain';
import { ensureProfileDirectories, profileRootFor } from './ProfilePaths';
import { profileKeychainService, profileStoragePrefix } from './ProfileTypes';

export const LEGACY_PROFILE_KEYS = new Set([
  '@settings',
  '@server_url',
  '@token',
  '@refreshToken',
  '@tokenExpiresAt',
  '@user',
  '@last_seen_version',
  '@last_attachment_version',
  '@repository_generation',
  '@lastSync',
  '@appVersion',
  '@deferred_attachment_downloads',
  '@ode/adaptivePullPageSize',
  '@ode/adaptivePushBatchSize',
  '@attachments_layout_v2',
]);

export const LEGACY_DIRECTORIES = [
  'attachments',
  'app',
  'forms',
  'signatures',
] as const;

export function isLegacyProfileKey(key: string): boolean {
  return (
    LEGACY_PROFILE_KEYS.has(key) ||
    key.startsWith('@ode_sequence:') ||
    key.startsWith('@observations')
  );
}

/** Move one entry at a time; never overwrite an unverified destination after a crash. */
async function migrateDirectory(
  source: string,
  destination: string,
): Promise<void> {
  if (!(await RNFS.exists(source))) return;
  await RNFS.mkdir(destination);
  const entries = await RNFS.readDir(source);
  for (const entry of entries) {
    const target = `${destination}/${entry.name}`;
    if (entry.isDirectory()) {
      await migrateDirectory(entry.path, target);
    } else if (entry.isFile()) {
      if (await RNFS.exists(target)) {
        const sourceHash = await RNFS.hash(entry.path, 'sha256');
        const targetHash = await RNFS.hash(target, 'sha256');
        if (sourceHash !== targetHash)
          throw new Error(
            'Conflicting legacy profile files; migration stopped without overwriting data',
          );
        await RNFS.unlink(entry.path);
      } else {
        await RNFS.moveFile(entry.path, target);
      }
    } else {
      throw new Error('Unexpected legacy file type; migration stopped');
    }
  }
  // The application is gated: no old writer can recreate entries during this step.
  if ((await RNFS.readDir(source)).length)
    throw new Error('Legacy directory changed during migration');
  await RNFS.unlink(source);
}

export async function migrateLegacyProfile(
  id: string,
  hasServerUrl: boolean,
): Promise<void> {
  const root = profileRootFor(id);
  for (const directory of LEGACY_DIRECTORIES) {
    await migrateDirectory(
      `${RNFS.DocumentDirectoryPath}/${directory}`,
      `${root}/${directory}`,
    );
  }
  const keys = (await AsyncStorage.getAllKeys()).filter(isLegacyProfileKey);
  const entries = await AsyncStorage.multiGet(keys);
  const prefix = profileStoragePrefix(id);
  for (const [key, value] of entries) {
    if (value === null) continue;
    // Never replay orphan credentials/tokens against a newly entered server.
    if (
      !hasServerUrl &&
      ['@token', '@refreshToken', '@tokenExpiresAt', '@user'].includes(key)
    )
      continue;
    const destination = prefix + key;
    const existing = await AsyncStorage.getItem(destination);
    if (existing !== null && existing !== value)
      throw new Error('Conflicting legacy profile storage; migration stopped');
    await AsyncStorage.setItem(destination, value);
    if ((await AsyncStorage.getItem(destination)) !== value)
      throw new Error('Profile storage migration verification failed');
  }

  const credentials = await Keychain.getGenericPassword();
  if (credentials && hasServerUrl) {
    const options = { service: profileKeychainService(id) };
    const existing = await Keychain.getGenericPassword(options);
    if (
      existing &&
      (existing.username !== credentials.username ||
        existing.password !== credentials.password)
    )
      throw new Error('Conflicting migrated credentials');
    const saved = await Keychain.setGenericPassword(
      credentials.username,
      credentials.password,
      options,
    );
    if (!saved) throw new Error('Unable to migrate profile credentials');
    const verified = await Keychain.getGenericPassword(options);
    if (
      !verified ||
      verified.username !== credentials.username ||
      verified.password !== credentials.password
    )
      throw new Error('Credential migration verification failed');
  }
  await ensureProfileDirectories(id);
  // Only remove sources after every destination has been verified. Partial removal is retryable.
  if (credentials) {
    await Keychain.resetGenericPassword();
    if (await Keychain.getGenericPassword())
      throw new Error('Unable to retire legacy credentials');
  }
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
