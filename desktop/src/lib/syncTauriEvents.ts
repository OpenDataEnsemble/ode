import type { SyncProgressPayload, SyncStatePayload } from '../types/domain';

const waiters = new Map<
  string,
  { resolve: () => void; reject: (e: Error) => void }
>();

let pipelineRegistered = false;

export type SyncProgressHandler = (p: SyncProgressPayload) => void;

let progressHandler: SyncProgressHandler | null = null;

export function setCustodianSyncProgressHandler(
  handler: SyncProgressHandler | null,
) {
  progressHandler = handler;
}

export class SyncPausedError extends Error {
  readonly code?: string | null;

  constructor(code?: string | null, message?: string | null) {
    super(message ?? 'Sync paused.');
    this.name = 'SyncPausedError';
    this.code = code;
  }
}

export function registerSyncJobWaiter(jobId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    waiters.set(jobId, { resolve, reject });
  });
}

function dispatchState(p: SyncStatePayload) {
  const w = waiters.get(p.jobId);
  if (!w) {
    return;
  }
  switch (p.status) {
    case 'completed':
      waiters.delete(p.jobId);
      w.resolve();
      break;
    case 'cancelled':
      waiters.delete(p.jobId);
      w.reject(new Error(p.errorMessage ?? 'Sync cancelled.'));
      break;
    case 'failed':
      waiters.delete(p.jobId);
      w.reject(new Error(p.errorMessage ?? 'Sync failed.'));
      break;
    case 'paused':
      waiters.delete(p.jobId);
      w.reject(new SyncPausedError(p.errorCode, p.errorMessage));
      break;
    default:
      break;
  }
}

export async function ensureCustodianSyncEventPipeline(): Promise<void> {
  if (pipelineRegistered) {
    return;
  }
  pipelineRegistered = true;
  const { listen } = await import('@tauri-apps/api/event');
  await listen<SyncProgressPayload>('sync/progress', e => {
    progressHandler?.(e.payload);
  });
  await listen<SyncStatePayload>('sync/state', e => {
    dispatchState(e.payload);
  });
}
