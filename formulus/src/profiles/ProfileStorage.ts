import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveProfile } from './ProfileRuntime';
import { profileStoragePrefix } from './ProfileTypes';
import { profileActivity } from './ProfileActivity';

function prefix(): string {
  return profileStoragePrefix(getActiveProfile().id);
}

/** Never falls back to global keys, including on a storage error. */
const ProfileStorage = {
  getItem: (key: string): Promise<string | null> => profileActivity.run('Read profile storage', () => AsyncStorage.getItem(prefix() + key)),
  setItem: (key: string, value: string): Promise<void> => profileActivity.run('Write profile storage', () => AsyncStorage.setItem(prefix() + key, value)),
  removeItem: (key: string): Promise<void> => profileActivity.run('Remove profile storage', () => AsyncStorage.removeItem(prefix() + key)),
  multiGet: (keys: readonly string[]): Promise<readonly [string, string | null][]> => profileActivity.run('Read profile storage', async () => {
    const scope = prefix();
    const values = await AsyncStorage.multiGet(keys.map(key => scope + key));
    return values.map(([key, value]) => [key.slice(scope.length), value] as [string, string | null]);
  }),
  multiSet: (entries: readonly (readonly [string, string])[]): Promise<void> => profileActivity.run('Write profile storage', () => {
    const scope = prefix();
    return AsyncStorage.multiSet(entries.map(([key, value]) => [scope + key, value]));
  }),
  multiRemove: (keys: readonly string[]): Promise<void> => profileActivity.run('Remove profile storage', () => {
    const scope = prefix();
    return AsyncStorage.multiRemove(keys.map(key => scope + key));
  }),
  getAllKeys: (): Promise<string[]> => profileActivity.run('List profile storage', async () => {
    const scope = prefix();
    return (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(scope)).map(key => key.slice(scope.length));
  }),
  clear: (): Promise<void> => profileActivity.run('Clear profile storage', async () => {
    const scope = prefix();
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(scope));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  }),
};

export default ProfileStorage;
