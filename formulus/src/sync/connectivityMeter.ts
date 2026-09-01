import {
  PULL_PAGE_CEILING,
  PULL_PAGE_FLOOR,
  PULL_PAGE_START,
  PUSH_BATCH_CEILING,
  PUSH_BATCH_FLOOR,
  PUSH_BATCH_START,
  type SyncKnobs,
} from './networkProfile';

export type ConnectivityMeterState = {
  level: number;
  labelKey:
    | 'sync.connectivity.default'
    | 'sync.connectivity.cautious'
    | 'sync.connectivity.balancedLow'
    | 'sync.connectivity.balanced'
    | 'sync.connectivity.balancedHigh'
    | 'sync.connectivity.fast';
};

const DEFAULT_CONNECTIVITY_LEVEL = 2;

export function getConnectivityMeterState(
  knobs: Pick<SyncKnobs, 'pullPageSize' | 'pushBatchSize'>,
): ConnectivityMeterState {
  if (
    knobs.pullPageSize === PULL_PAGE_START &&
    knobs.pushBatchSize === PUSH_BATCH_START
  ) {
    return {
      level: DEFAULT_CONNECTIVITY_LEVEL,
      labelKey: 'sync.connectivity.default',
    };
  }

  const pullProgress =
    (knobs.pullPageSize - PULL_PAGE_FLOOR) /
    (PULL_PAGE_CEILING - PULL_PAGE_FLOOR);
  const pushProgress =
    (knobs.pushBatchSize - PUSH_BATCH_FLOOR) /
    (PUSH_BATCH_CEILING - PUSH_BATCH_FLOOR);
  const score = Math.max(
    0,
    Math.min(1, pullProgress * 0.6 + pushProgress * 0.4),
  );
  const level = Math.min(5, Math.max(1, Math.floor(score * 5) + 1));
  const labelKey =
    level === 1
      ? 'sync.connectivity.cautious'
      : level === 2
        ? 'sync.connectivity.balancedLow'
        : level === 3
          ? 'sync.connectivity.balanced'
          : level === 4
            ? 'sync.connectivity.balancedHigh'
            : 'sync.connectivity.fast';

  return { level, labelKey };
}
