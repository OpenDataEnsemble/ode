export type SyncGatewayOperation = 'login' | 'refresh' | 'pull' | 'push';

export class SyncHttpError extends Error {
  readonly status: number;
  readonly operation: SyncGatewayOperation;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    operation: SyncGatewayOperation,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'SyncHttpError';
    this.status = status;
    this.operation = operation;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function parseRetryAfter(
  value: string | null | undefined,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

export function isSyncHttpUnauthorized(error: unknown): boolean {
  return (
    error instanceof SyncHttpError &&
    (error.status === 401 || error.status === 403)
  );
}
