import type { SyncProgress, SyncProgressPhase } from './syncProgress';
import {
  syncProgressPercent,
  syncProgressPhaseTitle,
} from './syncProgress';

const ATTACHMENT_PHASES: SyncProgressPhase[] = [
  'pull_attachments',
  'push_attachments',
];

/** User-facing details; maps legacy "records" copy to "observations" for pull only. */
export function getSyncProgressDetailsForDisplay(
  progress: SyncProgress,
): string | undefined {
  const raw = progress.details?.trim();
  if (!raw) {
    return undefined;
  }
  if (progress.phase === 'pull_observations') {
    return raw
      .replace(/\brecords downloaded\b/gi, 'observations downloaded')
      .replace(/\brecords\b/gi, 'observations');
  }
  return raw;
}

export function shouldShowSyncProgressPercent(progress: SyncProgress): boolean {
  if (ATTACHMENT_PHASES.includes(progress.phase)) {
    return false;
  }
  if (progress.phase === 'app_bundle') {
    return false;
  }
  if (progress.indeterminate) {
    return false;
  }
  return syncProgressPercent(progress) != null;
}

export function shouldShowSyncProgressCurrentItem(
  progress: SyncProgress,
): boolean {
  if (
    ATTACHMENT_PHASES.includes(progress.phase) ||
    progress.phase === 'app_bundle'
  ) {
    return false;
  }
  return Boolean(progress.currentItem?.trim());
}

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
