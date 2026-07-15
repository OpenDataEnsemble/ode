/**
 * Helpers to build observation-shaped JSON from `FormInitData.params` and to align
 * root data with JSON Schema `properties` (strips leaked host/UI keys).
 */

/** Bridge / UI keys on `FormInitData.params` — not JSON Forms observation fields. */
export const FORMPARAMS_NON_DATA_KEYS = new Set([
  'defaultData',
  'theme',
  'darkMode',
  'themeColors',
  // UI locale from host — not observation data (distinct from optional schema `locale` field).
  'locale',
  // Form translation locale from host — stamped on submit as observation metadata.
  'formLocale',
  // Reserved read-only session context channel (see App init): a custom app may
  // pass `params.context` with session info (device role, selected cluster, ...)
  // that must never be persisted as observation data.
  'context',
]);

export type FormObservationData = Record<string, unknown>;

/** Minimal init shape for draft-selector gating (avoids circular imports). */
export interface DraftSelectorInitShape {
  subObservationMode?: boolean;
  skipDraftSelection?: boolean;
  returnOnly?: boolean;
}

/**
 * Whether Formplayer should offer the draft picker for this session.
 * Caller still checks that drafts exist before showing DraftSelector.
 */
export function shouldOfferDraftSelector(
  initData: DraftSelectorInitShape,
  savedData: Record<string, unknown> | null | undefined,
): boolean {
  if (initData.subObservationMode || initData.returnOnly) {
    return false;
  }
  if (initData.skipDraftSelection) {
    return false;
  }
  if (savedData && Object.keys(savedData).length > 0) {
    return false;
  }
  return true;
}

export function initialFormDataFromParams(
  params: unknown,
): FormObservationData {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }
  const p = params as Record<string, unknown>;
  if (
    p.defaultData != null &&
    typeof p.defaultData === 'object' &&
    !Array.isArray(p.defaultData)
  ) {
    return { ...(p.defaultData as FormObservationData) };
  }
  const out: FormObservationData = {};
  for (const [key, value] of Object.entries(p)) {
    if (!FORMPARAMS_NON_DATA_KEYS.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Resolve a dynamic default token used in a schema property `default`.
 *
 * Only a small, documented set of tokens is supported so that existing static
 * `default` values are never altered:
 *   - `$today` -> local calendar date as `YYYY-MM-DD` (matches `format: "date"`)
 *   - `$now`   -> ISO 8601 date-time (matches `format: "date-time"`)
 *
 * Returns `undefined` for anything that is not a recognized token, signalling
 * "do not inject a value".
 */
export function resolveDefaultToken(token: unknown): unknown {
  if (typeof token !== 'string') {
    return undefined;
  }
  switch (token) {
    case '$today': {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    case '$now':
      return new Date().toISOString();
    default:
      return undefined;
  }
}

/**
 * Merge resolved dynamic-default tokens (`$today` / `$now`) from the schema into
 * initial data for a NEW observation.
 *
 * Rules:
 *   - Only acts on properties whose `default` is a recognized token (see
 *     `resolveDefaultToken`); plain/static `default` values are left untouched
 *     so existing forms keep their current behaviour.
 *   - Never overrides a value already provided via `params` / `defaultData`
 *     (only fills keys that are missing/empty).
 *
 * Callers must only use this on the new-observation path (no saved draft), so
 * resumed/edited observations keep their stored values.
 */
export function applySchemaDefaultTokens(
  data: FormObservationData,
  formSchema: unknown,
): FormObservationData {
  const props = (formSchema as { properties?: unknown } | null)?.properties;
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    return { ...data };
  }
  const out: FormObservationData = { ...data };
  for (const [key, prop] of Object.entries(props as Record<string, unknown>)) {
    const existing = out[key];
    if (existing !== undefined && existing !== null && existing !== '') {
      continue;
    }
    const def = (prop as { default?: unknown } | null)?.default;
    const resolved = resolveDefaultToken(def);
    if (resolved !== undefined) {
      out[key] = resolved;
    }
  }
  return out;
}

/**
 * Observation JSON should match root `schema.properties` (plus optional extras like `locale`, `formLocale`).
 * Strips leaked host/UI keys and survives older rows that embedded `theme`, `themeColors`, etc.
 */
export function dataMatchingSchemaRoot(
  data: FormObservationData,
  formSchema: unknown,
  extraRootKeys: string[] = ['locale', 'formLocale'],
): FormObservationData {
  if (!data || typeof data !== 'object') {
    return {};
  }
  const props = (formSchema as { properties?: unknown } | null)?.properties;
  if (
    !props ||
    typeof props !== 'object' ||
    Array.isArray(props) ||
    Object.keys(props as object).length === 0
  ) {
    return { ...data };
  }
  const allowed = new Set<string>([
    ...Object.keys(props as object),
    ...extraRootKeys,
  ]);
  const out: FormObservationData = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      out[key] = data[key];
    }
  }
  return out;
}

/** Coerce a single value to a JSON integer when schema expects integer / format int. */
export function coerceSchemaIntegerValue(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return parseInt(value.trim(), 10);
  }
  return value;
}

/**
 * Coerce root-level integer fields copied via params / subObservationInitValues
 * so AJV `type: integer` passes even when no Control runs format:int coercion.
 */
export function coerceSchemaRootIntegers(
  data: FormObservationData,
  formSchema: unknown,
): FormObservationData {
  const props = (formSchema as { properties?: unknown } | null)?.properties;
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    return { ...data };
  }
  const out: FormObservationData = { ...data };
  for (const [key, prop] of Object.entries(props as Record<string, unknown>)) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) continue;
    const schemaProp = prop as { type?: string; format?: string };
    if (schemaProp.type === 'integer' || schemaProp.format === 'int') {
      const coerced = coerceSchemaIntegerValue(out[key]);
      if (coerced !== out[key]) {
        out[key] = coerced;
      }
    }
  }
  return out;
}

/**
 * Align observation JSON with schema root keys, then coerce integer fields.
 */
export function prepareRootObservationData(
  data: FormObservationData,
  formSchema: unknown,
  extraRootKeys: string[] = ['locale', 'formLocale'],
): FormObservationData {
  return coerceSchemaRootIntegers(
    dataMatchingSchemaRoot(data, formSchema, extraRootKeys),
    formSchema,
  );
}
