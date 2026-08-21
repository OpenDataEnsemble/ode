import {
  dirtyExitFromAei,
  formatExitReason,
  isDirtyExit,
  isDirtyHeartbeat,
} from '../classifyExit';

describe('classifyExit', () => {
  it('treats crash, ANR, OOM, and crash signals as dirty', () => {
    expect(isDirtyExit({ timestamp: 1, reason: 'REASON_CRASH' })).toBe(true);
    expect(isDirtyExit({ timestamp: 1, reason: 'REASON_ANR' })).toBe(true);
    expect(isDirtyExit({ timestamp: 1, reason: 'REASON_LOW_MEMORY' })).toBe(
      true,
    );
    expect(
      isDirtyExit({ timestamp: 1, reason: 'REASON_EXCESSIVE_RESOURCE_USAGE' }),
    ).toBe(true);
    expect(
      isDirtyExit({ timestamp: 1, reason: 'REASON_SIGNALED', status: 11 }),
    ).toBe(true);
  });

  it('treats user swipe-away and self-exit as garden-variety', () => {
    expect(isDirtyExit({ timestamp: 1, reason: 'REASON_USER_REQUESTED' })).toBe(
      false,
    );
    expect(isDirtyExit({ timestamp: 1, reason: 'REASON_USER_STOPPED' })).toBe(
      false,
    );
    expect(isDirtyExit({ timestamp: 1, reason: 'REASON_EXIT_SELF' })).toBe(
      false,
    );
    expect(isDirtyExit({ timestamp: 1, reason: 'REASON_FREEZER' })).toBe(false);
    expect(
      isDirtyExit({ timestamp: 1, reason: 'REASON_SIGNALED', status: 9 }),
    ).toBe(false);
  });

  it('prefers the AEI description for the popup reason', () => {
    expect(
      formatExitReason({
        timestamp: 1,
        reason: 'REASON_CRASH',
        description: 'Context.startForeground did not start in time',
      }),
    ).toBe('Context.startForeground did not start in time');
    expect(
      dirtyExitFromAei({
        timestamp: 1_700_000_000_000,
        reason: 'REASON_CRASH',
        description: 'ForegroundServiceDidNotStartInTimeException',
      }).reason,
    ).toBe('ForegroundServiceDidNotStartInTimeException');
  });

  it('marks a foreground session without cleanExit as dirty', () => {
    expect(
      isDirtyHeartbeat({
        startedAt: '2026-08-16T10:00:00.000Z',
        appState: 'active',
        cleanExit: false,
      }),
    ).toBe(true);
    expect(
      isDirtyHeartbeat({
        startedAt: '2026-08-16T10:00:00.000Z',
        appState: 'background',
        cleanExit: false,
      }),
    ).toBe(false);
    expect(
      isDirtyHeartbeat({
        startedAt: '2026-08-16T10:00:00.000Z',
        appState: 'active',
        cleanExit: true,
      }),
    ).toBe(false);
  });
});
