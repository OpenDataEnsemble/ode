/**
 * Build WebView-safe file:// URLs and resolve attachment paths under DocumentDirectory.
 * Used by Formulus WebView bridge (getAttachmentUri, directory helpers).
 */

import RNFS from 'react-native-fs';

/** Convert an absolute filesystem path to a file:// URL (Android/iOS). */
export function pathToFileUrl(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/');
  if (normalized.startsWith('file://')) {
    return normalized;
  }
  return `file://${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

/**
 * Sanitize user-supplied attachment name to a single basename (no directories, no "..").
 */
export function safeAttachmentBasename(raw: unknown): string | null {
  if (raw == null || typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const base = trimmed.replace(/\\/g, '/').split('/').pop() ?? '';
  if (!base || base === '.' || base === '..' || base.includes('..')) {
    return null;
  }
  return base;
}

const attachmentsRoot = (): string =>
  `${RNFS.DocumentDirectoryPath}/attachments`;
const draftRoot = (): string => `${attachmentsRoot()}/draft`;
const syncedRoot = (): string => `${attachmentsRoot()}/synced`;
const pendingRoot = (): string => `${attachmentsRoot()}/pending`;
// Legacy roots — consulted as a last resort for data written before the v2
// folder-layout migration (`runAttachmentLayoutMigrationV2`) has run. Harmless
// if they never exist.
const legacyCommittedRoot = (): string => attachmentsRoot();
const legacyPendingRoot = (): string => `${attachmentsRoot()}/pending_upload`;
const customAppRoot = (): string => `${RNFS.DocumentDirectoryPath}/app`;
const formsRoot = (): string => `${RNFS.DocumentDirectoryPath}/forms`;

/**
 * Return `file://` URL for an attachment file.
 *
 * Lookup order:
 *   1. `attachments/draft/<name>`  — freshest user-captured copy (formplayer
 *      preview reflects what was just taken).
 *   2. `attachments/synced/<name>` — canonical committed/downloaded copy.
 *   3. `attachments/pending/<name>` — only reachable if `synced/` was wiped
 *      but the upload queue was not (defensive).
 *   4. legacy fallbacks: bare `attachments/<name>` and
 *      `attachments/pending_upload/<name>`, for the short window between app
 *      update and {@link runAttachmentLayoutMigrationV2} completing.
 *
 * `fileName` is reduced to a basename; path segments and ".." are rejected.
 */
export async function resolveAttachmentFileUrl(
  fileName: string,
): Promise<string | null> {
  const base = safeAttachmentBasename(fileName);
  if (!base) {
    return null;
  }
  const candidates = [
    `${draftRoot()}/${base}`,
    `${syncedRoot()}/${base}`,
    `${pendingRoot()}/${base}`,
    `${legacyCommittedRoot()}/${base}`,
    `${legacyPendingRoot()}/${base}`,
  ];
  try {
    for (const p of candidates) {
      if (await RNFS.exists(p)) {
        return pathToFileUrl(p);
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Base `file://` URL for the canonical attachment directory that custom apps
 * should iterate. Returns the `synced/` subdirectory — drafts and the upload
 * queue are intentionally excluded from the directory listing contract.
 */
export function getAttachmentsDirectoryFileUrl(): string {
  return pathToFileUrl(`${syncedRoot()}/`);
}

export function getCustomAppDirectoryFileUrl(): string {
  return pathToFileUrl(`${customAppRoot()}/`);
}

export function getFormSpecsDirectoryFileUrl(): string {
  return pathToFileUrl(`${formsRoot()}/`);
}
