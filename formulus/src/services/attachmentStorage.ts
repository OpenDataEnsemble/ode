import RNFS from 'react-native-fs';
import { safeAttachmentBasename } from './WebViewFileUrlResolver';

export const attachmentsRoot = (): string =>
  `${RNFS.DocumentDirectoryPath}/attachments`;

export const pendingUploadRoot = (): string =>
  `${attachmentsRoot()}/pending_upload`;

export const draftAttachmentsRoot = (): string => `${attachmentsRoot()}/draft`;

/** Same rules as SynkronusApi.isAttachmentPath — basename / GUID-style refs in observation JSON. */
export function isAttachmentBasename(value: string): boolean {
  const guidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const guidWithExtension =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|gif|bmp|webp|pdf|doc|docx)$/i;
  return guidPattern.test(value) || guidWithExtension.test(value);
}

function collectAttachmentBasenames(data: unknown, out: Set<string>): void {
  if (typeof data === 'string') {
    if (isAttachmentBasename(data)) {
      out.add(data);
    }
    return;
  }
  if (!data || typeof data !== 'object') return;
  if (Array.isArray(data)) {
    for (const item of data) {
      collectAttachmentBasenames(item, out);
    }
    return;
  }
  for (const value of Object.values(data)) {
    collectAttachmentBasenames(value, out);
  }
}

export function collectAttachmentBasenamesFromData(data: unknown): string[] {
  const out = new Set<string>();
  collectAttachmentBasenames(data, out);
  return [...out];
}

async function promoteOneDraftFile(base: string): Promise<void> {
  const baseSafe = safeAttachmentBasename(base);
  if (!baseSafe || !isAttachmentBasename(baseSafe)) {
    return;
  }
  const draftPath = `${draftAttachmentsRoot()}/${baseSafe}`;
  const mainPath = `${attachmentsRoot()}/${baseSafe}`;
  const pendingPath = `${pendingUploadRoot()}/${baseSafe}`;
  if (!(await RNFS.exists(draftPath))) {
    return;
  }
  await RNFS.mkdir(attachmentsRoot());
  await RNFS.mkdir(pendingUploadRoot());
  await RNFS.copyFile(draftPath, mainPath);
  await RNFS.copyFile(draftPath, pendingPath);
  await RNFS.unlink(draftPath);
}

/** Deep rewrite: draft attachment paths become committed paths (same basename under `attachments/`). */
export function rewriteDraftUrisInData(data: unknown): unknown {
  if (data == null) return data;
  if (typeof data === 'string') {
    if (data.includes('/attachments/draft/')) {
      return data.replace(/\/attachments\/draft\//g, '/attachments/');
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(rewriteDraftUrisInData);
  }
  if (typeof data === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      o[k] = rewriteDraftUrisInData(v);
    }
    return o;
  }
  return data;
}

/**
 * After an observation is persisted, promote any draft files referenced in `data` to
 * `attachments/` + `pending_upload/`, and return updated JSON with `file://` paths fixed.
 */
export async function commitDraftAttachmentsAfterSave(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const basenames = collectAttachmentBasenamesFromData(data);
  for (const b of basenames) {
    await promoteOneDraftFile(b);
  }
  return rewriteDraftUrisInData(data) as Record<string, unknown>;
}
