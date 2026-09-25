export interface Profile {
  readonly id: string;
  readonly label: string;
  readonly serverUrl: string;
  readonly username: string;
  readonly dbName: string;
  readonly urlLocked: boolean;
  readonly legacyClientId: boolean;
  readonly legacyWebStorage: boolean;
}

export interface DeletedProfile {
  id: string;
  dbName: string;
  nativeCleanupComplete: boolean;
}

export interface ProfileRegistryData {
  schemaVersion: 1;
  activeProfileId: string;
  profiles: Profile[];
  deletedProfiles: DeletedProfile[];
  legacyWebStorageProfileId: string | null;
  migration: { profileId: string; complete: boolean } | null;
}

export const PROFILE_REGISTRY_KEY = '@ode/profiles/registry';
export const PROFILE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function assertProfileId(id: string): void {
  if (typeof id !== 'string' || PROFILE_ID_PATTERN.exec(id)?.[0] !== id) {
    throw new Error('Invalid profile ID');
  }
}

export function profileStoragePrefix(id: string): string {
  assertProfileId(id);
  return `ode:${id}:native:`;
}

export function profileKeychainService(id: string): string {
  assertProfileId(id);
  return `org.opendataensemble.formulus.profile.${id}`;
}
