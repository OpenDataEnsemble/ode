/**
 * @format
 */

// Mock all native modules BEFORE any imports
jest.mock('react-native-keychain');
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiRemove: jest.fn(),
  },
}));
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/test/path',
  exists: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));
jest.mock(
  '../../database/DatabaseService',
  () => ({
    databaseService: {
      getLocalRepo: jest.fn(),
    },
  }),
  { virtual: true },
);
jest.mock(
  '../../services/ClientIdService',
  () => ({
    clientIdService: {
      getClientId: jest.fn().mockResolvedValue('test-client-id'),
    },
  }),
  { virtual: true },
);
jest.mock('../index', () => ({
  synkronusApi: {
    getApi: jest.fn(),
    clearTokenCache: jest.fn(),
  },
}));

import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  autoLogin,
  isUnauthorizedError,
  isVersionMismatchError,
  getVersionMismatchInfo,
  getVersionMismatchMessage,
} from '../Auth';
import { synkronusApi } from '../index';

describe('Auth - Auto-Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isUnauthorizedError', () => {
    test('should detect Axios 401 error', () => {
      const error = {
        response: { status: 401 },
      };
      expect(isUnauthorizedError(error)).toBe(true);
    });

    test('should detect direct status 401', () => {
      const error = { status: 401 };
      expect(isUnauthorizedError(error)).toBe(true);
    });

    test('should detect statusCode 401', () => {
      const error = { statusCode: 401 };
      expect(isUnauthorizedError(error)).toBe(true);
    });

    test('should detect ProblemDetail format 401', () => {
      const error = { data: { status: 401 } };
      expect(isUnauthorizedError(error)).toBe(true);
    });

    test('should detect 401 in error message', () => {
      const error = { message: 'Request failed with status code 401' };
      expect(isUnauthorizedError(error)).toBe(true);
    });

    test('should detect "unauthorized" in error message', () => {
      const error = { message: 'Unauthorized access' };
      expect(isUnauthorizedError(error)).toBe(true);
    });

    test('should detect UNAUTHORIZED error code', () => {
      const error = { code: 'UNAUTHORIZED' };
      expect(isUnauthorizedError(error)).toBe(true);
    });

    test('should return false for non-401 errors', () => {
      const error = { response: { status: 404 } };
      expect(isUnauthorizedError(error)).toBe(false);
    });

    test('should return false for null/undefined', () => {
      expect(isUnauthorizedError(null)).toBe(false);
      expect(isUnauthorizedError(undefined)).toBe(false);
    });
  });

  describe('isVersionMismatchError / getVersionMismatchMessage', () => {
    test('should detect 400 with VERSION_MISMATCH code (Axios)', () => {
      const error = {
        response: {
          status: 400,
          data: {
            code: 'VERSION_MISMATCH',
            synkronus_version: '1.0.24',
            formulus_version: '0.0.1',
          },
        },
      };
      expect(isVersionMismatchError(error)).toBe(true);
      expect(getVersionMismatchInfo(error)).toEqual({
        synkronusVersion: '1.0.24',
        formulusVersion: '0.0.1',
      });
      expect(getVersionMismatchMessage(error)).toContain('v1.0.24');
      expect(getVersionMismatchMessage(error)).toContain('v0.0.1');
    });

    test('should return false for 400 without VERSION_MISMATCH', () => {
      const error = { response: { status: 400, data: { code: 'OTHER' } } };
      expect(isVersionMismatchError(error)).toBe(false);
      expect(getVersionMismatchInfo(error)).toBeNull();
    });

    test('should return false for 401', () => {
      const error = { response: { status: 401 } };
      expect(isVersionMismatchError(error)).toBe(false);
    });

    test('getVersionMismatchMessage returns generic message when no info', () => {
      const error = { response: { status: 400, data: { code: 'VERSION_MISMATCH' } } };
      expect(getVersionMismatchMessage(error)).toContain('not supported');
    });
  });

  describe('autoLogin', () => {
    const mockCredentials = {
      username: 'testuser',
      password: 'testpass',
    };

    test('should successfully auto-login with stored credentials', async () => {
      // Mock Keychain to return credentials
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(
        mockCredentials,
      );

      // Mock AsyncStorage to return settings
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@settings') {
          return Promise.resolve(
            JSON.stringify({ serverUrl: 'https://test.server' }),
          );
        }
        return Promise.resolve(null);
      });

      // Mock the API and login response
      const mockApi = {
        login: jest.fn().mockResolvedValue({
          data: {
            token: 'new-token',
            refreshToken: 'new-refresh-token',
            expiresAt: Date.now() + 3600000,
          },
        }),
      };
      (synkronusApi.getApi as jest.Mock).mockResolvedValue(mockApi);
      (synkronusApi.clearTokenCache as jest.Mock).mockReturnValue(undefined);
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const result = await autoLogin();

      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(1);
      expect(mockApi.login).toHaveBeenCalledWith({
        loginRequest: {
          username: mockCredentials.username,
          password: mockCredentials.password,
        },
      });
      expect(result).toBeTruthy();
      expect(result?.username).toBe(mockCredentials.username);
    });

    test('should return null when no credentials are stored', async () => {
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(false);

      const result = await autoLogin();

      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(1);
      expect(synkronusApi.getApi).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test('should return null when credentials have no username', async () => {
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
        password: 'testpass',
      });

      const result = await autoLogin();

      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(1);
      expect(synkronusApi.getApi).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test('should return null when credentials have no password', async () => {
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
        username: 'testuser',
      });

      const result = await autoLogin();

      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(1);
      expect(synkronusApi.getApi).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test('should throw error when login fails', async () => {
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(
        mockCredentials,
      );

      const mockApi = {
        login: jest.fn().mockRejectedValue(new Error('Invalid credentials')),
      };
      (synkronusApi.getApi as jest.Mock).mockResolvedValue(mockApi);
      (synkronusApi.clearTokenCache as jest.Mock).mockReturnValue(undefined);

      await expect(autoLogin()).rejects.toThrow(
        'Auto-login failed: Invalid credentials. Please login manually.',
      );

      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(1);
      expect(mockApi.login).toHaveBeenCalled();
    });

    test('should handle unknown error during login', async () => {
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(
        mockCredentials,
      );

      const mockApi = {
        login: jest.fn().mockRejectedValue({}),
      };
      (synkronusApi.getApi as jest.Mock).mockResolvedValue(mockApi);
      (synkronusApi.clearTokenCache as jest.Mock).mockReturnValue(undefined);

      await expect(autoLogin()).rejects.toThrow(
        'Auto-login failed: Unknown error. Please login manually.',
      );
    });
  });
});
