import { invalidateAuthForProfileSwitch } from '../api/synkronus/Auth';
import { synkronusApi } from '../api/synkronus';
import AppConfigService from './AppConfigService';
import { clientIdService } from './ClientIdService';
import { FormService } from './FormService';
import { networkProfileService } from './NetworkProfileService';
import { invalidateSettingsHydrationCache } from './SettingsHydrationCache';

/** Call after a committed profile change, before allowing new background work. */
export function invalidateProfileServiceCaches(): void {
  invalidateAuthForProfileSwitch();
  synkronusApi.invalidateForProfileSwitch();
  invalidateSettingsHydrationCache();
  AppConfigService.getInstance().reset();
  clientIdService.resetCache();
  FormService.invalidateForProfileSwitch();
  networkProfileService.invalidateForProfileSwitch();
}
