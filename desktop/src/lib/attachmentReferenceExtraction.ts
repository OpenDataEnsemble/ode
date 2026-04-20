/**
 * Schema-driven attachment reference extraction for import validation.
 * Aligns with formplayer built-in formats: photo, select_file, signature, audio, video.
 */

/** JSON Schema `format` values that reference workspace attachment files. */
export const ATTACHMENT_SCHEMA_FORMATS = new Set([
  'photo',
  'select_file',
  'signature',
  'audio',
  'video',
]);

/** Path segments; '*' means "each array element". */
export type SchemaPathSegment = string | '*';

export interface SchemaAttachmentPath {
  segments: SchemaPathSegment[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function resolveJsonPointer(root: unknown, ref: string): unknown {
  if (!ref.startsWith('#/')) {
    return undefined;
  }
  const parts = ref.slice(2).split('/');
  let cur: unknown = root;
  for (const raw of parts) {
    const p = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isRecord(cur) || !(p in cur)) {
      return undefined;
    }
    cur = cur[p];
  }
  return cur;
}

function hasAttachmentFormat(schema: Record<string, unknown>): boolean {
  const fmt = schema.format;
  return typeof fmt === 'string' && ATTACHMENT_SCHEMA_FORMATS.has(fmt);
}

/**
 * Walk JSON Schema (draft-07 style) and collect property paths whose leaf schema
 * uses an attachment `format`. Resolves local `#/definitions/...` and `#/$defs/...`.
 */
export function collectAttachmentPathsFromSchema(
  schemaRoot: unknown,
): SchemaAttachmentPath[] {
  const out: SchemaAttachmentPath[] = [];
  const seen = new Set<string>();

  function visit(schema: unknown, pathPrefix: SchemaPathSegment[], stack: Set<unknown>) {
    if (schema === null || schema === undefined) {
      return;
    }
    if (typeof schema !== 'object') {
      return;
    }
    if (stack.has(schema)) {
      return;
    }
    stack.add(schema);

    let s = schema as Record<string, unknown>;
    if (typeof s.$ref === 'string') {
      const resolved = resolveJsonPointer(schemaRoot, s.$ref);
      if (resolved !== undefined) {
        visit(resolved, pathPrefix, stack);
      }
      stack.delete(schema);
      return;
    }

    const combiners = ['allOf', 'anyOf', 'oneOf'] as const;
    for (const c of combiners) {
      const arr = s[c];
      if (Array.isArray(arr)) {
        for (const branch of arr) {
          visit(branch, pathPrefix, stack);
        }
      }
    }

    if (isRecord(s.then)) {
      visit(s.then, pathPrefix, stack);
    }
    if (isRecord(s.else)) {
      visit(s.else, pathPrefix, stack);
    }

    // e.g. property -> { $ref: "#/definitions/snap" } where snap is { format: "photo" }
    if (hasAttachmentFormat(s) && pathPrefix.length > 0) {
      const sig = JSON.stringify(pathPrefix);
      if (!seen.has(sig)) {
        seen.add(sig);
        out.push({ segments: pathPrefix });
      }
      stack.delete(schema);
      return;
    }

    const props = s.properties;
    if (isRecord(props)) {
      for (const key of Object.keys(props)) {
        const sub = props[key];
        if (!isRecord(sub)) {
          continue;
        }
        const nextPath = [...pathPrefix, key] as SchemaPathSegment[];

        if (hasAttachmentFormat(sub)) {
          const sig = JSON.stringify(nextPath);
          if (!seen.has(sig)) {
            seen.add(sig);
            out.push({ segments: nextPath });
          }
        } else {
          const typeVal = sub.type;
          const isArray =
            typeVal === 'array' ||
            (Array.isArray(typeVal) && typeVal.includes('array'));
          if (isArray && isRecord(sub.items)) {
            const items = sub.items as Record<string, unknown>;
            if (hasAttachmentFormat(items)) {
              const segs = [...nextPath, '*'] as SchemaPathSegment[];
              const sig = JSON.stringify(segs);
              if (!seen.has(sig)) {
                seen.add(sig);
                out.push({ segments: segs });
              }
            } else {
              visit(items, [...nextPath, '*'], stack);
            }
          } else {
            visit(sub, nextPath, stack);
          }
        }
      }
    }

    const addl = s.additionalProperties;
    if (addl === true || isRecord(addl)) {
      const sub = addl === true ? {} : addl;
      visit(sub, pathPrefix, stack);
    }

    stack.delete(schema);
  }

  visit(schemaRoot, [], new Set());
  return out;
}

function basenameOnly(raw: string): string {
  const t = raw.trim().replace(/\\/g, '/');
  return t.split('/').pop()?.trim() ?? '';
}

/** Known media/doc extensions from mobile export payloads (basename must include a dot). */
const ATTACHMENT_BASENAME_EXT =
  /\.(jpe?g|png|gif|bmp|webp|heic|tiff?|pdf|docx?|xlsx?|pptx?|csv|txt|mp[34]|m4a|wav|aac|flac|webm|mov|mkv|svg)$/i;

/**
 * True if a string is plausibly a filename or attachment id, not a MIME type / sentinel.
 */
export function stringLooksLikeAttachmentRef(raw: string): boolean {
  const t = raw.trim();
  if (!t || t === '*') {
    return false;
  }
  // MIME types like image/jpeg → basename "jpeg" / "jpg" false positives
  if (/^[a-z][a-z0-9.+-]*\/[a-z0-9.+\/-]+$/i.test(t)) {
    return false;
  }
  const b = basenameOnly(t);
  if (!b || b === '*' || b.includes('..')) {
    return false;
  }
  if (ATTACHMENT_BASENAME_EXT.test(b)) {
    return true;
  }
  // UUID-style ids used as attachment identifiers (no extension)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b)) {
    return true;
  }
  // Long opaque ids with separators (avoid matching short noise like "jpg")
  if (b.length >= 12 && /[/_-]/.test(b) && /^[a-z0-9._/-]+$/i.test(t.replace(/\\/g, '/'))) {
    return true;
  }
  return false;
}

/**
 * Collect attachment basenames from a value produced by a photo/file/signature/etc. control.
 */
/** Collect attachment basenames referenced anywhere in observation JSON (same recursive rules as per-field extraction). */
export function collectAttachmentNamesFromPayload(payload: unknown): string[] {
  return extractAttachmentNamesFromFieldValue(payload);
}

export function extractAttachmentNamesFromFieldValue(value: unknown): string[] {
  const names: string[] = [];

  function walk(v: unknown, depth: number) {
    if (depth > 16 || v === null || v === undefined) {
      return;
    }
    if (typeof v === 'string') {
      if (!stringLooksLikeAttachmentRef(v)) {
        return;
      }
      const b = basenameOnly(v);
      if (b && !b.includes('..')) {
        names.push(b);
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const el of v) {
        walk(el, depth + 1);
      }
      return;
    }
    if (!isRecord(v)) {
      return;
    }
    const id =
      (typeof v.attachmentId === 'string' && v.attachmentId.trim()) ||
      (typeof v.attachment_id === 'string' && v.attachment_id.trim());
    if (id) {
      names.push(basenameOnly(id));
    }
    const fn = v.filename;
    if (typeof fn === 'string' && fn.trim()) {
      const b = basenameOnly(fn);
      if (b && !b.includes('..')) {
        names.push(b);
      }
    }
    for (const [k, val] of Object.entries(v)) {
      if (k === 'filename' || k === 'attachmentId' || k === 'attachment_id') {
        continue;
      }
      walk(val, depth + 1);
    }
  }

  walk(value, 0);
  return [...new Set(names.filter(Boolean))];
}

/**
 * Read values at schema attachment paths (supports '*' array segments).
 */
export function valuesAtSchemaPaths(
  data: unknown,
  paths: SchemaAttachmentPath[],
): unknown[] {
  const values: unknown[] = [];

  function follow(current: unknown, segments: SchemaPathSegment[], idx: number) {
    if (idx >= segments.length) {
      values.push(current);
      return;
    }
    const seg = segments[idx];
    if (seg === '*') {
      if (!Array.isArray(current)) {
        return;
      }
      for (const el of current) {
        follow(el, segments, idx + 1);
      }
      return;
    }
    if (!isRecord(current)) {
      return;
    }
    if (!(seg in current)) {
      return;
    }
    follow(current[seg], segments, idx + 1);
  }

  if (!isRecord(data)) {
    return values;
  }

  for (const p of paths) {
    follow(data, p.segments, 0);
  }
  return values;
}

export function referencedAttachmentNamesFromSchemaAndData(
  formSchema: unknown,
  data: unknown,
): Set<string> {
  const paths = collectAttachmentPathsFromSchema(formSchema);
  const names = new Set<string>();
  const vals = valuesAtSchemaPaths(data, paths);
  for (const v of vals) {
    for (const n of extractAttachmentNamesFromFieldValue(v)) {
      names.add(n);
    }
  }
  return names;
}

/** Heuristic names when schema is missing or incomplete (Synk-style keys). */
export function referencedAttachmentNamesHeuristic(data: unknown): Set<string> {
  const names = new Set<string>();

  function walk(v: unknown, depth: number) {
    if (depth > 14) {
      return;
    }
    if (v === null || v === undefined) {
      return;
    }
    if (typeof v === 'string') {
      return;
    }
    if (Array.isArray(v)) {
      for (const el of v) {
        walk(el, depth + 1);
      }
      return;
    }
    if (!isRecord(v)) {
      return;
    }
    for (const [k, val] of Object.entries(v)) {
      const kl = k.toLowerCase();
      if (k === 'attachmentId' || kl === 'attachment_id') {
        if (typeof val === 'string' && val.trim()) {
          names.add(basenameOnly(val));
        }
      }
      if (kl === 'attachments' && Array.isArray(val)) {
        for (const el of val) {
          if (isRecord(el)) {
            const id =
              (typeof el.attachmentId === 'string' && el.attachmentId) ||
              (typeof el.attachment_id === 'string' && el.attachment_id) ||
              (typeof el.id === 'string' && el.id);
            if (typeof id === 'string' && id.trim()) {
              names.add(basenameOnly(id));
            }
            if (typeof el.filename === 'string' && el.filename.trim()) {
              names.add(basenameOnly(el.filename));
            }
          }
        }
      }
      walk(val, depth + 1);
    }
  }

  walk(data, 0);
  return names;
}
