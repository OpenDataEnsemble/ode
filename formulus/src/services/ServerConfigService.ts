import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = '@server_url';
const SERVER_URL_STORAGE_KEY = '@settings';

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
    try {
      await AsyncStorage.setItem(SERVER_URL_KEY, serverUrl);
      await AsyncStorage.setItem(
        SERVER_URL_STORAGE_KEY,
        JSON.stringify({serverUrl}),
      );
    } catch (error) {
      console.error('Failed to save server URL:', error);
      throw error;
    }
  }

  async getServerUrl(): Promise<string | null> {
    try {
      const url = await AsyncStorage.getItem(SERVER_URL_KEY);
      if (url) {
        return url;
      }

      const settings = await AsyncStorage.getItem(SERVER_URL_STORAGE_KEY);
      if (settings) {
        const parsed = JSON.parse(settings);
        return parsed.serverUrl || null;
      }

      return null;
    } catch (error) {
      console.error('Failed to get server URL:', error);
      return null;
    }
  }

  async clearServerUrl(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SERVER_URL_KEY);
      await AsyncStorage.removeItem(SERVER_URL_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear server URL:', error);
      throw error;
    }
  }

  async testConnection(
    serverUrl: string,
  ): Promise<{success: boolean; message: string}> {
    if (!serverUrl.trim()) {
      return {success: false, message: 'Please enter a server URL'};
    }

    try {
      const url = new URL(serverUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return {success: false, message: 'URL must be HTTP or HTTPS'};
      }
    } catch {
      return {success: false, message: 'Please enter a valid URL'};
    }

    try {
      const healthUrl = `${serverUrl.replace(/\/$/, '')}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return {success: true, message: 'Connection successful!'};
      } else {
        return {
          success: false,
          message: `Server responded with status ${response.status}`,
        };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'Connection timeout. Check your network and server.',
        };
      }

      const errorMessage = error.message || 'Unknown error';
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
    }
  }
}

export const serverConfigService = ServerConfigService.getInstance();
