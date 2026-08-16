/**
 * Bounded async pool for attachment (and similar) downloads.
 *
 * Workers share a single-threaded index, so in-flight work never exceeds
 * `concurrency`. Cancel stops handing out new items and lets the caller abort
 * native jobs already started. The function still waits for those workers to
 * settle so we do not leak downloads, then throws `Sync cancelled`.
 */

export const SYNC_CANCELLED_MESSAGE = 'Sync cancelled';

export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  options?: {
    isCancelled?: () => boolean;
    onCancelInFlight?: () => void;
  },
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.max(
    1,
    Math.min(Math.floor(concurrency) || 1, items.length),
  );
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let cancelNotified = false;

  const cancelled = (): boolean => {
    if (!options?.isCancelled?.()) {
      return false;
    }
    if (!cancelNotified) {
      cancelNotified = true;
      options.onCancelInFlight?.();
    }
    return true;
  };

  const runWorker = async (): Promise<void> => {
    while (!cancelled()) {
      const i = nextIndex;
      if (i >= items.length) {
        return;
      }
      nextIndex += 1;
      results[i] = await worker(items[i], i);
    }
  };

  await Promise.all(Array.from({ length: limit }, () => runWorker()));

  if (cancelled()) {
    throw new Error(SYNC_CANCELLED_MESSAGE);
  }
  return results;
}

export function failedDownloadCount(
  results: ReadonlyArray<{ success: boolean }>,
): number {
  return results.reduce((n, r) => n + (r.success ? 0 : 1), 0);
}
