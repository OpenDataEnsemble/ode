/** Temporary sub-observation tracing — grep `SUBOBS_DEBUG` to remove. */

const TRACKED_ARRAYS = ['quartos', 'camas', 'pessoas'] as const;

export function subObsDataSummary(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return { keys: [] };
  }
  const out: Record<string, unknown> = { keys: Object.keys(data) };
  for (const k of TRACKED_ARRAYS) {
    const v = data[k];
    if (Array.isArray(v)) {
      out[`${k}.length`] = v.length;
    }
  }
  return out;
}

export function subObsArrayFingerprint(
  data: Record<string, unknown> | null | undefined,
): string {
  if (!data || typeof data !== 'object') {
    return '';
  }
  return TRACKED_ARRAYS.map(k => {
    const v = data[k];
    return `${k}:${Array.isArray(v) ? v.length : '-'}`;
  }).join('|');
}

export function subObsDebug(
  phase: string,
  detail?: Record<string, unknown>,
): void {
  if (typeof console === 'undefined') {
    return;
  }
  console.warn(`[SUBOBS_DEBUG] ${phase}`, detail ?? '');
}

/** Keep sub-observation arrays when JsonForms emits stale onChange after a merge. */
export function mergePreservingSubObsArrays(
  baseline: Record<string, unknown>,
  incoming: Record<string, unknown>,
): { merged: Record<string, unknown>; preserved: string[] } {
  const merged = { ...incoming };
  const preserved: string[] = [];
  for (const key of TRACKED_ARRAYS) {
    const baseArr = baseline[key];
    const inArr = incoming[key];
    if (!Array.isArray(baseArr) || baseArr.length === 0) {
      continue;
    }
    if (!Array.isArray(inArr) || inArr.length < baseArr.length) {
      merged[key] = baseArr;
      preserved.push(key);
    }
  }
  return { merged, preserved };
}
