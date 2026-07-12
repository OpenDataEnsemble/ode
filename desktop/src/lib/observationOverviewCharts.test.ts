import { describe, expect, it } from 'vitest';
import { buildFormTypeChartSlices } from './observationOverviewCharts';

describe('buildFormTypeChartSlices', () => {
  it('returns rows unchanged when at most eight types', () => {
    const rows = [
      { formType: 'a', observationCount: 10, pendingSyncCount: 0 },
      { formType: 'b', observationCount: 5, pendingSyncCount: 0 },
    ];
    const slices = buildFormTypeChartSlices(rows);
    expect(slices).toHaveLength(2);
    expect(slices[0].formType).toBe('a');
    expect(slices[0].count).toBe(10);
  });

  it('collapses tail form types into Other', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      formType: `form_${i}`,
      observationCount: 10 - i,
      pendingSyncCount: 0,
    }));
    const slices = buildFormTypeChartSlices(rows);
    expect(slices).toHaveLength(8);
    expect(slices.at(-1)?.formType).toMatch(/^Other \(/);
    expect(slices.at(-1)?.count).toBe(3 + 2 + 1);
  });
});
