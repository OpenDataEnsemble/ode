import { getActiveProfile } from '../profiles/ProfileRuntime';
import { profileRegistry } from '../profiles/ProfileRegistry';
import { profileActivity } from '../profiles/ProfileActivity';

import { normalizeServerUrl } from './normalizeServerUrl';
export {
  normalizeServerUrl,
  type NormalizeServerUrlResult,
} from './normalizeServerUrl';

export class ServerConfigService {
  private static instance: ServerConfigService;

  private constructor() {}

  public static getInstance(): ServerConfigService {
    if (!ServerConfigService.instance) {
      ServerConfigService.instance = new ServerConfigService();
    }
    return ServerConfigService.instance;
  }

  async saveServerUrl(serverUrl: string): Promise<void> {
    return profileActivity.run('Save profile server', () =>
      this.saveServerUrlImpl(serverUrl),
    );
  }

  private async saveServerUrlImpl(serverUrl: string): Promise<void> {
    const normalized = normalizeServerUrl(serverUrl);
    if (!normalized.ok) {
      console.error('Failed to save server URL: invalid', serverUrl);
      throw new Error(normalized.message);
    }
    await profileRegistry.updateConnection({ serverUrl: normalized.href });
  }

  async getServerUrl(): Promise<string | null> {
    profileActivity.assertAvailable();
    return getActiveProfile().serverUrl || null;
  }

  async clearServerUrl(): Promise<void> {
    await profileActivity.run('Clear profile server', () =>
      profileRegistry.updateConnection({ serverUrl: '' }),
    );
  }

  /**
   * GET {serverUrl}/health with timeout. Returns true if the server responds with a
   * success status (2xx), e.g. 200 OK when the service is healthy.
   */
  async isHealthEndpointOk(serverUrl: string): Promise<boolean> {
    return profileActivity.run('Check server health', () =>
      this.isHealthEndpointOkImpl(serverUrl),
    );
  }

  private async isHealthEndpointOkImpl(serverUrl: string): Promise<boolean> {
    const normalized = normalizeServerUrl(serverUrl);
    if (!normalized.ok) {
      return false;
    }

    const base = normalized.href;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const healthUrl = `${base}/health`;

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async testConnection(
    serverUrl: string,
  ): Promise<{ success: boolean; message: string }> {
    return profileActivity.run('Test server connection', () =>
      this.testConnectionImpl(serverUrl),
    );
  }

  private async testConnectionImpl(
    serverUrl: string,
  ): Promise<{ success: boolean; message: string }> {
    const normalized = normalizeServerUrl(serverUrl);
    if (!normalized.ok) {
      return { success: false, message: normalized.message };
    }

    const base = normalized.href;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const healthUrl = `${base}/health`;

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        return { success: true, message: 'Connection successful!' };
      } else {
        return {
          success: false,
          message: `Server responded with status ${response.status}`,
        };
      }
    } catch (error) {
      console.error('Unknown error occured', error);

      const errorMessage = 'Unknown error';
      if (
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('Failed to fetch')
      ) {
        return {
          success: false,
          message:
            'Cannot reach server. Check:\n• Server is running\n• Correct IP/URL\n• Same network (for local IP)\n• Firewall settings',
        };
      }

      return {
        success: false,
        message: `Connection failed: ${errorMessage}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const serverConfigService = ServerConfigService.getInstance();
