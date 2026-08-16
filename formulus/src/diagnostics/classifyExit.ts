import type { DirtyExit, ProcessExitRecord, SessionHeartbeat } from './types';

const DIRTY_REASONS = new Set([
  'REASON_CRASH',
  'REASON_CRASH_NATIVE',
  'REASON_ANR',
  'REASON_LOW_MEMORY',
  'REASON_EXCESSIVE_RESOURCE_USAGE',
]);

/** SIGILL, SIGABRT, SIGBUS, SIGFPE, SIGSEGV */
const CRASH_SIGNALS = new Set([4, 6, 7, 8, 11]);

export function isDirtyExit(record: ProcessExitRecord): boolean {
  if (DIRTY_REASONS.has(record.reason)) {
    return true;
  }
  if (record.reason === 'REASON_SIGNALED') {
    return CRASH_SIGNALS.has(record.status ?? -1);
  }
  return false;
}

export function formatExitReason(record: ProcessExitRecord): string {
  const description = record.description?.trim();
  if (description) {
    return description;
  }
  return humanizeReason(record.reason);
}

export function humanizeReason(reason: string): string {
  return reason
    .replace(/^REASON_/, '')
    .toLowerCase()
    .replace(/_/g, ' ');
}

export function isDirtyHeartbeat(session: SessionHeartbeat | null): boolean {
  if (!session) {
    return false;
  }
  return session.cleanExit !== true && session.appState === 'active';
}

export function dirtyExitFromAei(record: ProcessExitRecord): DirtyExit {
  return {
    source: 'aei',
    timestamp: new Date(record.timestamp).toISOString(),
    reason: formatExitReason(record),
  };
}

export function dirtyExitFromHeartbeat(session: SessionHeartbeat): DirtyExit {
  return {
    source: 'heartbeat',
    timestamp: session.startedAt,
    reason: 'the app closed unexpectedly',
  };
}
