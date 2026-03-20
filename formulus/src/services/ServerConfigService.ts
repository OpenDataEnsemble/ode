import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = '@server_url';
const SERVER_URL_STORAGE_KEY = '@settings';

/** RN's DOM URL typedef is incomplete; runtime URL has these fields. */
type ParsedHttpUrl = {
  protocol: string;
  hostname: string;
  host: string;
  pathname: string;
  search: string;
  hash: string;
};

export type NormalizeServerUrlResult =
  | { ok: true; href: string; isHttp: boolean }
  | { ok: false; message: string };

/**
 * Trim, infer https when no scheme (or protocol-relative //), lowercase host and path,
 * strip a trailing slash on the path, and validate http(s) with a non-empty host.
 */
export function normalizeServerUrl(raw: string): NormalizeServerUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: 'Please enter a valid server URL' };
  }

  let scheme: 'http' | 'https';
  let remainder: string;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('https://')) {
    scheme = 'https';
    remainder = trimmed.slice('https://'.length);
  } else if (lower.startsWith('http://')) {
    scheme = 'http';
    remainder = trimmed.slice('http://'.length);
  } else if (lower.startsWith('//')) {
    scheme = 'https';
    remainder = trimmed.slice(2);
  } else {
    scheme = 'https';
    remainder = trimmed;
  }

  if (!remainder.trim()) {
    return { ok: false, message: 'Please enter a valid server URL' };
  }

  const candidate = `${scheme}://${remainder}`;

  let parsed: ParsedHttpUrl;
  try {
    parsed = new URL(candidate) as unknown as ParsedHttpUrl;
  } catch {
    return { ok: false, message: 'Please enter a valid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      message: 'URL scheme must be http:// or https://',
    };
  }

  if (!parsed.hostname) {
    return { ok: false, message: 'Please enter a valid server URL' };
  }

  parsed.hostname = parsed.hostname.toLowerCase();

  let path = parsed.pathname;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (path && path !== '/') {
    path = path.toLowerCase();
  } else {
    path = '';
  }

  const href = `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}`;

  return {
    ok: true,
    href,
    isHttp: parsed.protocol === 'http:',
  };
}

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
    const normalized = normalizeServerUrl(serverUrl);
    if (!normalized.ok) {
      console.error('Failed to save server URL: invalid', serverUrl);
      throw new Error(normalized.message);
    }
    const href = normalized.href;
    try {
      await AsyncStorage.setItem(SERVER_URL_KEY, href);
      await AsyncStorage.setItem(
        SERVER_URL_STORAGE_KEY,
        JSON.stringify({ serverUrl: href }),
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
  ): Promise<{ success: boolean; message: string }> {
    const normalized = normalizeServerUrl(serverUrl);
    if (!normalized.ok) {
      return { success: false, message: normalized.message };
    }

    const base = normalized.href;

    try {
      const healthUrl = `${base}/health`;
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
    }
  }
}

export const serverConfigService = ServerConfigService.getInstance();
