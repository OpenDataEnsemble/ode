export function formatOverviewCount(n: number): string {
  return n.toLocaleString();
}

/** e.g. `3,245` or `3,245 (128 pending)` — omits pending when zero. */
export function formatObservationOverviewCell(
  observationCount: number,
  pendingSyncCount: number,
): string {
  const base = formatOverviewCount(observationCount);
  if (pendingSyncCount <= 0) {
    return base;
  }
  return `${base} (${formatOverviewCount(pendingSyncCount)} pending)`;
}

export function formatOverviewUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}
