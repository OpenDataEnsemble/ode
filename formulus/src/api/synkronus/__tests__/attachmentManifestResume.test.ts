/// <reference types="jest" />

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native-zip-archive', () => ({
  unzip: jest.fn(),
}));

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

jest.mock('../../../database/DatabaseService', () => ({
  databaseService: {},
}));

jest.mock('../../../database/database', () => ({
  database: {},
}));

jest.mock('../../../services/ClientIdService', () => ({
  clientIdService: {
    getClientId: jest.fn(),
  },
}));

jest.mock('../generated', () => ({
  Configuration: jest.fn().mockImplementation(function Configuration(cfg) {
    Object.assign(this, cfg);
  }),
  DefaultApi: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { synkronusApi } from '..';
import { clientIdService } from '../../../services/ClientIdService';

describe('attachment manifest resume behavior', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    jest.clearAllMocks();
    storage.clear();
    storage.set(
      '@settings',
      JSON.stringify({ serverUrl: 'https://example.test' }),
    );
    storage.set('@last_attachment_version', '4');
    storage.set('@repository_generation', '7');

    (AsyncStorage.getItem as jest.Mock).mockImplementation(async key =>
      storage.has(key) ? storage.get(key) : null,
    );
    (AsyncStorage.setItem as jest.Mock).mockImplementation(
      async (key, value) => {
        storage.set(key, value);
      },
    );
    (AsyncStorage.removeItem as jest.Mock).mockImplementation(async key => {
      storage.delete(key);
    });
    jest.spyOn(clientIdService, 'getClientId').mockResolvedValue('client-1');
    jest.spyOn(synkronusApi, 'clearTokenCache').mockImplementation(() => {});
  });

  test('advances attachment cursor and defers failed downloads for future syncs', async () => {
    const api = {
      getAttachmentManifest: jest.fn().mockResolvedValue({
        data: {
          current_version: 8,
          repository_generation: 7,
          operations: [
            { operation: 'download', attachment_id: 'a-1' },
            { operation: 'download', attachment_id: 'a-2' },
          ],
        },
      }),
    };
    jest.spyOn(synkronusApi, 'getApi').mockResolvedValue(api as never);
    jest.spyOn(synkronusApi, 'getConfig').mockResolvedValue({
      basePath: 'https://example.test',
    } as never);
    const privateApi = synkronusApi as unknown as {
      downloadRawFiles: (...args: unknown[]) => Promise<unknown>;
      processAttachmentManifest: () => Promise<number>;
    };
    jest
      .spyOn(privateApi, 'downloadRawFiles')
      .mockResolvedValueOnce([
        {
          success: false,
          message: 'network error',
          filePath: '/tmp/a-1',
          bytesWritten: 0,
        },
        {
          success: true,
          message: 'ok',
          filePath: '/tmp/a-2',
          bytesWritten: 5,
        },
      ])
      .mockResolvedValueOnce([
        {
          success: true,
          message: 'ok',
          filePath: '/tmp/a-1',
          bytesWritten: 9,
        },
      ]);

    const firstPending = await privateApi.processAttachmentManifest();
    expect(firstPending).toBe(1);
    expect(storage.get('@last_attachment_version')).toBe('8');
    expect(storage.get('@deferred_attachment_downloads')).toBe(
      JSON.stringify([{ attachmentId: 'a-1', repositoryGeneration: 7 }]),
    );

    api.getAttachmentManifest.mockResolvedValueOnce({
      data: {
        current_version: 8,
        repository_generation: 7,
        operations: [],
      },
    });

    const secondPending = await privateApi.processAttachmentManifest();
    expect(secondPending).toBe(0);
    expect(storage.get('@deferred_attachment_downloads')).toBeUndefined();

    const downloadRawFiles = privateApi.downloadRawFiles as jest.Mock;
    expect(downloadRawFiles).toHaveBeenNthCalledWith(
      2,
      ['https://example.test/api/attachments/a-1'],
      expect.any(Array),
      undefined,
      expect.objectContaining({ overwrite: false, concurrency: 1 }),
    );
  });
});
