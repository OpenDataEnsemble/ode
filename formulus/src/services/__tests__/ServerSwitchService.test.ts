/// <reference types="jest" />

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockDatabase = {
  write: jest.fn(async (cb?: () => Promise<void> | void) => {
    if (cb) {
      await cb();
    }
  }),
  unsafeResetDatabase: jest.fn(),
};

jest.mock('../../database/database', () => ({
  database: mockDatabase,
}));

const mockLocalRepo = { getPendingChanges: jest.fn() };
jest.mock('../../database/DatabaseService', () => ({
  databaseService: {
    getLocalRepo: jest.fn(() => mockLocalRepo),
  },
}));

const mockAsyncStorage = {
  multiRemove: jest.fn(),
  setItem: jest.fn(),
};
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

const mockRNFS = {
  DocumentDirectoryPath: '/mock/doc',
  exists: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
};
jest.mock('react-native-fs', () => mockRNFS);

const mockSynkronusApi = {
  removeAppBundleFiles: jest.fn(),
  getUnsyncedAttachmentCount: jest.fn(),
};
jest.mock('../../api/synkronus', () => ({
  synkronusApi: mockSynkronusApi,
}));

const mockLogout = jest.fn(() => Promise.resolve());
jest.mock('../../api/synkronus/Auth', () => ({
  logout: mockLogout,
}));

const mockServerConfigService = {
  saveServerUrl: jest.fn(),
};
jest.mock('../ServerConfigService', () => ({
  serverConfigService: mockServerConfigService,
}));

const mockIndexReset = jest.fn();
jest.mock('../ObservationIndexService', () => ({
  __esModule: true,
  default: { getInstance: jest.fn(() => ({ reset: mockIndexReset })) },
}));

const { serverSwitchService } = require('../ServerSwitchService');

describe('ServerSwitchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resets local state and saves new server URL', async () => {
    mockRNFS.exists.mockResolvedValueOnce(true);

    await serverSwitchService.resetForServerChange('https://new.example');

    expect(mockRNFS.exists).toHaveBeenCalledWith('/mock/doc/attachments');
    expect(mockRNFS.unlink).toHaveBeenCalledWith('/mock/doc/attachments');
    expect(mockRNFS.mkdir).toHaveBeenCalledWith('/mock/doc/attachments');
    expect(mockRNFS.mkdir).toHaveBeenCalledWith('/mock/doc/attachments/synced');
    expect(mockRNFS.mkdir).toHaveBeenCalledWith(
      '/mock/doc/attachments/pending',
    );
    expect(mockRNFS.mkdir).toHaveBeenCalledWith('/mock/doc/attachments/draft');

    expect(mockSynkronusApi.removeAppBundleFiles).toHaveBeenCalled();

    expect(mockDatabase.write).toHaveBeenCalled();
    expect(mockDatabase.unsafeResetDatabase).toHaveBeenCalled();

    // The index service is a singleton and survives the database reset, so it
    // has to be told that the rebuild it remembers is gone.
    expect(mockIndexReset).toHaveBeenCalled();

    expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
      '@last_seen_version',
      '@last_attachment_version',
      '@lastSync',
      '@appVersion',
      '@settings',
      '@server_url',
      '@token',
      '@refreshToken',
      '@tokenExpiresAt',
      '@user',
    ]);
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith('@appVersion', '0');

    expect(mockLogout).toHaveBeenCalled();
    expect(mockServerConfigService.saveServerUrl).toHaveBeenCalledWith(
      'https://new.example',
    );
  });

  it('returns pending observation count', async () => {
    mockLocalRepo.getPendingChanges.mockResolvedValueOnce([1, 2, 3]);
    const result = await serverSwitchService.getPendingObservationCount();
    expect(result).toBe(3);
  });

  it('returns pending attachment count', async () => {
    mockSynkronusApi.getUnsyncedAttachmentCount.mockResolvedValueOnce(5);
    const result = await serverSwitchService.getPendingAttachmentCount();
    expect(result).toBe(5);
  });

  it('throws if attachments directory cannot be deleted', async () => {
    mockRNFS.exists.mockResolvedValueOnce(true);
    mockRNFS.unlink.mockRejectedValueOnce(new Error('permission'));

    await expect(
      serverSwitchService.resetForServerChange('https://new.example'),
    ).rejects.toThrow('Failed to delete attachments directory');

    expect(mockDatabase.write).not.toHaveBeenCalled();
  });
});
