import AsyncStorage from '../profiles/ProfileStorage';
import { profilePaths } from '../profiles/ProfilePaths';
import { profileActivity } from '../profiles/ProfileActivity';
import RNFS from 'react-native-fs';
import { database } from '../database/database';
import { synkronusApi } from '../api/synkronus';
import ObservationIndexService from './ObservationIndexService';

const REPOSITORY_GENERATION_KEY = '@repository_generation';

/**
 * Clears local observation/attachment sync state after a server-side repository
 * reset (new epoch). Unlike {@link ServerSwitchService}, keeps the same server URL,
 * auth session, and app bundle/forms.
 */
class RepositoryRecoveryService {
  /**
   * @param serverRepositoryGeneration - When the server returned 409, pass the epoch from
   *   `x-repository-generation` so the next sync matches Synkronus (default client gen 1 would
   *   still conflict after a reset).
   */
  async wipeLocalSyncState(serverRepositoryGeneration?: number): Promise<void> {
    return profileActivity.run('Reset local repository', () =>
      this.wipeLocalSyncStateImpl(serverRepositoryGeneration),
    );
  }

  private async wipeLocalSyncStateImpl(
    serverRepositoryGeneration?: number,
  ): Promise<void> {
    const attachmentsDirectory = profilePaths.attachments();
    try {
      if (await RNFS.exists(attachmentsDirectory)) {
        await RNFS.unlink(attachmentsDirectory);
      }
    } catch (error) {
      throw new Error(`Failed to delete attachments directory: ${error}`);
    }
    await RNFS.mkdir(attachmentsDirectory);
    await RNFS.mkdir(`${attachmentsDirectory}/synced`);
    await RNFS.mkdir(`${attachmentsDirectory}/pending`);
    await RNFS.mkdir(`${attachmentsDirectory}/draft`);

    await database.write(async () => {
      await database.unsafeResetDatabase();
    });

    // The index tables come back empty, but the service is a singleton and
    // still believes it has a completed rebuild behind it.
    ObservationIndexService.getInstance(database).reset();

    await AsyncStorage.multiRemove([
      '@last_seen_version',
      '@last_attachment_version',
      '@deferred_attachment_downloads',
      REPOSITORY_GENERATION_KEY,
      '@lastSync',
    ]);

    if (
      serverRepositoryGeneration != null &&
      Number.isFinite(serverRepositoryGeneration) &&
      serverRepositoryGeneration >= 1
    ) {
      await AsyncStorage.setItem(
        REPOSITORY_GENERATION_KEY,
        String(Math.floor(serverRepositoryGeneration)),
      );
    }

    synkronusApi.clearTokenCache();
  }
}

export const repositoryRecoveryService = new RepositoryRecoveryService();
