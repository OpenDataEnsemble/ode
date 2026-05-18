/**
 * Resolves external $ref to forms/shared-choice-defs.schema.json for Formulus / Formplayer.
 */

export const SHARED_CHOICE_SCHEMA_ID = 'forms/shared-choice-defs.schema.json';
export const SHARED_CHOICE_REF_PREFIX = `${SHARED_CHOICE_SCHEMA_ID}#/$defs/`;

const SHARED_REF_RE = new RegExp(
  `^${SHARED_CHOICE_SCHEMA_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#\\/\\$defs\\/(.+)$`,
);

export interface SharedChoiceSchemaDoc {
  $id?: string;
  $schema?: string;
  $defs: Record<string, unknown>;
}

export function extractSharedChoiceDefName(ref: string): string | null {
  const m = String(ref || '')
    .trim()
    .match(SHARED_REF_RE);
  return m ? m[1] : null;
}

/** Deep-clone schema and inline shared choice $ref into $defs for AJV / JSON Forms. */
export function resolveSharedChoiceRefs(
  formSchema: Record<string, unknown>,
  sharedDoc: SharedChoiceSchemaDoc,
): Record<string, unknown> {
  if (!sharedDoc?.$defs) {
    return formSchema;
  }

  const resolved = JSON.parse(JSON.stringify(formSchema)) as Record<
    string,
    unknown
  >;
  if (!resolved.$defs || typeof resolved.$defs !== 'object') {
    resolved.$defs = {};
  }

  const needed = new Set<string>();

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.$ref === 'string') {
      const name = extractSharedChoiceDefName(obj.$ref);
      if (name) {
        needed.add(name);
        obj.$ref = `#/$defs/${name}`;
      }
    }
    Object.values(obj).forEach(walk);
  };

  walk(resolved);

  const defs = resolved.$defs as Record<string, unknown>;
  for (const name of needed) {
    const def = sharedDoc.$defs[name];
    if (!def) {
      throw new Error(
        `Missing shared choice def "${name}" in shared-choice-defs.schema.json`,
      );
    }
    defs[name] = JSON.parse(JSON.stringify(def));
  }

  return resolved;
}
