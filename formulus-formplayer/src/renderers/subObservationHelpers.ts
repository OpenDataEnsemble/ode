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
  itemLabel?: string;
  orderBy?: OrderBySpec;
};

/** Trimmed singular entity name from schema `itemLabel`, or null when absent. */
export function resolveItemLabel(
  config: Pick<SubObservationSchemaConfig, 'itemLabel'> | undefined,
): string | null {
  const raw = config?.itemLabel;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type ResolveAddButtonLabelInput = {
  itemLabel: string | null;
  addButtonLabel?: unknown;
  busy: boolean;
};

/** Add-button text: ui override > composed from itemLabel > legacy default. */
export function resolveAddButtonLabel(
  input: ResolveAddButtonLabelInput,
): string {
  const override =
    typeof input.addButtonLabel === 'string' ? input.addButtonLabel.trim() : '';
  if (override.length > 0) {
    return input.busy ? 'Adding…' : override;
  }
  if (input.itemLabel) {
    return input.busy
      ? `Adding ${input.itemLabel}…`
      : `+ Add ${input.itemLabel}`;
  }
  return input.busy ? 'Adding…' : '+ Add observation';
}

/** Empty-table row text when the embedded array has no items. */
export function resolveEmptyLabel(itemLabel: string | null): string {
  return itemLabel ? `No ${itemLabel}` : 'No observations';
}

/** Delete-confirm fallback when displayField has no value. */
export function resolveDeleteFallbackLabel(itemLabel: string | null): string {
  return itemLabel ? `this ${itemLabel}` : 'this sub-observation';
}

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

/** Immutable shallow clone along `dotPath`, then set the leaf value. */
export function writeDataPath(
  data: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): Record<string, unknown> {
  if (!dotPath) return data;
  const keys = dotPath.split('.');
  if (keys.length === 1) {
    return { ...data, [dotPath]: value };
  }
  const root = { ...data };
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const next = cur[key];
    const cloned =
      next && typeof next === 'object' && !Array.isArray(next)
        ? { ...(next as Record<string, unknown>) }
        : Array.isArray(next)
          ? [...next]
          : {};
    cur[key] = cloned;
    cur = cloned as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
  return root;
}

const SUB_OBS_ARRAY_KEYS = ['quartos', 'camas', 'pessoas'] as const;

/** Keep embedded sub-obs arrays when JsonForms emits stale onChange after a merge. */
export function mergePreservingSubObsArrays(
  baseline: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...incoming };
  for (const key of SUB_OBS_ARRAY_KEYS) {
    const baseArr = baseline[key];
    const inArr = incoming[key];
    if (!Array.isArray(baseArr) || baseArr.length === 0) {
      continue;
    }
    if (!Array.isArray(inArr) || inArr.length < baseArr.length) {
      merged[key] = baseArr;
    }
  }
  return merged;
}

/** Matches a string that is exactly one `{{ token }}` with no surrounding text. */
const SINGLE_TOKEN_RE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

export function resolveTemplateValue(
  value: unknown,
  formData: Record<string, unknown>,
  parentValue: string | null,
): unknown {
  if (typeof value !== 'string') return value;

  // When the whole value is a single token (e.g. "{{age}}"), preserve the
  // source value's JSON type so numbers/booleans copied into a sub-observation
  // stay numbers/booleans (otherwise AJV `type: "integer"` rejects "5"). Mixed
  // templates (e.g. "AF-{{num}}") still interpolate as text below.
  const single = value.match(SINGLE_TOKEN_RE);
  if (single) {
    const t = single[1].trim();
    if (t === 'parentValue') {
      return parentValue == null ? '' : String(parentValue);
    }
    if (t === 'currentInstanceId') {
      const id = formData.observationId;
      return id == null ? '' : String(id);
    }
    const fromData = readDataPath(formData, t);
    return fromData == null ? '' : fromData;
  }

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

/** Resolve `subObservationContext` templates from the opening form's data. */
export function resolveSubObservationContext(
  mapObj: Record<string, unknown> | null | undefined,
  formData: Record<string, unknown>,
  parentValue: string | null,
): Record<string, unknown> {
  return resolveInitialValues(mapObj, formData, parentValue);
}

export function buildSubObservationOpenParams(
  formData: Record<string, unknown>,
  config: Record<string, unknown>,
  parentValue: string | null,
  initMap?: Record<string, unknown> | null,
): Record<string, unknown> {
  const parentSessionContext =
    typeof window !== 'undefined'
      ? (
          window as unknown as {
            formulusSessionContext?: Record<string, unknown> | null;
          }
        ).formulusSessionContext
      : null;

  const resolved = resolveSubObservationContext(
    optionalRecordMap(config.subObservationContext),
    formData,
    parentValue,
  );
  const inheritedSubObservation =
    parentSessionContext &&
    typeof parentSessionContext === 'object' &&
    parentSessionContext.subObservation &&
    typeof parentSessionContext.subObservation === 'object'
      ? (parentSessionContext.subObservation as Record<string, unknown>)
      : {};

  const subObservation: Record<string, unknown> = {
    ...inheritedSubObservation,
  };
  for (const [key, value] of Object.entries(resolved)) {
    if (value !== '' && value != null) {
      subObservation[key] = value;
    }
  }

  const initValues = resolveInitialValues(initMap, formData, parentValue);
  const { household_quartos: _legacySnapshot, ...restInit } = initValues;

  const context = {
    ...(parentSessionContext && typeof parentSessionContext === 'object'
      ? parentSessionContext
      : {}),
    ...(Object.keys(subObservation).length > 0 ? { subObservation } : {}),
  };

  return {
    ...restInit,
    ...(Object.keys(context).length > 0 ? { context } : {}),
  };
}

export function formatCellValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Stable empty reference — avoid retriggering sub-observation row sync every render. */
const EMPTY_SUB_OBSERVATION_ROWS: unknown[] = [];

/** Normalizes JsonForms control data into an array of row payloads. */
export function coerceSubObservationRows(value: unknown): unknown[] {
  if (value == null) return EMPTY_SUB_OBSERVATION_ROWS;
  if (Array.isArray(value)) return value;
  return EMPTY_SUB_OBSERVATION_ROWS;
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

  if (!asRecords.length) {
    return EMPTY_SUB_OBSERVATION_ROWS as Record<string, unknown>[];
  }

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
