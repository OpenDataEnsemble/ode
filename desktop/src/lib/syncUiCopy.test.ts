import { describe, expect, it } from 'vitest';
import {
  failedJobRecoveryCopy,
  formatFailedSyncErrorMessage,
  isRepositoryResetSyncError,
  pushConfirmMessage,
} from './syncUiCopy';

describe('pushConfirmMessage', () => {
  it('includes the observation count and profile label', () => {
    expect(pushConfirmMessage(12, 'AnthroCollect field')).toBe(
      'Push 12 observations to AnthroCollect field?',
    );
  });

  it('uses singular observation for one row', () => {
    expect(pushConfirmMessage(1, 'Local dev')).toBe(
      'Push 1 observation to Local dev?',
    );
  });

  it('falls back when the profile label is empty', () => {
    expect(pushConfirmMessage(3, '   ')).toBe(
      'Push 3 observations to this profile?',
    );
  });
});

describe('repository reset sync copy', () => {
  it('detects code, tagged message, and legacy pull-first copy', () => {
    expect(isRepositoryResetSyncError('repository_reset_required', null)).toBe(
      true,
    );
    expect(
      isRepositoryResetSyncError(
        null,
        'repository_reset_required server_generation=4: mismatch',
      ),
    ).toBe(true);
    expect(
      isRepositoryResetSyncError(
        null,
        'Server repository was reset or upgraded. Pull first to align before pushing.',
      ),
    ).toBe(true);
    expect(isRepositoryResetSyncError('error', 'network timeout')).toBe(false);
  });

  it('strips the machine prefix for display', () => {
    expect(
      formatFailedSyncErrorMessage(
        'repository_reset_required server_generation=5: Client mismatch',
      ),
    ).toBe('Client mismatch');
  });

  it('explains Pull as the recovery instead of Discard job', () => {
    expect(
      failedJobRecoveryCopy({ failed: true, repositoryReset: true }),
    ).toContain('you do not need to discard this job first');
  });
});
