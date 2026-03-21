import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import {
  saveDocuments,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';

/** `file://` URI safe for native document save (spaces etc.). */
export function pathToFileUri(path: string): string {
  return `file://${encodeURI(path)}`;
}

/**
 * Opens the system Save-as dialog for a zip on disk, then removes the temp file.
 * Resolves silently if the user cancels (OPERATION_CANCELED).
 */
export async function saveZipToDevice(
  zipPath: string,
  zipFileName: string,
): Promise<void> {
  const sourceUri = pathToFileUri(zipPath);

  try {
    const results = await saveDocuments({
      sourceUris: [sourceUri],
      mimeType: 'application/zip',
      fileName: zipFileName,
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
}
