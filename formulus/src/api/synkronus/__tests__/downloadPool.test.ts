import {
  failedDownloadCount,
  runWithConcurrency,
  SYNC_CANCELLED_MESSAGE,
} from '../downloadPool';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('runWithConcurrency', () => {
  it('returns results aligned to input indexes when completion order differs', async () => {
    const items = [30, 5, 15, 1];
    const results = await runWithConcurrency(items, 3, async (ms, index) => {
      await delay(ms);
      return index;
    });
    expect(results).toEqual([0, 1, 2, 3]);
  });

  it('never runs more workers than the concurrency cap', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await runWithConcurrency([1, 2, 3, 4, 5, 6], 3, async n => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(15);
      inFlight -= 1;
      return n;
    });
    expect(maxInFlight).toBe(3);
  });

  it('treats a non-positive concurrency as 1', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await runWithConcurrency([1, 2, 3], 0, async n => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await delay(10);
      inFlight -= 1;
      return n;
    });
    expect(maxInFlight).toBe(1);
  });

  it('returns an empty list without starting workers', async () => {
    const worker = jest.fn();
    await expect(runWithConcurrency([], 4, worker)).resolves.toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });

  it('stops handing out work on cancel and notifies in-flight jobs once', async () => {
    let cancelled = false;
    const onCancelInFlight = jest.fn();
    const started: number[] = [];

    const run = runWithConcurrency(
      [1, 2, 3, 4, 5, 6],
      2,
      async n => {
        started.push(n);
        await delay(30);
        if (n === 1) {
          cancelled = true;
        }
        return n;
      },
      {
        isCancelled: () => cancelled,
        onCancelInFlight,
      },
    );

    await expect(run).rejects.toThrow(SYNC_CANCELLED_MESSAGE);
    expect(onCancelInFlight).toHaveBeenCalledTimes(1);
    expect(started.length).toBeLessThan(6);
    expect(started.length).toBeGreaterThanOrEqual(2);
  });
});

describe('failedDownloadCount', () => {
  it('counts unsuccessful results', () => {
    expect(
      failedDownloadCount([
        { success: true },
        { success: false },
        { success: true },
        { success: false },
      ]),
    ).toBe(2);
  });
});
