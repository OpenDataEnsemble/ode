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
const pendingRoot = (): string =>
  `${RNFS.DocumentDirectoryPath}/attachments/pending_upload`;
const customAppRoot = (): string => `${RNFS.DocumentDirectoryPath}/app`;
const formsRoot = (): string => `${RNFS.DocumentDirectoryPath}/forms`;

/**
 * Return file:// URL for an attachment file if it exists in main or pending_upload folder.
 */
export async function resolveAttachmentFileUrl(
  fileName: string,
): Promise<string | null> {
  const base = safeAttachmentBasename(fileName);
  if (!base) {
    return null;
  }
  const mainPath = `${attachmentsRoot()}/${base}`;
  const pendingPath = `${pendingRoot()}/${base}`;
  try {
    if (await RNFS.exists(mainPath)) {
      return pathToFileUrl(mainPath);
    }
    if (await RNFS.exists(pendingPath)) {
      return pathToFileUrl(pendingPath);
    }
  } catch {
    return null;
  }
  return null;
}

export function getAttachmentsDirectoryFileUrl(): string {
  return pathToFileUrl(`${attachmentsRoot()}/`);
}

export function getCustomAppDirectoryFileUrl(): string {
  return pathToFileUrl(`${customAppRoot()}/`);
}

export function getFormSpecsDirectoryFileUrl(): string {
  return pathToFileUrl(`${formsRoot()}/`);
}
