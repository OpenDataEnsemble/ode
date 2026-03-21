import RNFS from 'react-native-fs';
import { zip } from 'react-native-zip-archive';
import { saveZipToDevice } from './saveZipToDevice';

const ATTACHMENTS_DIR = `${RNFS.DocumentDirectoryPath}/attachments`;

async function directoryHasAnyFile(dirPath: string): Promise<boolean> {
  const entries = await RNFS.readDir(dirPath);
  for (const entry of entries) {
    if (entry.isFile()) {
      return true;
    }
    if (entry.isDirectory() && (await directoryHasAnyFile(entry.path))) {
      return true;
    }
  }
  return false;
}

/**
 * Zips the device-local `attachments` tree (including `pending_upload` and
 * GUID-based filenames) and opens the system Save-as dialog so the user can
 * store the archive (e.g. Downloads). Does not modify app data.
 */
export const attachmentExportService = {
  async exportDeviceLocalAttachmentsZip(): Promise<void> {
    const exists = await RNFS.exists(ATTACHMENTS_DIR);
    if (!exists) {
      throw new Error('No local attachment data found.');
    }

    const hasFiles = await directoryHasAnyFile(ATTACHMENTS_DIR);
    if (!hasFiles) {
      throw new Error('No local attachment data found.');
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const zipName = `formulus-attachments-${stamp}.zip`;
    const zipPath = `${RNFS.CachesDirectoryPath}/${zipName}`;

    if (await RNFS.exists(zipPath)) {
      await RNFS.unlink(zipPath);
    }

    await zip(ATTACHMENTS_DIR, zipPath);

    await saveZipToDevice(zipPath, zipName);
  },
};
