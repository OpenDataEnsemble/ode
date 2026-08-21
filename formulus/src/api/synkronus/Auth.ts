import { synkronusApi } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { ODE_VERSION } from '../../version';
import { logger } from '../../diagnostics/logger';

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

export const login = async (
  username: string,
  password: string,
): Promise<UserInfo> => {
  logger.info('auth', 'login ok');
  const api = await synkronusApi.getApi();

  synkronusApi.clearTokenCache();

  const res = await api.login({
    xOdeVersion: ODE_VERSION,
    loginRequest: { username, password },
  });

  const { token, refreshToken: refreshTokenValue, expiresAt } = res.data;

  await AsyncStorage.setItem('@token', token);
  await AsyncStorage.setItem('@refreshToken', refreshTokenValue);
  await AsyncStorage.setItem('@tokenExpiresAt', expiresAt.toString());

  // Decode JWT to get user info
  const claims = decodeJwtPayload(token);
  const userInfo: UserInfo = {
    username: claims?.username || username,
    role: claims?.role || 'read-only',
  };

  // Store user info
  await AsyncStorage.setItem('@user', JSON.stringify(userInfo));

  return userInfo;
};

export const getUserInfo = async (): Promise<UserInfo | null> => {
  try {
    const userJson = await AsyncStorage.getItem('@user');
    if (userJson) {
      return JSON.parse(userJson);
    }
    return null;
  } catch {
    return null;
  }
};

export const logout = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    '@token',
    '@refreshToken',
    '@tokenExpiresAt',
    '@user',
  ]);
};

// Function to retrieve the auth token from AsyncStorage
export const getApiAuthToken = async (): Promise<string | undefined> => {
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
};

/**
 * Refreshes the authentication token if it has expired.
 */
export const refreshToken = async () => {
  const api = await synkronusApi.getApi();
  const res = await api.refreshToken({
    xOdeVersion: ODE_VERSION,
    refreshTokenRequest: {
      refreshToken: (await AsyncStorage.getItem('@refreshToken')) ?? '',
    },
  });
  const { token, refreshToken: refreshTokenValue, expiresAt } = res.data;
  await AsyncStorage.setItem('@token', token);
  await AsyncStorage.setItem('@refreshToken', refreshTokenValue);
  await AsyncStorage.setItem('@tokenExpiresAt', expiresAt.toString());
  return true;
};

/**
 * Attempts to automatically re-login using stored credentials from Keychain.
 * This is used when a 401 error is encountered during sync operations.
 * @returns Promise<UserInfo> if login succeeds, null if credentials are not available
 * @throws Error if login fails
 */
export const autoLogin = async (): Promise<UserInfo | null> => {
  try {
    // Get stored credentials from Keychain
    const credentials = await Keychain.getGenericPassword();
    if (!credentials || !credentials.username || !credentials.password) {
      console.warn('No stored credentials found for auto-login');
      return null;
    }

    const userInfo = await login(credentials.username, credentials.password);
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
};

/**
 * Checks if an error is a 401 Unauthorized error.
 * Handles various error formats from Axios, fetch, and other HTTP clients.
 */
export const isUnauthorizedError = (error: unknown): boolean => {
  if (!error) return false;

  const httpError = error as HttpError;

  // Axios errors: error.response.status
  if (httpError.response?.status === 401) return true;

  // Direct status properties
  if (httpError.status === 401 || httpError.statusCode === 401) return true;

  // ProblemDetail format (from OpenAPI spec)
  if (httpError.body?.status === 401 || httpError.data?.status === 401)
    return true;

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
