import { synkronusApi } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

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
      formulus_version?: string;
    };
  };
  status?: number;
  statusCode?: number;
  body?: { status?: number; code?: string; synkronus_version?: string; formulus_version?: string };
  data?: { status?: number; code?: string; synkronus_version?: string; formulus_version?: string };
  code?: string | number;
}

/** Response body when Synkronus returns VERSION_MISMATCH (400). */
export interface VersionMismatchInfo {
  synkronusVersion: string;
  formulusVersion: string;
}

const VERSION_ERROR_CODES = ['VERSION_MISMATCH', 'VERSION_HEADER_REQUIRED', 'VERSION_INVALID'] as const;

/**
 * Checks if an error is a Formulus-Synkronus version error (400 with code VERSION_MISMATCH, VERSION_HEADER_REQUIRED, or VERSION_INVALID).
 */
export const isVersionMismatchError = (error: unknown): boolean => {
  if (!error) return false;
  const e = error as HttpError;
  const status = e.response?.status ?? e.status ?? e.statusCode ?? e.response?.data?.status;
  if (status !== 400) return false;
  const code = e.response?.data?.code ?? e.body?.code ?? e.data?.code;
  return typeof code === 'string' && VERSION_ERROR_CODES.includes(code as (typeof VERSION_ERROR_CODES)[number]);
};

/**
 * Returns version info from a version error for display, or null when not present.
 */
export const getVersionMismatchInfo = (error: unknown): VersionMismatchInfo | null => {
  if (!isVersionMismatchError(error)) return null;
  const e = error as HttpError;
  const d = e.response?.data ?? e.body ?? e.data;
  if (!d || typeof d !== 'object') return null;
  const synkronusVersion = (d as { synkronus_version?: string }).synkronus_version ?? '';
  const formulusVersion = (d as { formulus_version?: string }).formulus_version ?? '';
  if (!synkronusVersion && !formulusVersion) return null;
  return { synkronusVersion: synkronusVersion || '?', formulusVersion: formulusVersion || '?' };
};

/**
 * Returns a user-facing message for a version error. Uses server message when present.
 */
export const getVersionMismatchMessage = (error: unknown): string => {
  const e = error as HttpError;
  const d = e?.response?.data ?? e?.body ?? e?.data;
  const serverMessage = typeof d === 'object' && d !== null && typeof (d as { message?: string }).message === 'string'
    ? (d as { message: string }).message
    : null;
  if (serverMessage) return serverMessage;
  const info = getVersionMismatchInfo(error);
  if (!info) {
    return 'Version check failed. The Synkronus version of this endpoint may not be supported by this version of Formulus.';
  }
  return `The Synkronus version of this endpoint (v${info.synkronusVersion}) is not supported by this version of Formulus (v${info.formulusVersion}).`;
};

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
  console.log('Logging in with', username);
  const api = await synkronusApi.getApi();

  synkronusApi.clearTokenCache();

  const res = await api.login({
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
      console.debug('Token retrieved from AsyncStorage.');
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

    console.log('🔄 Attempting auto-login with stored credentials');
    const userInfo = await login(credentials.username, credentials.password);
    console.log('✅ Auto-login successful - token refreshed');
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
