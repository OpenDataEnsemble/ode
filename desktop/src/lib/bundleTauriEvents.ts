import type { BundleApplyProgressPayload } from '../types/domain';

let pipelineRegistered = false;

export type BundleApplyProgressHandler = (
  p: BundleApplyProgressPayload,
) => void;

let applyProgressHandler: BundleApplyProgressHandler | null = null;
let indexRebuildHandler: BundleApplyProgressHandler | null = null;

export type IndexRebuildStoreCallbacks = {
  setBundleActivity: (activity: {
    jobId: string;
    statusText: string;
    done: number;
    total: number;
  }) => void;
  clearBundleActivity: () => void;
  onCompleted?: () => void;
};

export function createIndexRebuildStoreHandler(
  callbacks: IndexRebuildStoreCallbacks,
): BundleApplyProgressHandler {
  const { setBundleActivity, clearBundleActivity, onCompleted } = callbacks;
  return p => {
    if (p.phase === 'completed') {
      onCompleted?.();
      clearBundleActivity();
      return;
    }
    if (p.phase === 'failed') {
      setBundleActivity({
        jobId: p.jobId,
        statusText: bundleBannerLineFromProgress(p),
        done: p.done,
        total: p.total,
      });
      return;
    }
    setBundleActivity({
      jobId: p.jobId,
      statusText: bundleBannerLineFromProgress(p),
      done: p.done,
      total: p.total,
    });
  };
}

export function installGlobalIndexRebuildListener(
  callbacks: IndexRebuildStoreCallbacks,
): () => void {
  setBundleIndexRebuildHandler(createIndexRebuildStoreHandler(callbacks));
  return () => setBundleIndexRebuildHandler(null);
}

export function setBundleApplyProgressHandler(
  handler: BundleApplyProgressHandler | null,
) {
  applyProgressHandler = handler;
}

export function setBundleIndexRebuildHandler(
  handler: BundleApplyProgressHandler | null,
) {
  indexRebuildHandler = handler;
}

export function bundleBannerLineFromProgress(
  p: BundleApplyProgressPayload,
): string {
  const base = p.message.trimEnd();
  if (p.detail?.trim()) {
    return `${base} — ${p.detail.trim()}`;
  }
  if (p.total > 0 && p.phase !== 'completed' && p.phase !== 'failed') {
    return `${base} (${p.done}/${p.total})`;
  }
  return base;
}

export async function ensureBundleApplyEventPipeline(): Promise<void> {
  if (pipelineRegistered) {
    return;
  }
  pipelineRegistered = true;
  const { listen } = await import('@tauri-apps/api/event');
  await listen<BundleApplyProgressPayload>('bundle/apply-progress', e => {
    applyProgressHandler?.(e.payload);
  });
  await listen<BundleApplyProgressPayload>('bundle/index-rebuild', e => {
    indexRebuildHandler?.(e.payload);
  });
}
