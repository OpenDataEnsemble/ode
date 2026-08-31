import { isRepositoryResetRequiredError } from '../errors/RepositoryResetRequiredError';
import { isVersionMismatchError } from '../errors/VersionMismatchError';
import { SYNC_CANCELLED_MESSAGE } from '../api/synkronus/downloadPool';

export const TRANSIENT_RETRY_ATTEMPTS = 3;
export const TRANSIENT_RETRY_DELAYS_MS = [2_000, 8_000] as const;

type AxiosLike = {
  message?: string;
  code?: string;
  response?: { status?: number };
};

function httpStatus(error: unknown): number | undefined {
  const ax = error as AxiosLike;
  const status = ax?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

export function isCancelledError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === SYNC_CANCELLED_MESSAGE ||
      error.message === 'Sync cancelled by user')
  );
}

/**
 * Timeouts, resets, and 5xx/429 are worth retrying. Auth, version, and
 * repository-reset conflicts are not — retrying those hides the real fix.
 */
export function isTransientError(error: unknown): boolean {
  if (error == null) {
    return false;
  }
  if (isCancelledError(error)) {
    return false;
  }
  if (isRepositoryResetRequiredError(error) || isVersionMismatchError(error)) {
    return false;
  }

  const status = httpStatus(error);
  if (status != null) {
    if (
      status === 408 ||
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504
    ) {
      return true;
    }
    return false;
  }

  const ax = error as AxiosLike;
  const code = typeof ax.code === 'string' ? ax.code.toUpperCase() : '';
  if (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ERR_NETWORK' ||
    code === 'ERR_CANCELED'
  ) {
    return code !== 'ERR_CANCELED';
  }

  const message = (
    error instanceof Error ? error.message : String(ax.message ?? error)
  ).toLowerCase();
  if (message.includes('sync cancelled')) {
    return false;
  }
  return (
    message.includes('network error') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('socket') ||
    message.includes('failed to download')
  );
}

export function retryDelayMs(
  attemptIndex: number,
  delaysMs: readonly number[],
  jitter: boolean,
  random: () => number = Math.random,
): number {
  const base = delaysMs[Math.min(attemptIndex, delaysMs.length - 1)] ?? 0;
  if (!jitter) {
    return base;
  }
  return Math.round(base * (0.5 + random()));
}

export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  options?: {
    attempts?: number;
    delaysMs?: readonly number[];
    jitter?: boolean;
    isCancelled?: () => boolean;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  },
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? TRANSIENT_RETRY_ATTEMPTS);
  const delaysMs = options?.delaysMs ?? TRANSIENT_RETRY_DELAYS_MS;
  const jitter = options?.jitter !== false;
  const sleep =
    options?.sleep ??
    ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options?.isCancelled?.()) {
      throw new Error(SYNC_CANCELLED_MESSAGE);
    }
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      const hasMore = attempt < attempts - 1;
      if (!hasMore || !isTransientError(error)) {
        throw error;
      }
      const delay = retryDelayMs(attempt, delaysMs, jitter, options?.random);
      options?.onRetry?.(attempt + 1, error, delay);
      if (delay > 0) {
        await sleepWithCancel(delay, sleep, options?.isCancelled);
      }
    }
  }
  throw lastError;
}

async function sleepWithCancel(
  ms: number,
  sleep: (ms: number) => Promise<void>,
  isCancelled?: () => boolean,
): Promise<void> {
  if (!isCancelled) {
    await sleep(ms);
    return;
  }
  const step = 200;
  let waited = 0;
  while (waited < ms) {
    if (isCancelled()) {
      throw new Error(SYNC_CANCELLED_MESSAGE);
    }
    const chunk = Math.min(step, ms - waited);
    await sleep(chunk);
    waited += chunk;
  }
}
