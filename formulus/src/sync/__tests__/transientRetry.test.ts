import { SYNC_CANCELLED_MESSAGE } from '../../api/synkronus/downloadPool';
import { RepositoryResetRequiredError } from '../../errors/RepositoryResetRequiredError';
import { VersionMismatchError } from '../../errors/VersionMismatchError';
import {
  isTransientError,
  retryDelayMs,
  withTransientRetry,
} from '../transientRetry';

describe('isTransientError', () => {
  it('retries timeouts, resets, and 502/503', () => {
    expect(isTransientError({ code: 'ECONNABORTED', message: 'timeout' })).toBe(
      true,
    );
    expect(isTransientError({ message: 'Network Error' })).toBe(true);
    expect(isTransientError({ response: { status: 502 } })).toBe(true);
    expect(isTransientError({ response: { status: 503 } })).toBe(true);
    expect(isTransientError({ response: { status: 429 } })).toBe(true);
  });

  it('does not retry auth, version, reset, or cancel', () => {
    expect(isTransientError({ response: { status: 401 } })).toBe(false);
    expect(isTransientError({ response: { status: 409 } })).toBe(false);
    expect(isTransientError({ response: { status: 426 } })).toBe(false);
    expect(isTransientError(new Error(SYNC_CANCELLED_MESSAGE))).toBe(false);
    expect(isTransientError(new RepositoryResetRequiredError('reset', 2))).toBe(
      false,
    );
    expect(isTransientError(new VersionMismatchError('upgrade', '9'))).toBe(
      false,
    );
  });
});

describe('withTransientRetry', () => {
  it('retries a transient failure then succeeds', async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const value = await withTransientRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw { code: 'ETIMEDOUT', message: 'timeout' };
        }
        return 'ok';
      },
      {
        jitter: false,
        sleep: async ms => {
          sleeps.push(ms);
        },
      },
    );
    expect(value).toBe('ok');
    expect(calls).toBe(3);
    expect(sleeps).toEqual([2_000, 8_000]);
  });

  it('does not retry a 401', async () => {
    let calls = 0;
    await expect(
      withTransientRetry(async () => {
        calls += 1;
        throw { response: { status: 401 }, message: 'Unauthorized' };
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(calls).toBe(1);
  });

  it('aborts a backoff when sync is cancelled', async () => {
    let cancelled = false;
    await expect(
      withTransientRetry(
        async () => {
          throw { code: 'ETIMEDOUT', message: 'timeout' };
        },
        {
          jitter: false,
          isCancelled: () => cancelled,
          sleep: async () => {
            cancelled = true;
          },
        },
      ),
    ).rejects.toThrow(SYNC_CANCELLED_MESSAGE);
  });
});

describe('retryDelayMs', () => {
  it('applies 50–150% jitter', () => {
    expect(retryDelayMs(0, [2000], true, () => 0)).toBe(1000);
    expect(retryDelayMs(0, [2000], true, () => 1)).toBe(3000);
    expect(retryDelayMs(0, [2000], false)).toBe(2000);
  });
});
