import { synkronusApi } from './index'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const login = async (username: string, password: string) => {
    console.log('Logging in with', username, password)
    const api = await synkronusApi.getApi()

    const res = await api.login({
        loginRequest: { username, password },
    })

    const { token, refreshToken, expiresAt } = res.data

    await AsyncStorage.setItem('@token', token)
    await AsyncStorage.setItem('@refreshToken', refreshToken)
    await AsyncStorage.setItem('@tokenExpiresAt', expiresAt.toString())

    return true
}

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
    refreshTokenRequest: { refreshToken: (await AsyncStorage.getItem('@refreshToken')) ?? '' },
  });
  const { token, refreshToken, expiresAt } = res.data;
  await AsyncStorage.setItem('@token', token);
  await AsyncStorage.setItem('@refreshToken', refreshToken);
  await AsyncStorage.setItem('@tokenExpiresAt', expiresAt.toString());
  return true;
}