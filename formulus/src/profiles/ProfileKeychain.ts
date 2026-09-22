import * as Keychain from 'react-native-keychain';
import { getActiveProfile } from './ProfileRuntime';
import { profileKeychainService } from './ProfileTypes';
import { profileActivity } from './ProfileActivity';

export function getProfileCredentials() {
  return profileActivity.run('Read profile credentials', () => Keychain.getGenericPassword({ service: profileKeychainService(getActiveProfile().id) }));
}

export function setCredentialsForProfile(id: string, username: string, password: string) {
  return profileActivity.run('Save profile credentials', () => Keychain.setGenericPassword(username, password, { service: profileKeychainService(id) }));
}

export function setProfileCredentials(username: string, password: string) {
  return setCredentialsForProfile(getActiveProfile().id, username, password);
}

export function resetProfileCredentials() {
  return profileActivity.run('Remove profile credentials', () => Keychain.resetGenericPassword({ service: profileKeychainService(getActiveProfile().id) }));
}
