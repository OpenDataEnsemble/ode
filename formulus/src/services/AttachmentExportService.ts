import RNFS from 'react-native-fs';
import Share from 'react-native-share';
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

function fileUrlForShare(absolutePath: string): string {
  const normalized = absolutePath.replace(/^file:\/\//, '');
  return `file://${normalized}`;
}

/**
 * Zips the device-local `attachments` tree (including `pending_upload` and
 * GUID-based filenames) and opens the system share sheet. Does not modify app data.
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

    const shareUrl = fileUrlForShare(zipPath);

    try {
      await Share.open({
        title: 'Export attachments',
        subject: zipName,
        url: shareUrl,
        type: 'application/zip',
        filename: zipName,
        failOnCancel: false,
      });
    } finally {
      setTimeout(() => {
        RNFS.unlink(zipPath).catch(() => {
          /* best-effort cleanup of cache */
        });
      }, 8000);
    }
  },
};
