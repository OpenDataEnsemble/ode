import {
  formatCountProgress,
  syncProgressPercent,
  syncProgressPhaseTitle,
} from '../syncProgress';

describe('syncProgress', () => {
  it('formats count progress', () => {
    expect(formatCountProgress(3, 10)).toBe('3 of 10');
    expect(formatCountProgress(0, 0)).toBe('');
  });

  it('returns null percent when indeterminate', () => {
    expect(
      syncProgressPercent({
        phase: 'pull_observations',
        current: 0,
        total: 0,
        indeterminate: true,
      }),
    ).toBeNull();
  });

  it('computes percent for attachment steps', () => {
    expect(
      syncProgressPercent({
        phase: 'pull_attachments',
        current: 5,
        total: 10,
      }),
    ).toBe(50);
  });

  it('titles phases for UI', () => {
    expect(syncProgressPhaseTitle('pull_attachments')).toBe(
      'Downloading attachments',
    );
    expect(syncProgressPhaseTitle('app_bundle')).toBe('Updating forms');
  });
});
