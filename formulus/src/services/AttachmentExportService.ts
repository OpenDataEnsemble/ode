import RNFS from 'react-native-fs';
import { profileActivity } from '../profiles/ProfileActivity';
import { zip } from 'react-native-zip-archive';
import { saveZipToDevice } from './saveZipToDevice';

import { profilePaths, profileCachePath } from '../profiles/ProfilePaths';

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
 * Zips the device-local `attachments` tree (including `synced/`, `pending/`,
 * and `draft/` subfolders and GUID-based filenames) and opens the system
 * Save-as dialog so the user can store the archive (e.g. Downloads). Does
 * not modify app data.
 */
export const attachmentExportService = {
  async exportDeviceLocalAttachmentsZip(): Promise<void> {
    return profileActivity.run('Export attachments', async () => {
      const attachmentsDir = profilePaths.attachments();
      const exists = await RNFS.exists(attachmentsDir);
      if (!exists) {
        throw new Error('No local attachment data found.');
      }

      const hasFiles = await directoryHasAnyFile(attachmentsDir);
      if (!hasFiles) {
        throw new Error('No local attachment data found.');
      }

      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const zipName = `formulus-attachments-${stamp}.zip`;
      const zipPath = profileCachePath(zipName);
      await RNFS.mkdir(profilePaths.cache());

      if (await RNFS.exists(zipPath)) {
        await RNFS.unlink(zipPath);
      }

      await zip(attachmentsDir, zipPath);

      await saveZipToDevice(zipPath, zipName);
    });
  },
};
