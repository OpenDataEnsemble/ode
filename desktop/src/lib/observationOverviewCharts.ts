import type { ObservationOverviewRow } from '../types/domain';

/** Series colors aligned with Desktop dark theme accents. */
export const OVERVIEW_CHART_COLORS = [
  '#6b8ae8',
  '#5cb88a',
  '#e0a86a',
  '#c77dff',
  '#56cfe1',
  '#ff8f8f',
  '#90a3cb',
  '#ffb95f',
] as const;

export const OVERVIEW_CHART_OTHER_COLOR = '#5a6478';

const MAX_PIE_SLICES = 8;

export interface FormTypeChartSlice {
  formType: string;
  count: number;
  color: string;
}

export function colorForFormType(formType: string, index: number): string {
  if (formType.startsWith('Other')) {
    return OVERVIEW_CHART_OTHER_COLOR;
  }
  return OVERVIEW_CHART_COLORS[index % OVERVIEW_CHART_COLORS.length];
}

export function buildFormTypeChartSlices(
  rows: ObservationOverviewRow[],
): FormTypeChartSlice[] {
  if (rows.length === 0) {
    return [];
  }

  const sorted = [...rows].sort(
    (a, b) => b.observationCount - a.observationCount,
  );

  if (sorted.length <= MAX_PIE_SLICES) {
    return sorted.map((row, i) => ({
      formType: row.formType,
      count: row.observationCount,
      color: colorForFormType(row.formType, i),
    }));
  }

  const head = sorted.slice(0, MAX_PIE_SLICES - 1);
  const tail = sorted.slice(MAX_PIE_SLICES - 1);
  const otherCount = tail.reduce((sum, row) => sum + row.observationCount, 0);

  const slices: FormTypeChartSlice[] = head.map((row, i) => ({
    formType: row.formType,
    count: row.observationCount,
    color: colorForFormType(row.formType, i),
  }));

  slices.push({
    formType: `Other (${tail.length} types)`,
    count: otherCount,
    color: OVERVIEW_CHART_OTHER_COLOR,
  });

  return slices;
}

export function formatOverviewCount(n: number): string {
  return n.toLocaleString();
}
