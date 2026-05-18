import type { ObservationCondition, ObservationField, ObservationFilter } from './types';

export function dataField(path: string): ObservationField {
  return (path.startsWith('data.') ? path : `data.${path}`) as ObservationField;
}

export function dataEq(path: string, value: string | number): ObservationCondition {
  return { field: dataField(path), op: 'eq', value };
}

export function dataIn(path: string, values: Array<string | number>): ObservationCondition {
  return { field: dataField(path), op: 'in', value: values };
}

export function andFilter(...conditions: ObservationFilter[]): ObservationFilter {
  const flat = conditions.filter(Boolean);
  if (flat.length === 0) {
    return { op: 'and', conditions: [] };
  }
  if (flat.length === 1) return flat[0];
  return { op: 'and', conditions: flat };
}

export function orFilter(...conditions: ObservationFilter[]): ObservationFilter {
  const flat = conditions.filter(Boolean);
  if (flat.length === 0) {
    return { op: 'or', conditions: [] };
  }
  if (flat.length === 1) return flat[0];
  return { op: 'or', conditions: flat };
}

/** Build AND filter from plain param map (keys are data paths without `data.` prefix). */
export function paramsToAndFilter(
  params: Record<string, unknown>,
): ObservationFilter | undefined {
  const conditions: ObservationCondition[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (key === '_config' || key.startsWith('_')) continue;
    if (value === null || value === undefined || value === '') continue;
    conditions.push(dataEq(key, String(value)));
  }
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return andFilter(...conditions);
}

const DATA_EQ_RE =
  /(?:json_extract\s*\(\s*data\s*,\s*'\$\.(\w+)'\s*\)|data\.(\w+))\s*(=|!=|<>)\s*'((?:[^'\\]|\\.)*)'/gi;

/**
 * Parse legacy WHERE strings (data.field = 'value' AND ...) into a filter AST.
 * Skips age_from_dob(...) fragments (handled client-side in formplayer).
 */
export function parseLegacyWhereClause(where: string): ObservationFilter | undefined {
  if (!where?.trim()) return undefined;
  if (/age_from_dob\s*\(/i.test(where)) {
    const stripped = where
      .replace(/(NOT\s+)?age_from_dob\([^)]+\)\s*(>=|<=|>|<|=|!=)\s*\d+/gi, '')
      .replace(/\s+(AND|OR)\s+/gi, ' ')
      .trim();
    if (!stripped || stripped === 'AND' || stripped === 'OR') return undefined;
    return parseLegacyWhereClause(stripped);
  }

  const conditions: ObservationCondition[] = [];
  let match: RegExpExecArray | null;
  DATA_EQ_RE.lastIndex = 0;
  while ((match = DATA_EQ_RE.exec(where)) !== null) {
    const field = match[1] || match[2];
    const op = match[3] === '<>' ? 'neq' : (match[3] as 'eq' | 'neq');
    const value = (match[4] || '').replace(/\\'/g, "'");
    if (field) {
      conditions.push({ field: dataField(field), op, value });
    }
  }

  if (conditions.length === 0) return undefined;
  if (/\bOR\b/i.test(where)) {
    return orFilter(...conditions);
  }
  if (conditions.length === 1) return conditions[0];
  return andFilter(...conditions);
}

/** Merge static params and optional legacy where string into one filter. */
export function buildQueryFilter(
  params: Record<string, unknown>,
  whereClause?: string | null,
): ObservationFilter | undefined {
  const fromParams = paramsToAndFilter(params);
  const fromWhere = whereClause ? parseLegacyWhereClause(whereClause) : undefined;
  if (fromParams && fromWhere) return andFilter(fromParams, fromWhere);
  return fromParams ?? fromWhere;
}
