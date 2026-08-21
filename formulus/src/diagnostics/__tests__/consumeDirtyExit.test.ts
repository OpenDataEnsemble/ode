import AsyncStorage from '@react-native-async-storage/async-storage';
import { consumePendingDirtyExit, SHOWN_EXIT_KEY } from '../consumeDirtyExit';
import {
  configureDiagnosticLog,
  resetDiagnosticLogForTests,
  writeSession,
} from '../DiagnosticLog';
import { createMemoryFs } from '../memoryFs';

jest.mock('react-native', () => ({
  NativeModules: {},
  Platform: { OS: 'ios' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('consumePendingDirtyExit', () => {
  beforeEach(() => {
    resetDiagnosticLogForTests();
    configureDiagnosticLog({
      fs: createMemoryFs(),
      documentDirectoryPath: '/docs',
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns a heartbeat dirty exit when the last session died in the foreground', async () => {
    await writeSession({
      startedAt: '2026-08-16T09:00:00.000Z',
      appState: 'active',
      cleanExit: false,
    });
    const dirty = await consumePendingDirtyExit();
    expect(dirty).toEqual({
      source: 'heartbeat',
      timestamp: '2026-08-16T09:00:00.000Z',
      reason: 'the app closed unexpectedly',
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      SHOWN_EXIT_KEY,
      '2026-08-16T09:00:00.000Z',
    );
  });

  it('does not popup after a background kill', async () => {
    await writeSession({
      startedAt: '2026-08-16T09:00:00.000Z',
      appState: 'background',
      cleanExit: true,
    });
    await expect(consumePendingDirtyExit()).resolves.toBeNull();
  });
});
