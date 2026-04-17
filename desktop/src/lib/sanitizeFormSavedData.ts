/**
 * Strip host-specific attachment URLs from observation `savedData` before the
 * formplayer sees it. Mobile rows often carry `uri` / `url` and path-like
 * `filename` values; the WebView must resolve display URLs only via
 * `getAttachmentUri(basename)`.
 */

const ATTACHMENT_NAME_LIKE =
  /\.(jpe?g|png|gif|bmp|webp|pdf|docx?)$/i;

function attachmentBasenameOnly(raw: string): string {
  const t = raw.trim().replace(/\\/g, '/');
  const last = t.split('/').pop()?.trim() ?? '';
  return last;
}

function isAttachmentLikeObject(o: Record<string, unknown>): boolean {
  const fn = o.filename;
  if (typeof fn !== 'string' || !fn.trim()) {
    return false;
  }
  const base = attachmentBasenameOnly(fn);
  if (!base || base.includes('..')) {
    return false;
  }
  if (ATTACHMENT_NAME_LIKE.test(base)) {
    return true;
  }
  if (typeof o.uri === 'string' || typeof o.url === 'string') {
    return true;
  }
  if (o.metadata !== null && typeof o.metadata === 'object') {
    return !Array.isArray(o.metadata);
  }
  return false;
}

function walk(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(walk);
  }
  const o = value as Record<string, unknown>;
  if (isAttachmentLikeObject(o)) {
    const fn = o.filename as string;
    const base = attachmentBasenameOnly(fn);
    const next: Record<string, unknown> = { ...o };
    delete next.uri;
    delete next.url;
    if (base !== fn.trim()) {
      next.filename = base;
    }
    for (const key of Object.keys(next)) {
      next[key] = walk(next[key]) as never;
    }
    return next;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(o)) {
    out[key] = walk(o[key]);
  }
  return out;
}

export function sanitizePortableAttachmentsInFormData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  return walk(clone) as Record<string, unknown>;
}
