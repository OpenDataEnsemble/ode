import {
  adaptiveGrowStep,
  canSplitPushBatch,
  nextAdaptivePullPageSize,
  nextAdaptivePushBatchSize,
  nextSizeAfterFailure,
  splitFailedPushBatch,
} from '../adaptivePageSize';

describe('adaptiveGrowStep', () => {
  it('uses +25 until the current size is large enough for a 25% step', () => {
    expect(adaptiveGrowStep(50)).toBe(25);
    expect(adaptiveGrowStep(80)).toBe(25);
    expect(adaptiveGrowStep(100)).toBe(25);
    expect(adaptiveGrowStep(200)).toBe(50);
    expect(adaptiveGrowStep(400)).toBe(100);
  });
});

describe('nextAdaptivePullPageSize', () => {
  it('grows toward 500 on fast pages', () => {
    expect(nextAdaptivePullPageSize(32, 3_000)).toBe(57);
    expect(nextAdaptivePullPageSize(200, 1_000)).toBe(250);
    expect(nextAdaptivePullPageSize(400, 1_000)).toBe(500);
    expect(nextAdaptivePullPageSize(480, 1_000)).toBe(500);

    let size = 32;
    for (let i = 0; i < 12; i += 1) {
      size = nextAdaptivePullPageSize(size, 1_000);
    }
    expect(size).toBe(500);
  });

  it('halves toward a single row when a page is slow', () => {
    expect(nextAdaptivePullPageSize(200, 20_000)).toBe(100);
    expect(nextAdaptivePullPageSize(500, 20_000)).toBe(250);
    expect(nextAdaptivePullPageSize(32, 20_000)).toBe(16);
    expect(nextAdaptivePullPageSize(2, 20_000)).toBe(1);
    expect(nextAdaptivePullPageSize(1, 20_000)).toBe(1);
  });

  it('holds the current size in the middle band', () => {
    expect(nextAdaptivePullPageSize(100, 10_000)).toBe(100);
  });
});

describe('nextAdaptivePushBatchSize', () => {
  it('grows toward 100 and can shrink to 1', () => {
    expect(nextAdaptivePushBatchSize(4, 3_000)).toBe(29);
    expect(nextAdaptivePushBatchSize(80, 3_000)).toBe(100);
    expect(nextAdaptivePushBatchSize(100, 20_000)).toBe(50);
    expect(nextAdaptivePushBatchSize(2, 20_000)).toBe(1);
  });
});

describe('splitFailedPushBatch', () => {
  it('halves a failed batch down toward single observations', () => {
    expect(nextSizeAfterFailure(25)).toBe(12);
    expect(nextSizeAfterFailure(2)).toBe(1);
    expect(nextSizeAfterFailure(1)).toBe(1);
    expect(canSplitPushBatch(25)).toBe(true);
    expect(canSplitPushBatch(1)).toBe(false);

    const { nextSize, pieces } = splitFailedPushBatch([1, 2, 3, 4, 5]);
    expect(nextSize).toBe(2);
    expect(pieces).toEqual([[1, 2], [3, 4], [5]]);
  });
});
