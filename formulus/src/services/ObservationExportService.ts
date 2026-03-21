import RNFS from 'react-native-fs';
import { zip } from 'react-native-zip-archive';
import { Observation } from '../database/models/Observation';
import { databaseService } from '../database/DatabaseService';
import { saveZipToDevice } from './saveZipToDevice';

function safeJsonFileName(observationId: string): string {
  const base = observationId.replace(/[/\\?%*:|"<>]/g, '_');
  const trimmed = base.length > 180 ? `${base.slice(0, 180)}_trunc` : base;
  return `${trimmed}.json`;
}

function uniqueJsonFileName(
  observationId: string,
  usedNames: Set<string>,
): string {
  const stem = safeJsonFileName(observationId).replace(/\.json$/i, '');
  let candidate = `${stem}.json`;
  let suffix = 0;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${stem}__${suffix}.json`;
  }
  usedNames.add(candidate);
  return candidate;
}

function observationToExportJson(obs: Observation): Record<string, unknown> {
  return {
    observationId: obs.observationId,
    formType: obs.formType,
    formVersion: obs.formVersion,
    createdAt: obs.createdAt.toISOString(),
    updatedAt: obs.updatedAt.toISOString(),
    syncedAt: obs.syncedAt?.toISOString() ?? null,
    deleted: obs.deleted,
    data: obs.data,
    geolocation: obs.geolocation,
    author: obs.author ?? '',
    deviceId: obs.deviceId ?? '',
  };
}

async function removeDirectoryRecursive(dirPath: string): Promise<void> {
  const exists = await RNFS.exists(dirPath);
  if (!exists) {
    return;
  }
  const items = await RNFS.readDir(dirPath);
  for (const item of items) {
    if (item.isDirectory()) {
      await removeDirectoryRecursive(item.path);
    } else {
      await RNFS.unlink(item.path);
    }
  }
  await RNFS.unlink(dirPath);
}

/**
 * Exports every local observation as one JSON file per row, zips the folder,
 * and opens the system Save-as dialog. Does not modify app data.
 */
export const observationExportService = {
  async exportAllObservationsZip(): Promise<void> {
    const observations = await databaseService
      .getLocalRepo()
      .getAllObservations();

    if (observations.length === 0) {
      throw new Error('No observations to export.');
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const workDir = `${RNFS.CachesDirectoryPath}/formulus-obs-export-${stamp}`;
    const zipName = `formulus-observations-${stamp}.zip`;
    const zipPath = `${RNFS.CachesDirectoryPath}/${zipName}`;

    if (await RNFS.exists(workDir)) {
      await removeDirectoryRecursive(workDir);
    }
    await RNFS.mkdir(workDir);

    try {
      const usedNames = new Set<string>();
      for (const obs of observations) {
        const fileName = uniqueJsonFileName(obs.observationId, usedNames);
        const filePath = `${workDir}/${fileName}`;
        const json = JSON.stringify(observationToExportJson(obs), null, 2);
        await RNFS.writeFile(filePath, json, 'utf8');
      }

      if (await RNFS.exists(zipPath)) {
        await RNFS.unlink(zipPath);
      }

      await zip(workDir, zipPath);
    } finally {
      await removeDirectoryRecursive(workDir).catch(() => {
        /* best-effort cleanup */
      });
    }

    await saveZipToDevice(zipPath, zipName);
  },
};
