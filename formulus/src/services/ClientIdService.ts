/**
 * ClientIdService - Simple and robust client identification for sync operations
 *
 * Uses react-native-device-info's getUniqueId() for cross-platform device identification:
 * - Android: Returns Android ID (same as getAndroidId())
 * - iOS: Returns Identifier for Vendor (IDFV) or generated ID stored in Keychain
 *
 * This ensures consistent device identification across both platforms.
 */

import DeviceInfo from 'react-native-device-info';
import { getActiveProfile } from '../profiles/ProfileRuntime';
import { profileActivity } from '../profiles/ProfileActivity';

export class ClientIdService {
  private static instance: ClientIdService;
  private cachedClientId: string | null = null;
  private cachedProfileId: string | null = null;

  private constructor() {}

  public static getInstance(): ClientIdService {
    if (!ClientIdService.instance) {
      ClientIdService.instance = new ClientIdService();
    }
    return ClientIdService.instance;
  }

  /**
   * Get the client ID - uses device's unique ID with formulus prefix
   * - Android: Uses Android ID (stable across app reinstalls)
   * - iOS: Uses IDFV or generated ID (persists in Keychain)
   * Caches the result for performance
   */
  public async getClientId(): Promise<string> {
    return profileActivity.run('Read client ID', () => this.getClientIdImpl());
  }

  private async getClientIdImpl(): Promise<string> {
    const profile = getActiveProfile();
    if (this.cachedClientId && this.cachedProfileId === profile.id) {
      return this.cachedClientId;
    }

    try {
      // Use getUniqueId() for cross-platform support
      // - Android: Returns Android ID (same as getAndroidId())
      // - iOS: Returns IDFV or generated ID stored in Keychain
      const deviceId = await DeviceInfo.getUniqueId();
      if (getActiveProfile().id !== profile.id)
        throw new Error('Profile changed while reading client ID');
      this.cachedProfileId = profile.id;
      this.cachedClientId = profile.legacyClientId
        ? `formulus-${deviceId}`
        : `formulus-${deviceId}-${profile.id}`;

      return this.cachedClientId;
    } catch (error) {
      console.error('ClientIdService: Error getting device ID:', error);
      throw new Error(
        `Failed to get client ID: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Reset cached client ID (useful for testing)
   */
  public resetCache(): void {
    this.cachedClientId = null;
    this.cachedProfileId = null;
  }

  /**
   * Check if client ID is cached
   */
  public isCached(): boolean {
    return this.cachedClientId !== null;
  }
}

// Export singleton instance for convenience
export const clientIdService = ClientIdService.getInstance();
