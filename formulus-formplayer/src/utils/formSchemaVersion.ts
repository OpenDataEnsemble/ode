/** Resolve the trimmed version from root form metadata. */
export function resolveFormSchemaVersion(schema: unknown): string {
  if (schema && typeof schema === 'object') {
    const { schemaVersion, version } = schema as Record<string, unknown>;
    for (const candidate of [schemaVersion, version]) {
      const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return '1.0';
}
