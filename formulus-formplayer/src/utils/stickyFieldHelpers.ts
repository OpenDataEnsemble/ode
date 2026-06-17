import type { FormObservationData } from './formObservationData';

/** Walk uischema and collect data paths for controls with `options.sticky: true`. */
export function collectStickyFieldPaths(
  uischema: unknown,
  paths: string[] = [],
): string[] {
  if (!uischema || typeof uischema !== 'object') return paths;
  const el = uischema as Record<string, unknown>;

  if (el.type === 'Control' && typeof el.scope === 'string') {
    const opts = el.options as Record<string, unknown> | undefined;
    if (opts?.sticky === true) {
      const field = el.scope.replace(/^#\/properties\//, '').split('/')[0];
      if (field) paths.push(field);
    }
  }

  const children = el.elements;
  if (Array.isArray(children)) {
    for (const child of children) {
      collectStickyFieldPaths(child, paths);
    }
  }

  return paths;
}

function isScalarStickyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean';
}

/** Extract scalar sticky values from submitted form data for the given field paths. */
export function extractStickyValues(
  data: FormObservationData,
  fieldPaths: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of fieldPaths) {
    const v = data[key];
    if (isScalarStickyValue(v)) {
      out[key] = v;
    }
  }
  return out;
}

/** Lowest-precedence fill: only keys still missing after params / schema defaults. */
export function applyStickyDefaults(
  data: FormObservationData,
  stickyValues: Record<string, unknown>,
): FormObservationData {
  if (!stickyValues || Object.keys(stickyValues).length === 0) {
    return { ...data };
  }
  const out: FormObservationData = { ...data };
  for (const [key, value] of Object.entries(stickyValues)) {
    const existing = out[key];
    if (existing !== undefined && existing !== null && existing !== '') {
      continue;
    }
    out[key] = value;
  }
  return out;
}
