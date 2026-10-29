jest.mock(
  '../../profiles/ProfileRuntime',
  () => ({
    getActiveProfile: jest.fn(() => ({ id: 'profile-a' })),
  }),
  { virtual: true },
);

jest.mock('../AutoSyncSettingsService', () => ({
  loadAutoSyncSettings: jest.fn(),
}));

jest.mock('../SyncService', () => ({
  syncService: {
    getIsSyncing: jest.fn(),
    syncObservations: jest.fn(),
  },
}));

import { AppState, type AppStateStatus } from 'react-native';
import { getActiveProfile } from '../../profiles/ProfileRuntime';
import { loadAutoSyncSettings } from '../AutoSyncSettingsService';
import { syncService } from '../SyncService';
import { AutoSyncService } from '../AutoSyncService';

describe('AutoSyncService', () => {
  let appStateHandler: ((state: AppStateStatus) => void) | undefined;
  let service: AutoSyncService;

  const flushPromises = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    appStateHandler = undefined;

    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });

    Object.defineProperty(AppState, 'addEventListener', {
      configurable: true,
      value: jest.fn(
        (_event: string, handler: (state: AppStateStatus) => void) => {
          appStateHandler = handler;

          return {
            remove: jest.fn(),
          };
        },
      ),
    });

    jest
      .mocked(getActiveProfile)
      .mockReturnValue({ id: 'profile-a' } as ReturnType<
        typeof getActiveProfile
      >);

    jest.mocked(loadAutoSyncSettings).mockResolvedValue({
      enabled: true,
      intervalMs: 5 * 60 * 1000,
    });

    jest.mocked(syncService.getIsSyncing).mockReturnValue(false);
    jest.mocked(syncService.syncObservations).mockResolvedValue(1);

    service = AutoSyncService.getInstance();
    service.stop();
  });

  afterEach(() => {
    service.stop();
    jest.useRealTimers();
  });

  const startActiveService = async (): Promise<void> => {
    service.start();

    // Drive the singleton through its public AppState lifecycle so every
    // test begins from a known foreground state.
    appStateHandler?.('active');

    await flushPromises();
  };

  test('does not sync immediately when started', async () => {
    await startActiveService();

    expect(syncService.syncObservations).not.toHaveBeenCalled();
  });

  test('runs a silent sync after the configured interval', async () => {
    await startActiveService();

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(syncService.syncObservations).toHaveBeenCalledWith({
      includeAttachments: false,
      silent: true,
    });
  });

  test('does not auto-sync while the app is backgrounded', async () => {
    await startActiveService();

    appStateHandler?.('background');

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(syncService.syncObservations).not.toHaveBeenCalled();
  });

  test('waits for a fresh interval after returning to foreground', async () => {
    await startActiveService();

    appStateHandler?.('background');
    appStateHandler?.('active');

    await flushPromises();

    expect(syncService.syncObservations).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(syncService.syncObservations).toHaveBeenCalledTimes(1);
  });

  test('skips a scheduled tick when another sync is running', async () => {
    jest.mocked(syncService.getIsSyncing).mockReturnValue(true);

    await startActiveService();

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(syncService.syncObservations).not.toHaveBeenCalled();
  });

  test('does not sync the old profile after the active profile changes', async () => {
    await startActiveService();

    jest
      .mocked(getActiveProfile)
      .mockReturnValue({ id: 'profile-b' } as ReturnType<
        typeof getActiveProfile
      >);

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(syncService.syncObservations).not.toHaveBeenCalled();
  });
});
