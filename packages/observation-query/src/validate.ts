import type { ObservationFilter } from './types';

export function validateFilter(filter: unknown): filter is ObservationFilter {
  if (!filter || typeof filter !== 'object') return false;
  const f = filter as Record<string, unknown>;
  if ('field' in f && 'op' in f) return true;
  if (f.op === 'any' && typeof f.path === 'string' && typeof f.as === 'string' && f.where) {
    return true;
  }
  if ((f.op === 'and' || f.op === 'or') && Array.isArray(f.conditions)) {
    return f.conditions.every((c) => validateFilter(c));
  }
  return false;
}
