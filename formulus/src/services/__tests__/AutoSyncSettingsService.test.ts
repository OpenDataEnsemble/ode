import ProfileStorage from '../../profiles/ProfileStorage';
import {
  AUTO_SYNC_INTERVALS,
  DEFAULT_AUTO_SYNC_SETTINGS,
  loadAutoSyncSettings,
  saveAutoSyncSettings,
} from '../AutoSyncSettingsService';

jest.mock('../../profiles/ProfileStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockedProfileStorage = ProfileStorage as jest.Mocked<
  typeof ProfileStorage
>;

describe('AutoSyncSettingsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('defaults to disabled with a five minute interval', async () => {
    mockedProfileStorage.getItem.mockResolvedValue(null);

    await expect(loadAutoSyncSettings()).resolves.toEqual({
      enabled: false,
      intervalMs: 5 * 60_000,
    });
  });

  test('supports the configured auto-sync intervals', () => {
    expect(AUTO_SYNC_INTERVALS).toEqual([
      30_000,
      2 * 60_000,
      5 * 60_000,
      15 * 60_000,
      60 * 60_000,
      24 * 60 * 60_000,
    ]);
  });

  test('loads saved settings', async () => {
    mockedProfileStorage.getItem.mockResolvedValue(
      JSON.stringify({
        enabled: true,
        intervalMs: 2 * 60_000,
      }),
    );

    await expect(loadAutoSyncSettings()).resolves.toEqual({
      enabled: true,
      intervalMs: 2 * 60_000,
    });
  });

  test('falls back to defaults for malformed settings', async () => {
    mockedProfileStorage.getItem.mockResolvedValue('not-json');

    await expect(loadAutoSyncSettings()).resolves.toEqual(
      DEFAULT_AUTO_SYNC_SETTINGS,
    );
  });

  test('falls back to the default interval for unsupported values', async () => {
    mockedProfileStorage.getItem.mockResolvedValue(
      JSON.stringify({
        enabled: true,
        intervalMs: 1234,
      }),
    );

    await expect(loadAutoSyncSettings()).resolves.toEqual({
      enabled: true,
      intervalMs: 5 * 60_000,
    });
  });

  test('saves settings through profile-scoped storage', async () => {
    mockedProfileStorage.setItem.mockResolvedValue();

    await saveAutoSyncSettings({
      enabled: true,
      intervalMs: 15 * 60_000,
    });

    expect(mockedProfileStorage.setItem).toHaveBeenCalledWith(
      '@auto_sync_settings',
      JSON.stringify({
        enabled: true,
        intervalMs: 15 * 60_000,
      }),
    );
  });
});
