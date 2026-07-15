import { describe, expect, it } from 'vitest';
import {
  formatObservationOverviewCell,
  formatOverviewCount,
} from './observationOverviewFormat';

describe('observationOverviewFormat', () => {
  it('formatOverviewCount uses locale grouping', () => {
    expect(formatOverviewCount(3245)).toBe((3245).toLocaleString());
  });

  it('formatObservationOverviewCell omits zero pending', () => {
    expect(formatObservationOverviewCell(100, 0)).toBe(
      formatOverviewCount(100),
    );
  });

  it('formatObservationOverviewCell includes pending when non-zero', () => {
    expect(formatObservationOverviewCell(3245, 128)).toBe(
      `${formatOverviewCount(3245)} (${formatOverviewCount(128)} pending)`,
    );
  });
});
