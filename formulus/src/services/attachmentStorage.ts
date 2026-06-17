import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { safeAttachmentBasename } from './WebViewFileUrlResolver';

/** Default TTL for files left behind in `attachments/draft/` from abandoned form sessions. */
export const DEFAULT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * On-device attachment directory layout (v2):
 *
 *   attachments/
 *     draft/     unsaved captures owned by the formplayer session
 *     pending/   queued for upload to Synkronus (drained on successful PUT)
 *     synced/    canonical committed + downloaded copies (UI reads here)
 *
 * The v1 layout stored committed files directly under `attachments/` and
 * named the upload queue `pending_upload/`. See {@link runAttachmentLayoutMigrationV2}
 * for the one-shot migration invoked on app start.
 */
export const attachmentsRoot = (): string =>
  `${RNFS.DocumentDirectoryPath}/attachments`;

export const syncedRoot = (): string => `${attachmentsRoot()}/synced`;

export const pendingRoot = (): string => `${attachmentsRoot()}/pending`;

export const draftAttachmentsRoot = (): string => `${attachmentsRoot()}/draft`;

/** Legacy v1 upload queue; only referenced by the migration helper. */
export const legacyPendingUploadRoot = (): string =>
  `${attachmentsRoot()}/pending_upload`;

/** AsyncStorage flag set when the v2 folder-layout migration has run. */
export const ATTACHMENTS_LAYOUT_V2_KEY = '@attachments_layout_v2';

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
  const syncedPath = `${syncedRoot()}/${baseSafe}`;
  const pendingPath = `${pendingRoot()}/${baseSafe}`;
  if (!(await RNFS.exists(draftPath))) {
    return;
  }
  await RNFS.mkdir(syncedRoot());
  await RNFS.mkdir(pendingRoot());
  await RNFS.copyFile(draftPath, syncedPath);
  await RNFS.copyFile(draftPath, pendingPath);
  await RNFS.unlink(draftPath);
}

/** Deep rewrite: draft attachment paths become committed paths under `attachments/synced/`. */
export function rewriteDraftUrisInData(data: unknown): unknown {
  if (data == null) return data;
  if (typeof data === 'string') {
    if (data.includes('/attachments/draft/')) {
      return data.replace(/\/attachments\/draft\//g, '/attachments/synced/');
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
 * `attachments/synced/` + `attachments/pending/`, and return updated JSON with
 * `file://` paths fixed.
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

/**
 * Remove files in `attachments/draft/` older than `ttlMs` (default 24 h).
 * Best-effort: never throws, returns the number of deleted entries. Intended to
 * be called once on app start so abandoned form sessions (camera captures that
 * were never submitted) don't accumulate.
 */
export async function sweepStaleDraftAttachments(
  ttlMs: number = DEFAULT_DRAFT_TTL_MS,
  nowMs: number = Date.now(),
): Promise<number> {
  const dir = draftAttachmentsRoot();
  let removed = 0;
  try {
    const exists = await RNFS.exists(dir);
    if (!exists) {
      return 0;
    }
    const entries = await RNFS.readDir(dir);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const mtime = entry.mtime ? entry.mtime.getTime() : 0;
      const ctime = entry.ctime ? entry.ctime.getTime() : 0;
      const ref = Math.max(mtime, ctime);
      if (ref && nowMs - ref < ttlMs) {
        continue;
      }
      try {
        await RNFS.unlink(entry.path);
        removed += 1;
      } catch (err) {
        console.warn(
          'sweepStaleDraftAttachments: failed to unlink',
          entry.path,
          err,
        );
      }
    }
  } catch (err) {
    console.warn('sweepStaleDraftAttachments: swept failed', err);
  }
  return removed;
}

export interface ObservationPersistDeps {
  saveObservation: (args: {
    formType: string;
    data: Record<string, unknown>;
  }) => Promise<string | null>;
  updateObservation: (args: {
    observationId: string;
    data: Record<string, unknown>;
  }) => Promise<boolean>;
  commitDraftAttachments?: typeof commitDraftAttachmentsAfterSave;
}

export interface PersistObservationInput {
  formType: string;
  finalData: Record<string, unknown>;
  observationId?: string | null;
  subObservationMode: boolean;
}

export interface PersistObservationResult {
  observationId: string;
  formData: Record<string, unknown>;
}

/**
 * Persist an observation and promote any referenced draft attachments.
 *
 * In sub-observation mode the observation is NOT persisted and draft attachments
 * are intentionally NOT promoted — so abandoned / returnOnly child forms never
 * enter the upload queue. In normal mode the draft -> `synced/` + `pending/`
 * copy happens before the DB write, and the returned `formData` has all
 * `/attachments/draft/` paths rewritten to `/attachments/synced/`.
 */
export async function persistObservationWithAttachments(
  input: PersistObservationInput,
  deps: ObservationPersistDeps,
): Promise<PersistObservationResult> {
  const { formType, finalData, observationId, subObservationMode } = input;

  if (subObservationMode) {
    return { observationId: '', formData: finalData };
  }

  const commit = deps.commitDraftAttachments ?? commitDraftAttachmentsAfterSave;
  const committedData = await commit(finalData);

  if (observationId) {
    const ok = await deps.updateObservation({
      observationId,
      data: committedData,
    });
    if (!ok) {
      throw new Error('Failed to update observation');
    }
    return { observationId, formData: committedData };
  }

  const newId = await deps.saveObservation({ formType, data: committedData });
  if (!newId) {
    throw new Error('Failed to save new observation');
  }
  return { observationId: newId, formData: committedData };
}

/**
 * One-shot migration from the v1 attachment folder layout to v2. Idempotent
 * via an AsyncStorage flag. Never throws — any failure is logged and the flag
 * is left unset so the next app start will retry.
 *
 * v1:
 *   attachments/<guid>.jpg           <- committed
 *   attachments/pending_upload/...   <- upload queue
 *   attachments/draft/...
 *
 * v2:
 *   attachments/synced/<guid>.jpg    <- committed
 *   attachments/pending/...          <- upload queue
 *   attachments/draft/...
 *
 * Observation JSON is not rewritten: `resolveAttachmentFileUrl` sanitizes any
 * legacy `/attachments/<name>` or `/attachments/pending_upload/<name>` URI down
 * to its basename and re-resolves it across the v2 subfolders, so in-band data
 * keeps working without touching WatermelonDB.
 */
export async function runAttachmentLayoutMigrationV2(): Promise<boolean> {
  try {
    const existingFlag = await AsyncStorage.getItem(ATTACHMENTS_LAYOUT_V2_KEY);
    if (existingFlag) {
      return false;
    }

    const root = attachmentsRoot();
    if (!(await RNFS.exists(root))) {
      await RNFS.mkdir(root);
    }

    await RNFS.mkdir(syncedRoot());
    await RNFS.mkdir(pendingRoot());
    await RNFS.mkdir(draftAttachmentsRoot());

    // 1) Move any file directly under attachments/ into synced/.
    const topEntries = await RNFS.readDir(root);
    for (const entry of topEntries) {
      if (!entry.isFile()) continue;
      const dest = `${syncedRoot()}/${entry.name}`;
      try {
        if (await RNFS.exists(dest)) {
          await RNFS.unlink(entry.path);
        } else {
          await RNFS.moveFile(entry.path, dest);
        }
      } catch (err) {
        console.warn(
          'runAttachmentLayoutMigrationV2: failed to relocate committed file',
          entry.path,
          err,
        );
      }
    }

    // 2) Move contents of attachments/pending_upload/ into attachments/pending/,
    //    then remove the old directory. Do NOT rename the directory itself —
    //    RNFS.moveFile of a directory is not reliably cross-FS.
    const legacyPending = legacyPendingUploadRoot();
    if (await RNFS.exists(legacyPending)) {
      let legacyFiles: RNFS.ReadDirItem[] = [];
      try {
        legacyFiles = await RNFS.readDir(legacyPending);
      } catch (err) {
        console.warn(
          'runAttachmentLayoutMigrationV2: readDir(pending_upload) failed',
          err,
        );
      }
      for (const entry of legacyFiles) {
        if (!entry.isFile()) continue;
        const dest = `${pendingRoot()}/${entry.name}`;
        try {
          if (await RNFS.exists(dest)) {
            await RNFS.unlink(entry.path);
          } else {
            await RNFS.moveFile(entry.path, dest);
          }
        } catch (err) {
          console.warn(
            'runAttachmentLayoutMigrationV2: failed to relocate pending file',
            entry.path,
            err,
          );
        }
      }
      try {
        await RNFS.unlink(legacyPending);
      } catch (err) {
        console.warn(
          'runAttachmentLayoutMigrationV2: failed to remove pending_upload dir',
          err,
        );
      }
    }

    await AsyncStorage.setItem(ATTACHMENTS_LAYOUT_V2_KEY, '1');
    return true;
  } catch (err) {
    console.warn('runAttachmentLayoutMigrationV2: aborted', err);
    return false;
  }
}
