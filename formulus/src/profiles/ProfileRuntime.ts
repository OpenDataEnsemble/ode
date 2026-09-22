import type { Profile } from './ProfileTypes';

let active: Readonly<Profile> | null = null;

/** Identity never follows the next-launch selection in the persisted registry. */
export function initializeProfileRuntime(profile: Profile): void {
  if (active && (active.id !== profile.id || active.dbName !== profile.dbName)) {
    throw new Error('Changing profiles requires a cold app launch');
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

/** Label/connection changes do not change the runtime's storage identity. */
export function updateRuntimeProfile(profile: Profile): void {
  if (getActiveProfile().id !== profile.id || active!.dbName !== profile.dbName) {
    throw new Error('Cannot replace a running profile');
  }
  active = Object.freeze({ ...profile });
}
