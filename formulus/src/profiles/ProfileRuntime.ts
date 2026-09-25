import type { Profile } from './ProfileTypes';

let active: Readonly<Profile> | null = null;

/** Bootstrap binds the persisted selection before any profile services mount. */
export function initializeProfileRuntime(profile: Profile): void {
  if (
    active &&
    (active.id !== profile.id || active.dbName !== profile.dbName)
  ) {
    throw new Error('Profile bootstrap cannot replace a running profile');
  }
  active = Object.freeze({ ...profile });
}

export function assertProfileReady(): void {
  if (!active) throw new Error('Profile bootstrap has not completed');
}

export function getActiveProfile(): Readonly<Profile> {
  assertProfileReady();
  return active!;
}

/** Called only by the transition coordinator after the old UI is unmounted. */
export function selectProfileRuntime(profile: Profile): void {
  active = Object.freeze({ ...profile });
}

/** Label/connection changes do not change the runtime's storage identity. */
export function updateRuntimeProfile(profile: Profile): void {
  if (
    getActiveProfile().id !== profile.id ||
    active!.dbName !== profile.dbName
  ) {
    throw new Error('Cannot replace a running profile');
  }
  active = Object.freeze({ ...profile });
}
