import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { database } from '../database/database';
import { synkronusApi } from '../api/synkronus';

const REPOSITORY_GENERATION_KEY = '@repository_generation';

/**
 * Clears local observation/attachment sync state after a server-side repository
 * reset (new epoch). Unlike {@link ServerSwitchService}, keeps the same server URL,
 * auth session, and app bundle/forms.
 */
class RepositoryRecoveryService {
  async wipeLocalSyncState(): Promise<void> {
    const attachmentsDirectory = `${RNFS.DocumentDirectoryPath}/attachments`;
    try {
      if (await RNFS.exists(attachmentsDirectory)) {
        await RNFS.unlink(attachmentsDirectory);
      }
    } catch (error) {
      throw new Error(`Failed to delete attachments directory: ${error}`);
    }
    await RNFS.mkdir(attachmentsDirectory);
    await RNFS.mkdir(`${attachmentsDirectory}/pending_upload`);

    await database.write(async () => {
      await database.unsafeResetDatabase();
    });

    await AsyncStorage.multiRemove([
      '@last_seen_version',
      '@last_attachment_version',
      REPOSITORY_GENERATION_KEY,
      '@lastSync',
    ]);

    synkronusApi.clearTokenCache();
  }
}

export const repositoryRecoveryService = new RepositoryRecoveryService();
