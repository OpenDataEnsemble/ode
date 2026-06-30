/** Collect linkedForm ids from a form schema (recursive). */
export function collectLinkedFormIds(
  schema: unknown,
  out: Set<string> = new Set(),
): Set<string> {
  if (!schema || typeof schema !== 'object') return out;
  const obj = schema as Record<string, unknown>;

  if (typeof obj.linkedForm === 'string' && obj.linkedForm.trim()) {
    out.add(obj.linkedForm.trim());
  }

  if (obj.properties && typeof obj.properties === 'object') {
    for (const val of Object.values(
      obj.properties as Record<string, unknown>,
    )) {
      collectLinkedFormIds(val, out);
    }
  }

  if (obj.items && typeof obj.items === 'object') {
    collectLinkedFormIds(obj.items, out);
  }

  for (const key of ['allOf', 'anyOf', 'oneOf'] as const) {
    const branch = obj[key];
    if (Array.isArray(branch)) {
      for (const sub of branch) {
        collectLinkedFormIds(sub, out);
      }
    }
  }

  return out;
}
