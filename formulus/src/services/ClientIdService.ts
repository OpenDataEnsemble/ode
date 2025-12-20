/**
 * ClientIdService - Simple and robust client identification for sync operations
 *
 * Uses react-native-device-info's getUniqueId() for consistent device identification
 */

import DeviceInfo from 'react-native-device-info';

export class ClientIdService {
  private static instance: ClientIdService;
  private cachedClientId: string | null = null;

  private constructor() {}

  public static getInstance(): ClientIdService {
    if (!ClientIdService.instance) {
      ClientIdService.instance = new ClientIdService();
    }
    return ClientIdService.instance;
  }

  /**
   * Get the client ID - uses device's unique ID with formulus prefix
   * Caches the result for performance
   */
  public async getClientId(): Promise<string> {
    if (this.cachedClientId) {
      return this.cachedClientId;
    }

    try {
      const deviceId = await DeviceInfo.getUniqueId();
      this.cachedClientId = `formulus-${deviceId}`;

      console.log('ClientIdService: Generated client ID:', this.cachedClientId);
      return this.cachedClientId;
    } catch (error) {
      console.error('ClientIdService: Error getting device unique ID:', error);
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
