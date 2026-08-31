import {
  PULL_PAGE_CEILING,
  PULL_PAGE_FLOOR,
  PUSH_BATCH_CEILING,
  PUSH_BATCH_FLOOR,
  clampUnitSize,
} from './networkProfile';
import { chunkItems } from './chunkItems';

/** Grow the next unit when the last HTTP call finished this quickly. */
export const ADAPTIVE_GROW_IF_UNDER_MS = 8_000;
/** Halve the next unit when the last HTTP call took at least this long. */
export const ADAPTIVE_SHRINK_IF_OVER_MS = 15_000;
/** Minimum additive increase on a fast unit (also used when the current size is still small). */
export const ADAPTIVE_GROW_STEP_MIN = 25;

/**
 * AIMD on unit size, not on parallelism. TCP already congestion-controls the
 * radio; extra parallel HTTP fights it.
 *
 * Shrink is multiplicative (halve) so a timeout drops us off the bad size
 * immediately. Grow is additive but proportional — `max(25, floor(current/4))`
 * — so a 32-row start reaches the 500 pull ceiling in about a dozen fast
 * pages, without jumping to 500 in one step and timing out.
 */
export function adaptiveGrowStep(
  current: number,
  minStep: number = ADAPTIVE_GROW_STEP_MIN,
): number {
  const size = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
  return Math.max(minStep, Math.floor(size / 4));
}

export function nextAdaptiveSize(
  current: number,
  durationMs: number,
  bounds: { floor: number; ceiling: number },
  options?: {
    growIfUnderMs?: number;
    shrinkIfOverMs?: number;
    growStepMin?: number;
  },
): number {
  const clamped = clampUnitSize(current, bounds.floor, bounds.ceiling);
  const growIfUnderMs = options?.growIfUnderMs ?? ADAPTIVE_GROW_IF_UNDER_MS;
  const shrinkIfOverMs = options?.shrinkIfOverMs ?? ADAPTIVE_SHRINK_IF_OVER_MS;
  const growStepMin = options?.growStepMin ?? ADAPTIVE_GROW_STEP_MIN;

  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return clamped;
  }
  if (durationMs >= shrinkIfOverMs) {
    return clampUnitSize(Math.floor(clamped / 2), bounds.floor, bounds.ceiling);
  }
  if (durationMs < growIfUnderMs) {
    return clampUnitSize(
      clamped + adaptiveGrowStep(clamped, growStepMin),
      bounds.floor,
      bounds.ceiling,
    );
  }
  return clamped;
}

export function nextAdaptivePullPageSize(
  current: number,
  durationMs: number,
): number {
  return nextAdaptiveSize(current, durationMs, {
    floor: PULL_PAGE_FLOOR,
    ceiling: PULL_PAGE_CEILING,
  });
}

export function nextAdaptivePushBatchSize(
  current: number,
  durationMs: number,
): number {
  return nextAdaptiveSize(current, durationMs, {
    floor: PUSH_BATCH_FLOOR,
    ceiling: PUSH_BATCH_CEILING,
  });
}

/** After a batch still fails following retries, drop to half (min floor). */
export function nextSizeAfterFailure(
  failedLength: number,
  floor: number = PUSH_BATCH_FLOOR,
): number {
  const n = Number.isFinite(failedLength) ? Math.floor(failedLength) : floor;
  if (n <= floor) {
    return floor;
  }
  return Math.max(floor, Math.floor(n / 2));
}

export function canSplitPushBatch(
  length: number,
  floor: number = PUSH_BATCH_FLOOR,
): boolean {
  return length > floor;
}

export function splitFailedPushBatch<T>(
  failedBatch: readonly T[],
  floor: number = PUSH_BATCH_FLOOR,
): { nextSize: number; pieces: T[][] } {
  const nextSize = nextSizeAfterFailure(failedBatch.length, floor);
  return { nextSize, pieces: chunkItems(failedBatch, nextSize) };
}
