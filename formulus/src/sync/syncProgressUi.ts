import type { SyncProgress, SyncProgressPhase } from './syncProgress';
import { syncProgressPercent, syncProgressPhaseTitle } from './syncProgress';
import { i18n } from '../i18n/instance';

const ATTACHMENT_PHASES: SyncProgressPhase[] = [
  'pull_attachments',
  'push_attachments',
];

/** User-facing details line (already localized at report time). */
export function getSyncProgressDetailsForDisplay(
  progress: SyncProgress,
): string | undefined {
  const raw = progress.details?.trim();
  return raw || undefined;
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
      return i18n.t('sync.progress.syncingAndUpdatingForms');
    }
    return i18n.t('sync.progress.syncingAndUpdating');
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
