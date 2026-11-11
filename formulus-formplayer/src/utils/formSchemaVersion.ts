/** Resolve root form metadata without changing valid authored version strings. */
export function resolveFormSchemaVersion(schema: unknown): string {
  if (schema && typeof schema === 'object') {
    const { schemaVersion, version } = schema as Record<string, unknown>;
    for (const candidate of [schemaVersion, version]) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }
  }
  return '1.0';
}
