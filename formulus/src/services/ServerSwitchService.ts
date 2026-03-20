import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { database } from '../database/database';
import { databaseService } from '../database/DatabaseService';
import { synkronusApi } from '../api/synkronus';
import { logout } from '../api/synkronus/Auth';
import { serverConfigService } from './ServerConfigService';
import { invalidateSettingsHydrationCache } from './SettingsHydrationCache';

/**
 * Handles cleanup when switching Synkronus servers to avoid cross-server data.
 */
class ServerSwitchService {
  /**
   * Count pending local observations (unsynced).
   */
  async getPendingObservationCount(): Promise<number> {
    const localRepo = databaseService.getLocalRepo();
    const pending = await localRepo.getPendingChanges();
    return pending.length;
  }

  /**
   * Count pending attachment uploads.
   */
  async getPendingAttachmentCount(): Promise<number> {
    return await synkronusApi.getUnsyncedAttachmentCount();
  }

  /**
   * Fully reset local state and persist the new server URL.
   */
  async resetForServerChange(serverUrl: string): Promise<void> {
    // 1) Clear attachments on disk (fail fast)
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

    // 2) Clear app bundle and forms (fail fast)
    await synkronusApi.removeAppBundleFiles();

    // 3) Reset DB
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });

    // 4) Clear sync/app metadata + tokens
    await AsyncStorage.multiRemove([
      '@last_seen_version',
      '@last_attachment_version',
      '@lastSync',
      '@appVersion',
      '@settings',
      '@server_url',
      '@token',
      '@refreshToken',
      '@tokenExpiresAt',
      '@user',
    ]);
    await AsyncStorage.setItem('@appVersion', '0');

    // 5) Clear auth/session
    await logout().catch(error =>
      console.warn('Logout during server switch failed:', error),
    );

    // 6) Save the new server URL (recreates @settings/@server_url)
    await serverConfigService.saveServerUrl(serverUrl);
    invalidateSettingsHydrationCache();
  }
}

export const serverSwitchService = new ServerSwitchService();
