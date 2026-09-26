import RNFS from 'react-native-fs';
import {
  asInsufficientStorageError,
  InsufficientStorageError,
} from '../../errors/InsufficientStorageError';
import { logger } from '../../diagnostics/logger';

/** Refuse to start a bundle download when free space is below this floor. */
export const MIN_FREE_BYTES_TO_START_BUNDLE = 10 * 1024 * 1024;

/**
 * After the zip is on disk, require this much additional free space before
 * extracting. Extraction expands past zip size; headroom covers that plus
 * filesystem overhead.
 */
export const BUNDLE_EXTRACT_SIZE_FACTOR = 2.5;
export const BUNDLE_EXTRACT_SAFETY_BYTES = 5 * 1024 * 1024;

export function bundleStagingPath(
  documentDir: string = RNFS.DocumentDirectoryPath,
): string {
  return `${documentDir}/bundle_staging`;
}

export function bundlePreviousPath(
  documentDir: string = RNFS.DocumentDirectoryPath,
): string {
  return `${documentDir}/bundle_previous`;
}

export function bundleTempZipPath(
  cachesDir: string = RNFS.CachesDirectoryPath,
): string {
  return `${cachesDir}/bundle_temp.zip`;
}

export function requiredBytesForExtract(zipBytes: number): number {
  return (
    Math.ceil(zipBytes * BUNDLE_EXTRACT_SIZE_FACTOR) +
    BUNDLE_EXTRACT_SAFETY_BYTES
  );
}

async function unlinkIfExists(path: string): Promise<void> {
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

async function getFreeSpaceBytes(): Promise<number> {
  const info = await RNFS.getFSInfo();
  return info.freeSpace;
}

/**
 * Throws InsufficientStorageError when free space is below `requiredBytes`.
 * If free-space probing itself fails, logs and continues (native ENOSPC
 * handling still applies during I/O).
 */
export async function assertFreeSpace(
  requiredBytes: number,
  context: string,
): Promise<void> {
  try {
    const freeSpace = await getFreeSpaceBytes();
    if (freeSpace < requiredBytes) {
      logger.warn(
        'sync',
        `insufficient storage (${context}): free=${freeSpace} required=${requiredBytes}`,
      );
      throw new InsufficientStorageError();
    }
  } catch (error) {
    if (error instanceof InsufficientStorageError) {
      throw error;
    }
    logger.warn(
      'sync',
      `could not probe free space (${context}): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * If a previous commit was interrupted after moving live dirs aside, restore
 * them. Safe to call at the start of every install.
 */
export async function recoverInterruptedBundleCommit(options?: {
  documentDir?: string;
}): Promise<void> {
  const documentDir = options?.documentDir ?? RNFS.DocumentDirectoryPath;
  const appDir = `${documentDir}/app`;
  const formsDir = `${documentDir}/forms`;
  const previousRoot = bundlePreviousPath(documentDir);
  const prevApp = `${previousRoot}/app`;
  const prevForms = `${previousRoot}/forms`;

  if (!(await RNFS.exists(previousRoot))) {
    return;
  }

  const liveAppExists = await RNFS.exists(appDir);
  const liveFormsExists = await RNFS.exists(formsDir);
  const prevAppExists = await RNFS.exists(prevApp);
  const prevFormsExists = await RNFS.exists(prevForms);

  const needsRestore =
    (!liveAppExists && prevAppExists) || (!liveFormsExists && prevFormsExists);

  if (needsRestore) {
    logger.warn('sync', 'restoring app bundle from interrupted commit backup');
    try {
      if (!liveAppExists && prevAppExists) {
        await RNFS.moveFile(prevApp, appDir);
      }
      if (!liveFormsExists && prevFormsExists) {
        await RNFS.moveFile(prevForms, formsDir);
      }
    } catch (error) {
      logger.error(
        'sync',
        `failed to restore bundle backup: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Keep previousRoot so a later attempt can still recover.
      return;
    }
  }

  // Live is intact (or restore succeeded) — drop leftover backup.
  try {
    await unlinkIfExists(previousRoot);
  } catch (error) {
    logger.warn(
      'sync',
      `failed to clear bundle_previous: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Replace live `app` / `forms` with staging contents without deleting live
 * first. Live dirs are renamed aside; on failure they are restored.
 *
 * Staging and live paths must be on the same filesystem so `moveFile` is a
 * rename (DocumentDirectory).
 */
export async function commitBundleStagingAtomic(options: {
  stagingRoot: string;
  appDir: string;
  formsDir: string;
  previousRoot: string;
}): Promise<void> {
  const { stagingRoot, appDir, formsDir, previousRoot } = options;
  const stagingApp = `${stagingRoot}/app`;
  const stagingForms = `${stagingRoot}/forms`;
  const prevApp = `${previousRoot}/app`;
  const prevForms = `${previousRoot}/forms`;

  const stagingHasApp = await RNFS.exists(stagingApp);
  const stagingHasForms = await RNFS.exists(stagingForms);
  if (!stagingHasApp && !stagingHasForms) {
    throw new Error('Bundle staging is empty (no app/ or forms/ directory)');
  }

  await unlinkIfExists(previousRoot);
  await RNFS.mkdir(previousRoot);

  try {
    // Move live aside (same-FS rename). Old bundle remains recoverable.
    if (await RNFS.exists(appDir)) {
      await RNFS.moveFile(appDir, prevApp);
    }
    if (await RNFS.exists(formsDir)) {
      await RNFS.moveFile(formsDir, prevForms);
    }

    // Install new dirs from staging.
    if (stagingHasApp) {
      await RNFS.moveFile(stagingApp, appDir);
    }
    if (stagingHasForms) {
      await RNFS.moveFile(stagingForms, formsDir);
    }
  } catch (error) {
    // Best-effort restore of the previous live bundle.
    try {
      await unlinkIfExists(appDir);
      await unlinkIfExists(formsDir);
      if (await RNFS.exists(prevApp)) {
        await RNFS.moveFile(prevApp, appDir);
      }
      if (await RNFS.exists(prevForms)) {
        await RNFS.moveFile(prevForms, formsDir);
      }
    } catch (restoreError) {
      logger.error(
        'sync',
        `bundle commit failed and restore also failed: ${
          restoreError instanceof Error
            ? restoreError.message
            : String(restoreError)
        }`,
      );
    }
    throw asInsufficientStorageError(error);
  }

  // Success: drop backup and empty staging root.
  await unlinkIfExists(previousRoot);
  await unlinkIfExists(stagingRoot);
}

/** Remove install temp artifacts without touching the live app/forms dirs. */
export async function cleanupBundleInstallTemps(options?: {
  documentDir?: string;
  cachesDir?: string;
}): Promise<void> {
  const documentDir = options?.documentDir ?? RNFS.DocumentDirectoryPath;
  const cachesDir = options?.cachesDir ?? RNFS.CachesDirectoryPath;
  await unlinkIfExists(bundleTempZipPath(cachesDir));
  await unlinkIfExists(bundleStagingPath(documentDir));
}
