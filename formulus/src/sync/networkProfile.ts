/**
 * Adaptive sync unit sizes. There is no enumerator-facing preset: every
 * device starts conservative and AIMDs toward the API max on a good link.
 *
 * Pull ceiling 500 is the OpenAPI max. Push ceiling stays lower because
 * uplink is worse than downlink. Both floors are 1 so a dying radio can
 * still move one row at a time.
 */

export type SyncKnobs = {
  pullPageSize: number;
  pushBatchSize: number;
  attachmentConcurrency: number;
};

export const PULL_PAGE_FLOOR = 1;
export const PULL_PAGE_CEILING = 500;
export const PULL_PAGE_START = 32;

export const PUSH_BATCH_FLOOR = 1;
export const PUSH_BATCH_CEILING = 100;
export const PUSH_BATCH_START = 4;

/** Hide the next pull RTT behind SQLite once the link has proven it can carry a large page. */
export const PREFETCH_AFTER_PULL_PAGE_SIZE = 250;

export const ATTACHMENT_DOWNLOAD_CONCURRENCY = 1;

export function clampUnitSize(
  value: number,
  floor: number,
  ceiling: number,
): number {
  if (!Number.isFinite(value)) {
    return floor;
  }
  return Math.min(ceiling, Math.max(floor, Math.floor(value)));
}

export function resolveSyncKnobs(
  adaptivePullPageSize?: number,
  adaptivePushBatchSize?: number,
): SyncKnobs {
  return {
    pullPageSize: clampUnitSize(
      adaptivePullPageSize ?? PULL_PAGE_START,
      PULL_PAGE_FLOOR,
      PULL_PAGE_CEILING,
    ),
    pushBatchSize: clampUnitSize(
      adaptivePushBatchSize ?? PUSH_BATCH_START,
      PUSH_BATCH_FLOOR,
      PUSH_BATCH_CEILING,
    ),
    attachmentConcurrency: ATTACHMENT_DOWNLOAD_CONCURRENCY,
  };
}
