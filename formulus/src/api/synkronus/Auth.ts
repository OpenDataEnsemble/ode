import {synkronusApi} from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'read-only' | 'read-write' | 'admin';

export interface UserInfo {
  username: string;
  role: UserRole;
}

const decodeBase64 = (input: string): string => {
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
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = decodeBase64(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
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
    loginRequest: {username, password},
  });

  const {token, refreshToken: refreshTokenValue, expiresAt} = res.data;

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
  const {token, refreshToken: refreshTokenValue, expiresAt} = res.data;
  await AsyncStorage.setItem('@token', token);
  await AsyncStorage.setItem('@refreshToken', refreshTokenValue);
  await AsyncStorage.setItem('@tokenExpiresAt', expiresAt.toString());
  return true;
};
