import type { BundleApplyProgressPayload } from '../types/domain';

let pipelineRegistered = false;

export type BundleApplyProgressHandler = (
  p: BundleApplyProgressPayload,
) => void;

let applyProgressHandler: BundleApplyProgressHandler | null = null;
let indexRebuildHandler: BundleApplyProgressHandler | null = null;

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
