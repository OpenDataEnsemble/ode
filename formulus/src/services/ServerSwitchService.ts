import { databaseService } from '../database/DatabaseService';
import { profileActivity } from '../profiles/ProfileActivity';
import { synkronusApi } from '../api/synkronus';
import { serverConfigService } from './ServerConfigService';
import { invalidateSettingsHydrationCache } from './SettingsHydrationCache';

/** @deprecated Server changes require a separate profile once its URL is bound. */
class ServerSwitchService {
  async getPendingObservationCount(): Promise<number> {
    return profileActivity.run('Count pending observations', async () => {
      const pending = await databaseService.getLocalRepo().getPendingChanges();
      return pending.length;
    });
  }

  async getPendingAttachmentCount(): Promise<number> {
    return synkronusApi.getUnsyncedAttachmentCount();
  }

  /**
   * Compatibility for older callers: never erase data for a URL edit. The registry
   * rejects replacement of a bound URL and directs the user to another profile.
   */
  async resetForServerChange(serverUrl: string): Promise<void> {
    return profileActivity.run('Change unbound profile URL', async () => {
      await serverConfigService.saveServerUrl(serverUrl);
      synkronusApi.clearTokenCache();
      invalidateSettingsHydrationCache();
    });
  }
}

export const serverSwitchService = new ServerSwitchService();
