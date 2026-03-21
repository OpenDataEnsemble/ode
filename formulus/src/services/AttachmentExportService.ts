import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import {
  saveDocuments,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import { zip } from 'react-native-zip-archive';

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

/** `file://` URI safe for native document save (spaces etc.). */
function pathToFileUri(path: string): string {
  return `file://${encodeURI(path)}`;
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

    const sourceUri = pathToFileUri(zipPath);

    try {
      const results = await saveDocuments({
        sourceUris: [sourceUri],
        mimeType: 'application/zip',
        fileName: zipName,
        ...(Platform.OS === 'ios' ? { copy: true as const } : {}),
      });
      const first = results[0];
      if (first?.error) {
        throw new Error(first.error);
      }
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      throw e;
    } finally {
      await RNFS.unlink(zipPath).catch(() => {
        /* temp zip cleanup */
      });
    }
  },
};
