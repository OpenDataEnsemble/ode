import { NativeModules, Platform } from 'react-native';

type NativeProfileLifecycle = {
  prepareDatabase(dbName: string): Promise<void>;
  deleteDatabase(dbName: string): Promise<boolean>;
  isDatabaseOpen(dbName: string): Promise<boolean>;
  databaseExists(dbName: string): Promise<boolean>;
  generateProfileId(): Promise<string>;
  restartRuntime(): Promise<void>;
};

const profileIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const databaseNamePattern =
  /^formulus(?:_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/;

function validateDatabaseName(dbName: string): void {
  // Comparing the complete match also rejects a trailing newline (JS '$' permits one).
  if (
    typeof dbName !== 'string' ||
    databaseNamePattern.exec(dbName)?.[0] !== dbName
  ) {
    throw new Error('Expected formulus or formulus_<lowercase UUID>');
  }
}

function nativeLifecycle(): NativeProfileLifecycle {
  const module = NativeModules.UserAppModule as
    | Partial<NativeProfileLifecycle>
    | undefined;
  if (
    (Platform.OS !== 'android' && Platform.OS !== 'ios') ||
    typeof module?.prepareDatabase !== 'function' ||
    typeof module?.deleteDatabase !== 'function' ||
    typeof module?.isDatabaseOpen !== 'function' ||
    typeof module?.databaseExists !== 'function' ||
    typeof module?.generateProfileId !== 'function' ||
    typeof module?.restartRuntime !== 'function'
  ) {
    throw new Error(
      'Native profile lifecycle is unavailable. Install a Formulus native build with profile support.',
    );
  }
  return module as NativeProfileLifecycle;
}

/**
 * Await BEFORE constructing any Watermelon SQLiteAdapter, including the migrated
 * Default (dbName "formulus"). Marks the name for the native process lifetime;
 * it does not open SQLite. Once ANY name has been prepared in this process,
 * only this helper/runtime's selected name is idempotent. All other preparations
 * reject with E_PROFILE_COLD_LAUNCH_REQUIRED, including unused names in a new
 * runtime. Fully close/reopen the app for EVERY switch; never create two adapters.
 */
export async function prepareProfileDatabase(dbName: string): Promise<void> {
  validateDatabaseName(dbName);
  await nativeLifecycle().prepareDatabase(dbName);
}

/**
 * For registry-tombstoned, inactive profiles only. True means all four DB files
 * are absent; false means deferred until a real cold launch. I/O errors reject.
 * Keep the tombstone on false OR rejection; never reuse a deleted database name.
 */
export async function deleteProfileDatabase(dbName: string): Promise<boolean> {
  validateDatabaseName(dbName);
  return nativeLifecycle().deleteDatabase(dbName);
}

/**
 * Conservative 'this name was prepared in this process', NOT a SQLite handle
 * probe or permission to initialize: a different prepared name also blocks it.
 */
export async function isProfileDatabaseOpen(dbName: string): Promise<boolean> {
  validateDatabaseName(dbName);
  return nativeLifecycle().isDatabaseOpen(dbName);
}

/**
 * Detect any exact main/journal/WAL/SHM directory entry without opening SQLite,
 * marking the name opened, or selecting a running profile. Errors reject rather
 * than imply a fresh install. Also combine with legacy files/AsyncStorage evidence.
 */
export async function profileDatabaseExists(dbName: string): Promise<boolean> {
  validateDatabaseName(dbName);
  return nativeLifecycle().databaseExists(dbName);
}

/** Native random UUID, not a dbName. New profiles (including fresh Default) use formulus_<id>. */
export async function createProfileId(): Promise<string> {
  const id = await nativeLifecycle().generateProfileId();
  if (typeof id !== 'string' || profileIdPattern.exec(id)?.[0] !== id) {
    throw new Error('Native profile ID must be a lowercase UUID');
  }
  return id;
}

/**
 * NOT FOR PROFILE SWITCHING. Retained for explicit bootstrap retries before any
 * profile DB was prepared. Requests RN host reload, not OS process termination.
 * Once any DB was prepared, the replacement runtime cannot prepare ANY profile.
 * Every switch must persist selection, unmount profile UI, and show fully
 * close/reopen instructions instead. Native guards survive external/dev reloads.
 * Resolution acknowledges scheduling, not completion, and may be lost when JS
 * is destroyed. Never rely on post-await cleanup or automatic full app restart.
 */
export async function restartProfileRuntime(): Promise<void> {
  await nativeLifecycle().restartRuntime();
}
