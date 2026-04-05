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

import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  autoLogin,
  isUnauthorizedError,
  isVersionMismatchError,
} from '../Auth';
import { VersionMismatchError } from '../../../errors/VersionMismatchError';
import { ODE_VERSION } from '../../../version';
import { synkronusApi } from '../index';

describe('Auth - Auto-Login', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

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

  describe('isVersionMismatchError', () => {
    test('should detect VersionMismatchError instance', () => {
      const error = new VersionMismatchError(
        'Formulus v0.0.1 is not compatible with this server (v1.0.24). Please update the app.',
        '1.0.24',
      );
      expect(isVersionMismatchError(error)).toBe(true);
      expect(error.message).toContain('v1.0.24');
      expect(error.synkronusVersion).toBe('1.0.24');
    });

    test('should return false for regular Error', () => {
      const error = new Error('Some other error');
      expect(isVersionMismatchError(error)).toBe(false);
    });

    test('should return false for 401 error', () => {
      const error = { response: { status: 401 } };
      expect(isVersionMismatchError(error)).toBe(false);
    });

    test('should return false for null/undefined', () => {
      expect(isVersionMismatchError(null)).toBe(false);
      expect(isVersionMismatchError(undefined)).toBe(false);
    });

    test('VersionMismatchError uses default message when none provided', () => {
      const error = new VersionMismatchError();
      expect(error.message).toContain('not supported');
      expect(error.synkronusVersion).toBe('unknown');
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
        xOdeVersion: ODE_VERSION,
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
