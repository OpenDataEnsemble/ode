import { synkronusApi } from './index';
import { profileActivity } from '../../profiles/ProfileActivity';
import AsyncStorage from '../../profiles/ProfileStorage';
import {
  getProfileCredentials,
  setProfileCredentials,
  resetProfileCredentials,
} from '../../profiles/ProfileKeychain';
import { profileRegistry } from '../../profiles/ProfileRegistry';
import { getActiveProfile } from '../../profiles/ProfileRuntime';

import { ODE_VERSION } from '../../version';
import { logger } from '../../diagnostics/logger';
import { invalidateSettingsHydrationCache } from '../../services/SettingsHydrationCache';

export type UserRole = 'read-only' | 'read-write' | 'admin';

export interface UserInfo {
  username: string;
  role: UserRole;
}

/**
 * Represents various HTTP error formats from Axios, fetch, and other HTTP clients.
 */
export interface HttpError extends Error {
  response?: {
    status?: number;
    data?: {
      status?: number;
      code?: string;
      synkronus_version?: string;
    };
  };
  status?: number;
  statusCode?: number;
  body?: {
    status?: number;
    code?: string;
    synkronus_version?: string;
  };
  data?: {
    status?: number;
    code?: string;
    synkronus_version?: string;
  };
  code?: string | number;
}

import {
  VersionMismatchError,
  isVersionMismatchError,
} from '../../errors/VersionMismatchError';
import { isRepositoryResetRequiredError } from '../../errors/RepositoryResetRequiredError';

export { VersionMismatchError, isVersionMismatchError };

const decodeBase64 = (input: string): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const atobFn = (globalThis as any).atob as
    | ((data: string) => string)
    | undefined;
  if (typeof atobFn === 'function') {
    return atobFn(input);
  }

  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = '';
  let i = 0;

  // Basic base64 decoder fallback
  while (i < input.length) {
    const enc1 = chars.indexOf(input.charAt(i++));
    const enc2 = chars.indexOf(input.charAt(i++));
    const enc3 = chars.indexOf(input.charAt(i++));
    const enc4 = chars.indexOf(input.charAt(i++));

    const chr1 = enc1 * 4 + Math.floor(enc2 / 16);
    const chr2 = (enc2 % 16) * 16 + Math.floor(enc3 / 4);
    const chr3 = (enc3 % 4) * 64 + enc4;

    str += String.fromCharCode(chr1);
    if (enc3 !== 64) {
      str += String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      str += String.fromCharCode(chr3);
    }
  }

  return str;
};

// Decode JWT payload without verification (claims are in the middle part)
function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = decodeBase64(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error: unknown) {
    console.error('Error decoding JWT payload:', error);
    return null;
  }
}

const AUTH_STORAGE_KEYS = [
  '@token',
  '@refreshToken',
  '@tokenExpiresAt',
  '@user',
];

const getHttpStatus = (error: unknown): number | undefined => {
  const httpError = error as HttpError | undefined;
  return (
    httpError?.response?.status ??
    httpError?.status ??
    httpError?.statusCode ??
    httpError?.body?.status ??
    httpError?.data?.status
  );
};

// Network requests may overlap, but no two auth persistence chains may interleave.
// Explicit login/logout invalidate older requests immediately, before any await.
let authGeneration = 0;
let sessionRevision = 0;
let persistenceQueue: Promise<void> = Promise.resolve();

type AuthAttempt = {
  generation: number;
  serverUrl: string;
  revision?: number;
};

function captureAttempt(background = false): AuthAttempt {
  return {
    generation: authGeneration,
    serverUrl: getActiveProfile().serverUrl,
    ...(background ? { revision: sessionRevision } : {}),
  };
}

function isCurrent(attempt: AuthAttempt): boolean {
  return attempt.generation === authGeneration &&
    attempt.serverUrl === getActiveProfile().serverUrl &&
    (attempt.revision === undefined || attempt.revision === sessionRevision);
}

function assertCurrent(attempt: AuthAttempt): void {
  if (!isCurrent(attempt)) {
    throw new Error('Authentication operation superseded by a session or server change; please retry.');
  }
}

function serializePersistence<T>(work: () => Promise<T>): Promise<T> {
  const result = persistenceQueue.then(work);
  persistenceQueue = result.then(() => undefined, () => undefined);
  return result;
}

function invalidateSessionCaches(): void {
  synkronusApi.clearTokenCache();
  invalidateSettingsHydrationCache();
}

const clearSession = async (credentials = false): Promise<void> => {
  invalidateSessionCaches();
  try {
    const results = await Promise.allSettled([
      AsyncStorage.multiRemove(AUTH_STORAGE_KEYS),
      ...(credentials ? [resetProfileCredentials()] : []),
    ]);
    const failed = results.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  } finally {
    invalidateSessionCaches();
  }
};

async function persistSession(
  attempt: AuthAttempt,
  values: { token: string; refreshToken: string; expiresAt: number },
  credentials?: { username: string; password: string; user: UserInfo },
): Promise<void> {
  assertCurrent(attempt);
  // Other commits cannot run inside this queue. Only an explicit new intent or
  // a registry URL change can supersede us while native storage is in flight.
  const owner: AuthAttempt = { generation: attempt.generation, serverUrl: attempt.serverUrl };
  if (credentials) {
    await profileRegistry.updateConnection({ serverUrl: owner.serverUrl, username: credentials.username, urlLocked: true });
    assertCurrent(owner);
  }
  sessionRevision += 1;
  try {
    if (credentials) {
      await setProfileCredentials(credentials.username, credentials.password);
      assertCurrent(owner);
    }
    const entries: [string, string][] = [
      ['@token', values.token],
      ['@refreshToken', values.refreshToken],
      ['@tokenExpiresAt', String(values.expiresAt)],
    ];
    if (credentials) entries.push(['@user', JSON.stringify(credentials.user)]);
    for (const [key, value] of entries) {
      assertCurrent(owner);
      await AsyncStorage.setItem(key, value);
    }
    assertCurrent(owner);
  } catch (error) {
    // We own any partial writes until the queue advances. Remove them before a
    // later login/logout can persist, but never erase a different server's state.
    if (getActiveProfile().serverUrl === owner.serverUrl) {
      await clearSession(Boolean(credentials)).catch(cleanupError => {
        console.warn('Failed to clear partial authentication state:', cleanupError);
      });
    }
    throw error;
  } finally {
    invalidateSessionCaches();
  }
}

const removeCredentialsIfMatching = async (
  username: string,
  password: string,
  attempt: AuthAttempt,
): Promise<void> => {
  try {
    const saved = await getProfileCredentials();
    if (isCurrent(attempt) && saved && saved.username === username && saved.password === password) {
      await resetProfileCredentials();
    }
  } catch (error) {
    console.warn('Failed to remove rejected saved credentials:', error);
  } finally {
    invalidateSettingsHydrationCache();
  }
};

async function authenticate(
  attempt: AuthAttempt,
  username: string,
  password: string,
): Promise<UserInfo> {
    assertCurrent(attempt);
    if (!attempt.serverUrl) throw new Error('Missing profile server URL');
    const api = await synkronusApi.getApi();
    assertCurrent(attempt);

    let res;
    try {
      res = await api.login({
        xOdeVersion: ODE_VERSION,
        loginRequest: { username, password },
      });
    } catch (error) {
      // A concrete login HTTP 401 confirms that these credentials are invalid.
      // Transient failures and compatibility errors must leave the prior session intact.
      if (getHttpStatus(error) === 401) {
        await serializePersistence(async () => {
          if (!isCurrent(attempt)) return;
          sessionRevision += 1;
          const owner = { generation: attempt.generation, serverUrl: attempt.serverUrl };
          await clearSession();
          await removeCredentialsIfMatching(username, password, owner);
        });
      }
      throw error;
    }

    const claims = decodeJwtPayload(res.data.token);
    const userInfo: UserInfo = {
      username: claims?.username || username,
      role: claims?.role || 'read-only',
    };

    await serializePersistence(() => persistSession(attempt, res.data, { username, password, user: userInfo }));
    logger.info('auth', 'login ok');
    return userInfo;
}

export const login = async (username: string, password: string): Promise<UserInfo> =>
  profileActivity.run('Sign in', async () => {
    authGeneration += 1;
    return authenticate(captureAttempt(), username, password);
  });

export const getUserInfo = async (): Promise<UserInfo | null> =>
  profileActivity.run('Read session', async () => {
    try {
      const userJson = await AsyncStorage.getItem('@user');
      if (userJson) {
        return JSON.parse(userJson);
      }
      return null;
    } catch {
      return null;
    }
  });

export const logout = async (): Promise<void> =>
  profileActivity.run('Sign out', async () => {
    authGeneration += 1;
    const serverUrl = getActiveProfile().serverUrl;
    invalidateSessionCaches();
    await serializePersistence(async () => {
      if (getActiveProfile().serverUrl !== serverUrl) return;
      sessionRevision += 1;
      await clearSession(true);
    });
  });

// Function to retrieve the auth token from AsyncStorage
export const getApiAuthToken = async (): Promise<string | undefined> =>
  profileActivity.run('Read auth token', async () => {
    try {
      const token = await AsyncStorage.getItem('@token');
      if (token) {
        return token;
      }
      console.warn('No token found in AsyncStorage.');
      return undefined;
    } catch (error) {
      console.error('Error retrieving token from AsyncStorage:', error);
      return undefined;
    }
  });

/**
 * Refreshes the authentication token if it has expired.
 */
export const refreshToken = async () =>
  profileActivity.run('Refresh session', async () => {
    if (!getActiveProfile().urlLocked) return false;
    const attempt = captureAttempt(true);
    const refresh = await serializePersistence(async () => {
      assertCurrent(attempt);
      const value = await AsyncStorage.getItem('@refreshToken');
      assertCurrent(attempt);
      return value;
    });
    if (!refresh) return false;
    const api = await synkronusApi.getApi();
    assertCurrent(attempt);
    let res;
    try {
      res = await api.refreshToken({ xOdeVersion: ODE_VERSION, refreshTokenRequest: { refreshToken: refresh } });
    } catch (error) {
      if (getHttpStatus(error) === 401) {
        await serializePersistence(async () => {
          if (!isCurrent(attempt)) return;
          sessionRevision += 1;
          // Rejected refresh tokens do not invalidate the saved password.
          await clearSession();
        });
      }
      throw error;
    }
    await serializePersistence(() => persistSession(attempt, res.data));
    return true;
  });

/**
 * Attempts to automatically re-login using stored credentials from Keychain.
 * This is used when a 401 error is encountered during sync operations.
 * @returns Promise<UserInfo> if login succeeds, null if credentials are not available
 * @throws Error if login fails
 */
export const autoLogin = async (): Promise<UserInfo | null> =>
  profileActivity.run('Automatic sign in', async () => {
    // QR setup can stage credentials, but they are not trusted for automatic
    // requests until an explicit login has durably bound this server URL.
    if (!getActiveProfile().urlLocked) return null;
    const attempt = captureAttempt(true);
    try {
      const credentials = await serializePersistence(async () => {
        assertCurrent(attempt);
        const saved = await getProfileCredentials();
        assertCurrent(attempt);
        return saved;
      });
      if (!credentials || !credentials.username || !credentials.password) {
        console.warn('No stored credentials found for auto-login');
        return null;
      }

      assertCurrent(attempt);
      const userInfo = await authenticate(attempt, credentials.username, credentials.password);
      logger.info('auth', 'auto-login ok');
      return userInfo;
    } catch (error: unknown) {
      const httpError = error as HttpError;
      console.error('Auto-login failed:', httpError);
      throw new Error(
        `Auto-login failed: ${
          httpError?.message || 'Unknown error'
        }. Please login manually.`,
      );
    }
  });

/**
 * Checks if an error is a 401 Unauthorized error.
 * Handles various error formats from Axios, fetch, and other HTTP clients.
 */
export const isUnauthorizedError = (error: unknown): boolean => {
  if (!error) return false;

  const httpError = error as HttpError;

  if (getHttpStatus(error) === 401) return true;

  // Check error message for 401 or unauthorized
  if (typeof httpError.message === 'string') {
    const msg = httpError.message.toLowerCase();
    if (msg.includes('401') || msg.includes('unauthorized')) {
      return true;
    }
  }

  // Check error code
  if (httpError.code === 'UNAUTHORIZED' || httpError.code === 401) return true;

  return false;
};

export const isRateLimitedError = (error: unknown): boolean =>
  getHttpStatus(error) === 429;

/** User-visible explanation when the server rejects observation upload (e.g. read-only role). */
export const SYNC_WRITE_FORBIDDEN_MESSAGE =
  'You do not have permission to upload observations. Confirm with your administrator that your account has write access, or sign in with an account that can submit data.';

/**
 * Checks if an error is a 403 Forbidden error (e.g. read-only user attempting sync push).
 */
export const isForbiddenError = (error: unknown): boolean => {
  if (!error) return false;

  const httpError = error as HttpError;

  if (httpError.response?.status === 403) return true;

  if (httpError.status === 403 || httpError.statusCode === 403) return true;

  if (httpError.body?.status === 403 || httpError.data?.status === 403)
    return true;

  if (typeof httpError.message === 'string') {
    const msg = httpError.message.toLowerCase();
    if (msg.includes('403') || msg.includes('forbidden')) {
      return true;
    }
  }

  if (httpError.code === 'FORBIDDEN' || httpError.code === 403) return true;

  return false;
};

/**
 * Checks if an error is a 404 Not Found (e.g. missing app bundle on server).
 */
export const isNotFoundError = (error: unknown): boolean => {
  if (!error) return false;

  const httpError = error as HttpError;

  if (httpError.response?.status === 404) return true;

  if (httpError.status === 404 || httpError.statusCode === 404) return true;

  if (httpError.body?.status === 404 || httpError.data?.status === 404)
    return true;

  if (typeof httpError.message === 'string') {
    const msg = httpError.message.toLowerCase();
    if (
      msg.includes('status code 404') ||
      (msg.includes('404') && msg.includes('not found'))
    ) {
      return true;
    }
  }

  if (httpError.code === 'NOT_FOUND' || httpError.code === 404) return true;

  return false;
};

/**
 * Maps sync failures to short text suitable for notifications, status line, and alerts.
 */
export const getUserFacingSyncErrorMessage = (error: unknown): string => {
  if (isVersionMismatchError(error)) {
    return (error as Error).message;
  }
  if (isRepositoryResetRequiredError(error)) {
    return (error as Error).message;
  }
  if (isForbiddenError(error)) {
    return SYNC_WRITE_FORBIDDEN_MESSAGE;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error occurred';
};
