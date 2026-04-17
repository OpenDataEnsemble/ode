export type SyncGatewayOperation = 'login' | 'refresh' | 'pull' | 'push';

export class SyncHttpError extends Error {
  readonly status: number;
  readonly operation: SyncGatewayOperation;

  constructor(
    message: string,
    status: number,
    operation: SyncGatewayOperation,
  ) {
    super(message);
    this.name = 'SyncHttpError';
    this.status = status;
    this.operation = operation;
  }
}

export function isSyncHttpUnauthorized(error: unknown): boolean {
  return (
    error instanceof SyncHttpError &&
    (error.status === 401 || error.status === 403)
  );
}
