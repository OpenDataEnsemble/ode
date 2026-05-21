import type { SyncProgress } from './syncProgress';
import {
  syncProgressPercent,
  syncProgressPhaseTitle,
} from './syncProgress';

/** Headline for the in-app progress card (phase-specific). */
export function getSyncProgressCardTitle(
  progress: SyncProgress,
  activeOperation: 'sync' | 'update' | 'sync_then_update' | null,
): string {
  if (activeOperation === 'sync_then_update') {
    if (progress.phase === 'app_bundle') {
      return 'Syncing & updating forms';
    }
    return 'Syncing & updating';
  }
  if (activeOperation === 'update') {
    return syncProgressPhaseTitle('app_bundle');
  }
  return syncProgressPhaseTitle(progress.phase);
}

export function getSyncProgressPercentLabel(progress: SyncProgress): string {
  const pct = syncProgressPercent(progress);
  if (pct == null) {
    return '';
  }
  return `${pct}%`;
}
