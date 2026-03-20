import { Observation } from '../database/models/Observation';

/** Ignore null / placeholder synced_at values from storage. */
export const MIN_VALID_SYNCED_AT_MS = new Date('1980-01-01').getTime();

export function hasMeaningfulSyncedAt(
  syncedAt: Date | null | undefined,
): boolean {
  return syncedAt != null && syncedAt.getTime() > MIN_VALID_SYNCED_AT_MS;
}

/**
 * True when this observation's latest local edit is included in the last successful sync
 * (same rule as getPendingChanges: pending if updated_at > synced_at).
 */
export function isObservationFullySynced(
  observation: Pick<Observation, 'syncedAt' | 'updatedAt'>,
): boolean {
  const syncedAt = observation.syncedAt;
  if (!hasMeaningfulSyncedAt(syncedAt)) {
    return false;
  }
  return observation.updatedAt.getTime() <= syncedAt.getTime();
}
