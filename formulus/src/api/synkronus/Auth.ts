import {synkronusApi} from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserRole = 'read-only' | 'read-write' | 'admin';

export interface UserInfo {
  username: string;
  role: UserRole;
}

// Decode JWT payload without verification (claims are in the middle part)
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
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

  const res = await api.login({
    loginRequest: {username, password},
  });

  const {token, refreshToken, expiresAt} = res.data;

  await AsyncStorage.setItem('@token', token);
  await AsyncStorage.setItem('@refreshToken', refreshToken);
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
  const {token, refreshToken, expiresAt} = res.data;
  await AsyncStorage.setItem('@token', token);
  await AsyncStorage.setItem('@refreshToken', refreshToken);
  await AsyncStorage.setItem('@tokenExpiresAt', expiresAt.toString());
  return true;
};
