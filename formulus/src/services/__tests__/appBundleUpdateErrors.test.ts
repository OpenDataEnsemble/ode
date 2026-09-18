/// <reference types="jest" />

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/doc',
  CachesDirectoryPath: '/mock/cache',
}));

jest.mock('../../api/synkronus/Auth', () => ({
  isNotFoundError: jest.fn(() => false),
  isVersionMismatchError: jest.fn(() => false),
}));

const mockGetServerUrl = jest.fn(async () => null as string | null);
const mockIsHealthEndpointOk = jest.fn(async () => false);
jest.mock('../ServerConfigService', () => ({
  serverConfigService: {
    getServerUrl: (...args: unknown[]) => mockGetServerUrl(...args),
    isHealthEndpointOk: (...args: unknown[]) => mockIsHealthEndpointOk(...args),
  },
}));

const {
  getUserFacingAppBundleUpdateErrorMessage,
  APP_BUNDLE_INSUFFICIENT_STORAGE_USER_MESSAGE,
} =
  require('../appBundleUpdateErrors') as typeof import('../appBundleUpdateErrors');

const { InsufficientStorageError } =
  require('../../errors/InsufficientStorageError') as typeof import('../../errors/InsufficientStorageError');

describe('getUserFacingAppBundleUpdateErrorMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerUrl.mockResolvedValue(null);
  });

  it('maps insufficient storage to a clear user prompt', async () => {
    const message = await getUserFacingAppBundleUpdateErrorMessage(
      new InsufficientStorageError(),
    );
    expect(message).toBe(APP_BUNDLE_INSUFFICIENT_STORAGE_USER_MESSAGE);
  });

  it('maps native ENOSPC-style errors the same way', async () => {
    const message = await getUserFacingAppBundleUpdateErrorMessage(
      new Error('ENOSPC: no space left on device'),
    );
    expect(message).toBe(APP_BUNDLE_INSUFFICIENT_STORAGE_USER_MESSAGE);
  });

  it('passes through unrelated error messages', async () => {
    const message = await getUserFacingAppBundleUpdateErrorMessage(
      new Error('Bundle zip download failed (HTTP 500)'),
    );
    expect(message).toBe('Bundle zip download failed (HTTP 500)');
  });
});
