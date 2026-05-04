/**
 * Basename for {@link FormulusClient.getAttachmentUri} from observation `filename`
 * (handles values that mistakenly include path segments). Rejects traversal.
 */
export function attachmentBasenameFromObservation(
  data: Record<string, unknown> | null,
): string | null {
  if (!data || typeof data.filename !== 'string') {
    return null;
  }
  return attachmentBasenameFromFilename(data.filename);
}

export function attachmentBasenameFromFilename(
  filename: string,
): string | null {
  const t = filename.trim();
  if (!t) {
    return null;
  }
  const normalized = t.replace(/\\/g, '/');
  const last = normalized.split('/').pop()?.trim() ?? '';
  if (!last || last === '.' || last === '..' || last.includes('..')) {
    return null;
  }
  return last;
}
