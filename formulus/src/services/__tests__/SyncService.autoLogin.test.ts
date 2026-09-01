/**
 * @format
 */

// Mock all native modules BEFORE any imports
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
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    requestAuthorization: jest.fn(),
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
    stopObserving: jest.fn(),
  },
}));
jest.mock('react-native-permissions', () => ({
  check: jest.fn().mockResolvedValue('granted'),
  request: jest.fn().mockResolvedValue('granted'),
  PERMISSIONS: {
    IOS: {
      LOCATION_WHEN_IN_USE: 'ios.LOCATION_WHEN_IN_USE',
      LOCATION_ALWAYS: 'ios.LOCATION_ALWAYS',
    },
    ANDROID: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_BACKGROUND_LOCATION:
        'android.permission.ACCESS_BACKGROUND_LOCATION',
    },
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    LIMITED: 'limited',
    GRANTED: 'granted',
    BLOCKED: 'blocked',
  },
}));
jest.mock('../../webview/FormulusMessageHandlers', () => ({
  appEvents: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
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
jest.mock('../../services/ClientIdService', () => ({
  clientIdService: {
    getClientId: jest.fn().mockResolvedValue('test-client-id'),
  },
}));
jest.mock('../../api/synkronus', () => ({
  synkronusApi: {
    syncObservations: jest.fn(),
    getManifest: jest.fn(),
    downloadAndInstallBundleZip: jest.fn(),
    downloadFormSpecs: jest.fn(),
    downloadAppFiles: jest.fn(),
    removeAppBundleFiles: jest.fn(),
    clearTokenCache: jest.fn(),
  },
}));
jest.mock('../../api/synkronus/Auth', () => {
  const actual = jest.requireActual(
    '../../api/synkronus/Auth',
  ) as typeof import('../../api/synkronus/Auth');
  return {
    ...actual,
    autoLogin: jest.fn(),
    isUnauthorizedError: jest.fn(),
  };
});
jest.mock('../NotificationService', () => ({
  notificationService: {
    showSyncProgress: jest.fn().mockResolvedValue(undefined),
    showSyncComplete: jest.fn().mockResolvedValue(undefined),
    clearAllSyncNotifications: jest.fn().mockResolvedValue(undefined),
    showSyncCanceled: jest.fn().mockResolvedValue(undefined),
    startForegroundService: jest.fn().mockResolvedValue(undefined),
    stopForegroundService: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../FormService', () => ({
  FormService: {
    getInstance: jest.fn().mockResolvedValue({
      invalidateCache: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));
jest.mock('../FormLocaleIndexService', () => ({
  formLocaleIndexService: {
    refreshIndex: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock('../ObservationIndexService', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      rebuildForBundleUpdate: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { SyncService } from '../SyncService';
import { synkronusApi } from '../../api/synkronus';
import { autoLogin, isUnauthorizedError } from '../../api/synkronus/Auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '../NotificationService';

describe('SyncService - Auto-Login Integration', () => {
  let syncService: SyncService;

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
    // Get a fresh instance for each test
    syncService = SyncService.getInstance();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('0');
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    syncService.clearAllSubscriptions();
  });

  describe('withAutoLoginRetry - syncObservations', () => {
    test('should retry syncObservations after auto-login on 401 error', async () => {
      const mockUserInfo = {
        username: 'testuser',
        role: 'read-write' as const,
      };
      const mockFinalVersion = 123;

      // First call fails with 401, second succeeds
      (synkronusApi.syncObservations as jest.Mock)
        .mockRejectedValueOnce({
          response: { status: 401 },
          message: 'Unauthorized',
        })
        .mockResolvedValueOnce({
          version: mockFinalVersion,
          pendingAttachmentDownloads: 0,
          pendingAttachmentUploads: 0,
        });

      (isUnauthorizedError as jest.Mock).mockReturnValue(true);
      (autoLogin as jest.Mock).mockResolvedValue(mockUserInfo);
      (synkronusApi.clearTokenCache as jest.Mock).mockReturnValue(undefined);

      const result = await syncService.syncObservations(false);

      expect(isUnauthorizedError).toHaveBeenCalled();
      expect(autoLogin).toHaveBeenCalledTimes(1);
      expect(synkronusApi.clearTokenCache).toHaveBeenCalled();
      expect(synkronusApi.syncObservations).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockFinalVersion);
      expect(notificationService.showSyncComplete).toHaveBeenCalledWith({
        kind: 'success',
      });
    });

    test('should throw error if auto-login fails', async () => {
      const error401 = { response: { status: 401 }, message: 'Unauthorized' };

      (synkronusApi.syncObservations as jest.Mock).mockRejectedValue(error401);
      (isUnauthorizedError as jest.Mock).mockReturnValue(true);
      (autoLogin as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials'),
      );

      await expect(syncService.syncObservations(false)).rejects.toThrow(
        'Authentication failed: Invalid credentials',
      );

      expect(autoLogin).toHaveBeenCalledTimes(1);
      expect(synkronusApi.syncObservations).toHaveBeenCalledTimes(1);
    });

    test('should throw error if no credentials available', async () => {
      const error401 = { response: { status: 401 }, message: 'Unauthorized' };

      (synkronusApi.syncObservations as jest.Mock).mockRejectedValue(error401);
      (isUnauthorizedError as jest.Mock).mockReturnValue(true);
      (autoLogin as jest.Mock).mockResolvedValue(null);

      await expect(syncService.syncObservations(false)).rejects.toThrow(
        'No stored credentials found. Please login manually in Settings.',
      );

      expect(autoLogin).toHaveBeenCalledTimes(1);
    });

    test('should prevent infinite retry loops', async () => {
      const error401 = { response: { status: 401 }, message: 'Unauthorized' };
      const mockUserInfo = {
        username: 'testuser',
        role: 'read-write' as const,
      };

      // Both calls fail with 401
      (synkronusApi.syncObservations as jest.Mock).mockRejectedValue(error401);
      (isUnauthorizedError as jest.Mock).mockReturnValue(true);
      (autoLogin as jest.Mock).mockResolvedValue(mockUserInfo);
      (synkronusApi.clearTokenCache as jest.Mock).mockReturnValue(undefined);

      await expect(syncService.syncObservations(false)).rejects.toThrow(
        'Authentication failed after auto-login. Please login manually in Settings.',
      );

      // Should only retry once, then stop
      expect(autoLogin).toHaveBeenCalledTimes(1);
      expect(synkronusApi.syncObservations).toHaveBeenCalledTimes(2);
    });

    test('should pass through non-401 errors without retry', async () => {
      const error404 = { response: { status: 404 }, message: 'Not Found' };

      (synkronusApi.syncObservations as jest.Mock).mockRejectedValue(error404);
      (isUnauthorizedError as jest.Mock).mockReturnValue(false);

      await expect(syncService.syncObservations(false)).rejects.toEqual(
        error404,
      );

      expect(autoLogin).not.toHaveBeenCalled();
      expect(synkronusApi.syncObservations).toHaveBeenCalledTimes(1);
      expect(notificationService.showSyncComplete).toHaveBeenCalledWith({
        kind: 'failed',
        error: expect.any(String),
      });
    });

    test('should report partial success when attachments remain pending', async () => {
      (synkronusApi.syncObservations as jest.Mock).mockResolvedValue({
        version: 55,
        pendingAttachmentDownloads: 2,
        pendingAttachmentUploads: 1,
      });

      const result = await syncService.syncObservations(true);

      expect(result).toBe(55);
      expect(notificationService.showSyncComplete).toHaveBeenCalledWith({
        kind: 'partial_success',
        pendingAttachments: 3,
      });
    });

    test('should report cancelled outcome when sync is cancelled', async () => {
      (synkronusApi.syncObservations as jest.Mock).mockImplementation(
        async (
          _includeAttachments: boolean,
          options: { isCancelled?: () => boolean },
        ) => {
          syncService.cancelSync();
          if (options?.isCancelled?.()) {
            throw new Error('Sync cancelled');
          }
          return {
            version: 1,
            pendingAttachmentDownloads: 0,
            pendingAttachmentUploads: 0,
          };
        },
      );

      await expect(syncService.syncObservations(true)).rejects.toThrow(
        'Sync cancelled',
      );
      expect(notificationService.showSyncComplete).toHaveBeenCalledWith({
        kind: 'cancelled',
      });
    });
  });

  describe('withAutoLoginRetry - updateAppBundle', () => {
    test('should retry getManifest after auto-login on 401 error', async () => {
      const mockUserInfo = {
        username: 'testuser',
        role: 'read-write' as const,
      };
      const mockManifest = { version: '1.0.0', files: [] };

      (synkronusApi.getManifest as jest.Mock)
        .mockRejectedValueOnce({
          response: { status: 401 },
          message: 'Unauthorized',
        })
        .mockResolvedValue(mockManifest);

      (synkronusApi.downloadAndInstallBundleZip as jest.Mock).mockResolvedValue(
        undefined,
      );

      (isUnauthorizedError as jest.Mock).mockReturnValue(true);
      (autoLogin as jest.Mock).mockResolvedValue(mockUserInfo);
      (synkronusApi.clearTokenCache as jest.Mock).mockReturnValue(undefined);

      await syncService.updateAppBundle();

      expect(autoLogin).toHaveBeenCalledTimes(1);
      expect(synkronusApi.getManifest).toHaveBeenCalledTimes(2);
      expect(synkronusApi.downloadAndInstallBundleZip).toHaveBeenCalledTimes(1);
    });

    test('should retry downloadAndInstallBundleZip after auto-login on 401 error', async () => {
      const mockUserInfo = {
        username: 'testuser',
        role: 'read-write' as const,
      };
      const mockManifest = { version: '1.0.0', files: [] };

      (synkronusApi.getManifest as jest.Mock).mockResolvedValue(mockManifest);
      (synkronusApi.downloadAndInstallBundleZip as jest.Mock)
        .mockRejectedValueOnce({
          response: { status: 401 },
          message: 'Unauthorized',
        })
        .mockResolvedValueOnce(undefined);

      (isUnauthorizedError as jest.Mock).mockReturnValue(true);
      (autoLogin as jest.Mock).mockResolvedValue(mockUserInfo);
      (synkronusApi.clearTokenCache as jest.Mock).mockReturnValue(undefined);

      await syncService.updateAppBundle();

      expect(autoLogin).toHaveBeenCalledTimes(1);
      expect(synkronusApi.downloadAndInstallBundleZip).toHaveBeenCalledTimes(2);
    });
  });

  describe('withAutoLoginRetry - checkForUpdates', () => {
    test('should retry getManifest after auto-login on 401 error', async () => {
      const mockUserInfo = {
        username: 'testuser',
        role: 'read-write' as const,
      };
      const mockManifest = { version: '1', files: [] };

      (synkronusApi.getManifest as jest.Mock)
        .mockRejectedValueOnce({
          response: { status: 401 },
          message: 'Unauthorized',
        })
        .mockResolvedValueOnce(mockManifest);

      (isUnauthorizedError as jest.Mock).mockReturnValue(true);
      (autoLogin as jest.Mock).mockResolvedValue(mockUserInfo);
      (synkronusApi.clearTokenCache as jest.Mock).mockReturnValue(undefined);

      const result = await syncService.checkForUpdates();

      expect(autoLogin).toHaveBeenCalledTimes(1);
      expect(synkronusApi.getManifest).toHaveBeenCalledTimes(2);
      expect(result).toBe(true); // Update available (version changed from '0')
    });
  });

  describe('cancel while a pull is in flight', () => {
    test('rejects a second start until the cancelled run has finished', async () => {
      let sawCancel = (_options: { isCancelled?: () => boolean }) => {};
      const started = new Promise<{ isCancelled?: () => boolean }>(resolve => {
        sawCancel = resolve;
      });

      (isUnauthorizedError as jest.Mock).mockReturnValue(false);
      (synkronusApi.syncObservations as jest.Mock).mockImplementation(
        (_include: boolean, options: { isCancelled?: () => boolean }) => {
          sawCancel(options);
          return new Promise((_resolve, reject) => {
            const id = setInterval(() => {
              if (options.isCancelled?.()) {
                clearInterval(id);
                reject(new Error('Sync cancelled'));
              }
            }, 5);
          });
        },
      );

      const first = syncService.syncObservations(true);
      await started;
      expect(syncService.getIsSyncing()).toBe(true);

      syncService.cancelSync();
      await expect(syncService.syncObservations(true)).rejects.toThrow(
        'Sync already in progress',
      );

      await expect(first).rejects.toThrow('Sync cancelled');
      expect(syncService.getIsSyncing()).toBe(false);

      (synkronusApi.syncObservations as jest.Mock).mockResolvedValueOnce({
        version: 7,
        pendingAttachmentDownloads: 0,
        pendingAttachmentUploads: 0,
      });
      await expect(syncService.syncObservations(true)).resolves.toBe(7);
    });
  });
});
