/// <reference types="jest" />

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockRNFS = {
  DocumentDirectoryPath: '/mock/doc',
  CachesDirectoryPath: '/mock/cache',
  exists: jest.fn() as jest.MockedFunction<(path: string) => Promise<boolean>>,
  mkdir: jest.fn() as jest.MockedFunction<(path: string) => Promise<void>>,
  moveFile: jest.fn() as jest.MockedFunction<
    (src: string, dst: string) => Promise<void>
  >,
  unlink: jest.fn() as jest.MockedFunction<(path: string) => Promise<void>>,
  getFSInfo: jest.fn() as jest.MockedFunction<
    () => Promise<{ freeSpace: number; totalSpace: number }>
  >,
};
jest.mock('react-native-fs', () => mockRNFS);

const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};
jest.mock('../../../diagnostics/logger', () => ({ logger: mockLogger }));

const {
  assertFreeSpace,
  commitBundleStagingAtomic,
  recoverInterruptedBundleCommit,
  requiredBytesForExtract,
  BUNDLE_EXTRACT_SIZE_FACTOR,
  BUNDLE_EXTRACT_SAFETY_BYTES,
} = require('../bundleInstall') as typeof import('../bundleInstall');

const {
  InsufficientStorageError,
  isInsufficientStorageError,
  asInsufficientStorageError,
  APP_BUNDLE_INSUFFICIENT_STORAGE_USER_MESSAGE,
} =
  require('../../../errors/InsufficientStorageError') as typeof import('../../../errors/InsufficientStorageError');

describe('requiredBytesForExtract', () => {
  it('applies extract factor and safety margin', () => {
    expect(requiredBytesForExtract(1000)).toBe(
      Math.ceil(1000 * BUNDLE_EXTRACT_SIZE_FACTOR) +
        BUNDLE_EXTRACT_SAFETY_BYTES,
    );
  });
});

describe('isInsufficientStorageError', () => {
  it('detects InsufficientStorageError instances', () => {
    expect(isInsufficientStorageError(new InsufficientStorageError())).toBe(
      true,
    );
  });

  it('detects ENOSPC-style messages and codes', () => {
    expect(
      isInsufficientStorageError(new Error('ENOSPC: no space left on device')),
    ).toBe(true);
    expect(
      isInsufficientStorageError({
        code: 'ENOSPC',
        message: 'write failed',
      }),
    ).toBe(true);
    expect(isInsufficientStorageError(new Error('network timeout'))).toBe(
      false,
    );
  });
});

describe('asInsufficientStorageError', () => {
  it('wraps native space errors', () => {
    const wrapped = asInsufficientStorageError(
      new Error('No space left on device'),
    );
    expect(wrapped).toBeInstanceOf(InsufficientStorageError);
    expect(wrapped.message).toBe(APP_BUNDLE_INSUFFICIENT_STORAGE_USER_MESSAGE);
  });

  it('passes through unrelated errors', () => {
    const original = new Error('HTTP 500');
    expect(asInsufficientStorageError(original)).toBe(original);
  });
});

describe('assertFreeSpace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when free space is below the requirement', async () => {
    mockRNFS.getFSInfo.mockResolvedValue({
      freeSpace: 100,
      totalSpace: 1000,
    });
    await expect(assertFreeSpace(500, 'test')).rejects.toBeInstanceOf(
      InsufficientStorageError,
    );
  });

  it('resolves when enough space is available', async () => {
    mockRNFS.getFSInfo.mockResolvedValue({
      freeSpace: 10_000,
      totalSpace: 20_000,
    });
    await expect(assertFreeSpace(500, 'test')).resolves.toBeUndefined();
  });

  it('continues when getFSInfo fails', async () => {
    mockRNFS.getFSInfo.mockRejectedValue(new Error('unsupported'));
    await expect(assertFreeSpace(500, 'test')).resolves.toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});

describe('commitBundleStagingAtomic', () => {
  const stagingRoot = '/mock/doc/bundle_staging';
  const appDir = '/mock/doc/app';
  const formsDir = '/mock/doc/forms';
  const previousRoot = '/mock/doc/bundle_previous';

  beforeEach(() => {
    jest.clearAllMocks();
    mockRNFS.mkdir.mockResolvedValue(undefined);
    mockRNFS.moveFile.mockResolvedValue(undefined);
    mockRNFS.unlink.mockResolvedValue(undefined);
  });

  it('moves live aside then installs staging without deleting live first', async () => {
    const existing = new Set([
      stagingRoot,
      `${stagingRoot}/app`,
      `${stagingRoot}/forms`,
      appDir,
      formsDir,
    ]);
    mockRNFS.exists.mockImplementation(async (p: string) => existing.has(p));
    mockRNFS.mkdir.mockImplementation(async (p: string) => {
      existing.add(p);
    });
    mockRNFS.moveFile.mockImplementation(async (src: string, dst: string) => {
      existing.delete(src);
      existing.add(dst);
    });
    mockRNFS.unlink.mockImplementation(async (p: string) => {
      existing.delete(p);
    });

    await commitBundleStagingAtomic({
      stagingRoot,
      appDir,
      formsDir,
      previousRoot,
    });

    expect(mockRNFS.moveFile).toHaveBeenCalledWith(
      appDir,
      `${previousRoot}/app`,
    );
    expect(mockRNFS.moveFile).toHaveBeenCalledWith(
      formsDir,
      `${previousRoot}/forms`,
    );
    expect(mockRNFS.moveFile).toHaveBeenCalledWith(
      `${stagingRoot}/app`,
      appDir,
    );
    expect(mockRNFS.moveFile).toHaveBeenCalledWith(
      `${stagingRoot}/forms`,
      formsDir,
    );
    // Live dirs must never be unlinked before the rename-aside.
    expect(mockRNFS.unlink).not.toHaveBeenCalledWith(appDir);
    expect(mockRNFS.unlink).not.toHaveBeenCalledWith(formsDir);
    expect(mockRNFS.unlink).toHaveBeenCalledWith(previousRoot);
    expect(mockRNFS.unlink).toHaveBeenCalledWith(stagingRoot);
  });

  it('restores the previous live bundle when install move fails', async () => {
    const existing = new Set([
      `${stagingRoot}/app`,
      `${stagingRoot}/forms`,
      appDir,
      formsDir,
    ]);
    mockRNFS.exists.mockImplementation(async (p: string) => existing.has(p));
    mockRNFS.moveFile.mockImplementation(async (src: string, dst: string) => {
      if (src === `${stagingRoot}/app`) {
        throw new Error('No space left on device');
      }
      existing.delete(src);
      existing.add(dst);
    });
    mockRNFS.unlink.mockImplementation(async (p: string) => {
      existing.delete(p);
    });

    await expect(
      commitBundleStagingAtomic({
        stagingRoot,
        appDir,
        formsDir,
        previousRoot,
      }),
    ).rejects.toBeInstanceOf(InsufficientStorageError);

    // Live app restored from previous.
    expect(existing.has(appDir)).toBe(true);
    expect(existing.has(formsDir)).toBe(true);
  });
});

describe('recoverInterruptedBundleCommit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRNFS.moveFile.mockResolvedValue(undefined);
    mockRNFS.unlink.mockResolvedValue(undefined);
  });

  it('restores live dirs from bundle_previous when live is missing', async () => {
    const existing = new Set([
      '/mock/doc/bundle_previous',
      '/mock/doc/bundle_previous/app',
      '/mock/doc/bundle_previous/forms',
    ]);
    mockRNFS.exists.mockImplementation(async (p: string) => existing.has(p));
    mockRNFS.moveFile.mockImplementation(async (src: string, dst: string) => {
      existing.delete(src);
      existing.add(dst);
    });
    mockRNFS.unlink.mockImplementation(async (p: string) => {
      existing.delete(p);
    });

    await recoverInterruptedBundleCommit({ documentDir: '/mock/doc' });

    expect(existing.has('/mock/doc/app')).toBe(true);
    expect(existing.has('/mock/doc/forms')).toBe(true);
    expect(existing.has('/mock/doc/bundle_previous')).toBe(false);
  });

  it('clears leftover previous when live already exists', async () => {
    mockRNFS.exists.mockImplementation(async (p: string) =>
      [
        '/mock/doc/bundle_previous',
        '/mock/doc/bundle_previous/app',
        '/mock/doc/app',
        '/mock/doc/forms',
      ].includes(p),
    );

    await recoverInterruptedBundleCommit({ documentDir: '/mock/doc' });

    expect(mockRNFS.moveFile).not.toHaveBeenCalled();
    expect(mockRNFS.unlink).toHaveBeenCalledWith('/mock/doc/bundle_previous');
  });
});
