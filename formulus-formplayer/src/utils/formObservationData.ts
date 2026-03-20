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
]);

export type FormObservationData = Record<string, unknown>;

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
 * Observation JSON should match root `schema.properties` (plus optional extras like `locale`).
 * Strips leaked host/UI keys and survives older rows that embedded `theme`, `themeColors`, etc.
 */
export function dataMatchingSchemaRoot(
  data: FormObservationData,
  formSchema: unknown,
  extraRootKeys: string[] = ['locale'],
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
