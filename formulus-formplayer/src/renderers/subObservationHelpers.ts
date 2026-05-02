/**
 * Pure helpers for sub-observation fields (`format: "sub-observation"`).
 * Embedded child payloads live as JSON objects inside a parent observation array property.
 */

export type OrderBySpec =
  | string
  | { key?: string | null; direction?: string | null }
  | null
  | undefined;

export type ColumnSpec = { key: string; label: string };

export type SubObservationSchemaConfig = {
  columns?: Array<{ key: string; label?: string }>;
  displayField?: string;
  orderBy?: OrderBySpec;
};

/** Coerce an unknown schema extra (object map) for templated init/edit maps. */
export function optionalRecordMap(
  value: unknown,
): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function readDataPath(data: unknown, dotPath: string): unknown {
  if (!dotPath || data == null) return undefined;
  const keys = String(dotPath).split('.');
  let cur: unknown = data;
  for (let i = 0; i < keys.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[keys[i]];
  }
  return cur;
}

export function resolveTemplateValue(
  value: unknown,
  formData: Record<string, unknown>,
  parentValue: string | null,
): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, token: string) => {
    const t = String(token || '').trim();
    if (t === 'parentValue')
      return parentValue == null ? '' : String(parentValue);
    if (t === 'currentInstanceId') {
      const id = formData.observationId;
      return id == null ? '' : String(id);
    }
    const fromData = readDataPath(formData, t);
    return fromData == null ? '' : String(fromData);
  });
}

export function resolveInitialValues(
  mapObj: Record<string, unknown> | null | undefined,
  formData: Record<string, unknown>,
  parentValue: string | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!mapObj || typeof mapObj !== 'object') return out;
  for (const [k, v] of Object.entries(mapObj)) {
    out[k] = resolveTemplateValue(v, formData, parentValue);
  }
  return out;
}

export function formatCellValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Normalizes JsonForms control data into an array of row payloads. */
export function coerceSubObservationRows(value: unknown): unknown[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [];
}

export function readSubObservationField(
  row: Record<string, unknown>,
  key: string,
): string {
  if (!row || !key) return '';
  const isWrapped =
    row.isLocal === true ||
    row.isDraft === true ||
    typeof row.observationId === 'string';

  if (isWrapped) {
    if (key === 'observationId') return String(row.observationId ?? '');
    if (key === 'createdAt') return String(row.createdAt ?? '');
    if (key === 'updatedAt') return String(row.updatedAt ?? '');
    const data = row.data;
    if (data && typeof data === 'object') {
      const v = readDataPath(data, key);
      return formatCellValue(v);
    }
    return '';
  }
  if (key === 'observationId') {
    const values: string[] = [];
    for (const k of Object.keys(row)) {
      if (k === 'locale' || k === 'isDraft' || k === 'isLocal') continue;
      const val = row[k];
      if (typeof val === 'string' && val.trim() !== '') {
        values.push(val);
      } else if (typeof val === 'number') {
        values.push(String(val));
      }
    }
    if (values.length > 0) return values.slice(0, 3).join(' - ');
    return 'Completed sub-observation';
  }
  const v = readDataPath(row, key);
  return formatCellValue(v);
}

export function buildColumns(
  config: SubObservationSchemaConfig,
  rows: unknown[],
): ColumnSpec[] {
  if (Array.isArray(config.columns) && config.columns.length > 0) {
    return config.columns.map(c => ({
      key: c.key,
      label: c.label || c.key,
    }));
  }

  const displayField = config.displayField || 'observationId';
  void rows;
  return [{ key: displayField, label: 'Summary' }];
}

export function sortRows(
  rows: unknown[],
  orderBy: OrderBySpec,
): Record<string, unknown>[] {
  const asRecords = rows.map(r =>
    r && typeof r === 'object' ? (r as Record<string, unknown>) : {},
  );

  if (!asRecords.length) return asRecords;

  let key: string | null = null;
  let direction = 'desc';
  if (typeof orderBy === 'string') {
    key = orderBy;
  } else if (orderBy && typeof orderBy === 'object') {
    key = orderBy.key || null;
    direction =
      String(orderBy.direction || 'desc').toLowerCase() === 'asc'
        ? 'asc'
        : 'desc';
  }

  if (!key) {
    return asRecords.slice().sort((a, b) => {
      const ac = a.createdAt;
      const bc = b.createdAt;
      if (!ac && !bc) return 0;
      const at =
        ac instanceof Date
          ? ac.getTime()
          : ac
            ? new Date(String(ac)).getTime()
            : 0;
      const bt =
        bc instanceof Date
          ? bc.getTime()
          : bc
            ? new Date(String(bc)).getTime()
            : 0;
      return bt - at;
    });
  }

  const sign = direction === 'asc' ? 1 : -1;
  return asRecords.slice().sort((a, b) => {
    const aData =
      a.data && typeof a.data === 'object'
        ? (a.data as Record<string, unknown>)
        : a;
    const bData =
      b.data && typeof b.data === 'object'
        ? (b.data as Record<string, unknown>)
        : b;
    const av = readDataPath(aData, key);
    const bv = readDataPath(bData, key);
    const as = av == null ? '' : String(av);
    const bs = bv == null ? '' : String(bv);
    if (as < bs) return -1 * sign;
    if (as > bs) return 1 * sign;
    return 0;
  });
}
