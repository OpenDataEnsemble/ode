/**
 * Shared sync progress model for observation sync, attachments, and app bundle.
 */

export type SyncProgressPhase =
  | 'pull_observations'
  | 'pull_attachments'
  | 'push_attachments'
  | 'push_observations'
  /** Form definitions / custom app ZIP (not observation attachments). */
  | 'app_bundle';

export interface SyncProgress {
  current: number;
  total: number;
  phase: SyncProgressPhase;
  /** Secondary line, e.g. "12 of 340". */
  details?: string;
  /** Current file or item label (attachment id / bundle step). */
  currentItem?: string;
  /** When true, UI hides a numeric percent and shows activity only. */
  indeterminate?: boolean;
}

export type SyncProgressReporter = (progress: SyncProgress) => void;

export interface SynkronusSyncOptions {
  onProgress?: SyncProgressReporter;
  isCancelled?: () => boolean;
}

export function formatCountProgress(done: number, total: number): string {
  if (total <= 0) {
    return '';
  }
  return `${Math.min(done, total)} of ${total}`;
}

export function syncProgressPercent(progress: SyncProgress): number | null {
  if (progress.indeterminate || progress.total <= 0) {
    return null;
  }
  return Math.round(
    Math.max(0, Math.min(100, (progress.current / progress.total) * 100)),
  );
}

export function syncProgressPhaseTitle(phase: SyncProgressPhase): string {
  switch (phase) {
    case 'pull_observations':
      return 'Syncing observations';
    case 'pull_attachments':
      return 'Downloading attachments';
    case 'push_attachments':
      return 'Uploading attachments';
    case 'push_observations':
      return 'Uploading changes';
    case 'app_bundle':
      return 'Updating forms';
    default:
      return 'Syncing';
  }
}
