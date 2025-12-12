/**
 * AppVersionService - Provides app version information from React Native app config
 *
 * Uses react-native-device-info to get the actual app version instead of hardcoding
 */

import DeviceInfo from 'react-native-device-info';

export class AppVersionService {
  private static instance: AppVersionService;
  private cachedVersion: string | null = null;
  private cachedBuildNumber: string | null = null;

  private constructor() {}

  public static getInstance(): AppVersionService {
    if (!AppVersionService.instance) {
      AppVersionService.instance = new AppVersionService();
    }
    return AppVersionService.instance;
  }

  /**
   * Get the app version (e.g., "1.0.0")
   * Caches the result for performance
   */
  public async getVersion(): Promise<string> {
    if (this.cachedVersion) {
      return this.cachedVersion;
    }

    try {
      this.cachedVersion = DeviceInfo.getVersion();
      console.log('AppVersionService: App version:', this.cachedVersion);
      return this.cachedVersion;
    } catch (error) {
      console.error('AppVersionService: Error getting app version:', error);
      throw new Error(
        `Failed to get app version: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Get the build number (e.g., "123")
   * Caches the result for performance
   */
  public async getBuildNumber(): Promise<string> {
    if (this.cachedBuildNumber) {
      return this.cachedBuildNumber;
    }

    try {
      this.cachedBuildNumber = DeviceInfo.getBuildNumber();
      console.log('AppVersionService: Build number:', this.cachedBuildNumber);
      return this.cachedBuildNumber;
    } catch (error) {
      console.error('AppVersionService: Error getting build number:', error);
      throw new Error(
        `Failed to get build number: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Get the full version string (version + build number)
   * Format: "1.0.0 (123)"
   */
  public async getFullVersion(): Promise<string> {
    try {
      const version = await this.getVersion();
      const buildNumber = await this.getBuildNumber();
      return `${version} (${buildNumber})`;
    } catch (error) {
      console.error('AppVersionService: Error getting full version:', error);
      throw error;
    }
  }

  /**
   * Reset cached versions (useful for testing)
   */
  public resetCache(): void {
    this.cachedVersion = null;
    this.cachedBuildNumber = null;
  }

  /**
   * Check if version is cached
   */
  public isCached(): boolean {
    return this.cachedVersion !== null;
  }
}

// Export singleton instance for convenience
export const appVersionService = AppVersionService.getInstance();
