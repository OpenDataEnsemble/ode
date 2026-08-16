import type {
  ApiObservation,
  HostTextReadResult,
  ObservationExtras,
} from '../types/domain';
import { tauriClient } from './tauriClient';

export interface ParsedObservationFile {
  fileName: string;
  observations: ApiObservation[];
  error?: string;
}

export interface ImportPreflightSummary {
  observationCount: number;
  formTypeCount: number;
  attachmentHintCount: number;
  files: ParsedObservationFile[];
}

function asNonEmptyString(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.trim()) {
    return undefined;
  }
  return v.trim();
}

function asOptionalStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) {
    return undefined;
  }
  const parts = v
    .filter((x): x is string => typeof x === 'string')
    .map(s => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

/** Envelope fields stored in `observation_extras` (Synkronus Observation). */
export function extractObservationExtras(
  o: Record<string, unknown>,
): ObservationExtras | undefined {
  const formVersion =
    asNonEmptyString(o.formVersion) ?? asNonEmptyString(o.form_version);
  const createdAt =
    asNonEmptyString(o.createdAt) ?? asNonEmptyString(o.created_at);
  const syncedAt =
    asNonEmptyString(o.syncedAt) ?? asNonEmptyString(o.synced_at);
  const author = asNonEmptyString(o.author);
  const deviceId =
    asNonEmptyString(o.deviceId) ?? asNonEmptyString(o.device_id);
  const deleted = typeof o.deleted === 'boolean' ? o.deleted : undefined;
  const geolocation =
    o.geolocation != null && typeof o.geolocation === 'object'
      ? o.geolocation
      : undefined;
  const tags = asOptionalStringArray(o.tags);

  if (
    !formVersion &&
    !createdAt &&
    !syncedAt &&
    !author &&
    !deviceId &&
    deleted === undefined &&
    geolocation === undefined &&
    !tags
  ) {
    return undefined;
  }

  return {
    formVersion: formVersion ?? null,
    createdAt: createdAt ?? null,
    syncedAt: syncedAt ?? null,
    author: author ?? null,
    deviceId: deviceId ?? null,
    deleted: deleted ?? null,
    geolocation: geolocation ?? null,
    tags: tags ?? null,
  };
}

/** Normalize one JSON value into ApiObservation[] (0+ per file). */
export function extractObservationsFromJson(
  root: unknown,
  fileName: string,
): { observations: ApiObservation[]; error?: string } {
  if (root === null || root === undefined) {
    return { observations: [], error: `Empty file (${fileName})` };
  }

  const rows: unknown[] = Array.isArray(root)
    ? root
    : typeof root === 'object' && root !== null && 'observations' in root
      ? ((root as { observations?: unknown }).observations as unknown[])
      : [root];

  const observations: ApiObservation[] = [];
  for (const item of rows) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const o = item as Record<string, unknown>;
    const id =
      asNonEmptyString(o.observationId) ??
      asNonEmptyString(o.observation_id) ??
      asNonEmptyString(o.id);
    if (!id) {
      continue;
    }
    const data =
      o.data !== undefined ? o.data : o.payload !== undefined ? o.payload : {};
    const formType =
      asNonEmptyString(o.formType) ?? asNonEmptyString(o.form_type) ?? null;
    const updatedRaw =
      asNonEmptyString(o.updatedAt) ?? asNonEmptyString(o.updated_at);
    let updatedAt: string | null = null;
    if (updatedRaw) {
      updatedAt = updatedRaw;
    } else if (o.updated_at instanceof Date) {
      updatedAt = o.updated_at.toISOString();
    } else {
      updatedAt = new Date().toISOString();
    }
    observations.push({
      observationId: id,
      data,
      formType,
      updatedAt,
      extras: extractObservationExtras(o),
    });
  }

  if (observations.length === 0) {
    return {
      observations: [],
      error:
        'No observation objects with an id (observationId / observation_id / id)',
    };
  }
  return { observations };
}

function countAttachmentHintsInPayload(value: unknown, depth = 0): number {
  if (depth > 12) {
    return 0;
  }
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'string') {
    return 0;
  }
  if (Array.isArray(value)) {
    let n = 0;
    for (const el of value) {
      n += countAttachmentHintsInPayload(el, depth + 1);
    }
    return n;
  }
  if (typeof value === 'object') {
    let n = 0;
    const obj = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      const kl = k.toLowerCase();
      if (
        kl === 'attachment_id' ||
        kl === 'attachmentid' ||
        k === 'attachmentId'
      ) {
        if (typeof v === 'string' && v.trim()) {
          n += 1;
        }
      }
      if (kl === 'attachments' && Array.isArray(v)) {
        n += v.length;
      }
      n += countAttachmentHintsInPayload(v, depth + 1);
    }
    return n;
  }
  return 0;
}

export function summarizeImportFiles(
  parsed: ParsedObservationFile[],
  nonJsonFileCount: number,
): ImportPreflightSummary {
  let observationCount = 0;
  const formTypes = new Set<string>();
  let attachmentHintCount = nonJsonFileCount;

  for (const f of parsed) {
    for (const obs of f.observations) {
      observationCount += 1;
      if (obs.formType?.trim()) {
        formTypes.add(obs.formType.trim());
      }
      attachmentHintCount += countAttachmentHintsInPayload(obs.data);
    }
  }

  return {
    observationCount,
    formTypeCount: formTypes.size,
    attachmentHintCount,
    files: parsed,
  };
}

/** Run async work on `items` with at most `concurrency` in flight (order preserved). */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const n = items.length;
  if (n === 0) {
    return [];
  }
  const results: R[] = new Array(n);
  let next = 0;
  const limit = Math.max(1, Math.min(concurrency, n));

  async function slot(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= n) {
        return;
      }
      results[i] = await worker(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => slot()));
  return results;
}

const DEFAULT_JSON_READ_BATCH = 32;

/** Parse JSON text into observations (synchronous). */
export function parseObservationJsonString(
  fileName: string,
  text: string,
): ParsedObservationFile {
  try {
    const root = JSON.parse(text) as unknown;
    const { observations, error } = extractObservationsFromJson(root, fileName);
    if (error) {
      return { fileName, observations: [], error };
    }
    return { fileName, observations };
  } catch (_e) {
    return { fileName, observations: [], error: 'Invalid JSON' };
  }
}

/** @deprecated Prefer {@link parseObservationJsonString} (sync). */
export async function parseObservationJsonFromText(
  fileName: string,
  text: string,
): Promise<ParsedObservationFile> {
  return parseObservationJsonString(fileName, text);
}

export interface ParseObservationJsonPathsOptions {
  /** After each batch of disk reads (one IPC round-trip) completes. */
  onReadProgress?: (filesRead: number, totalJsonFiles: number) => void;
  /**
   * Paths per batch read (default 32). Rust enforces max 128 paths per invoke.
   */
  readBatchSize?: number;
}

/**
 * Read observation JSON from absolute paths using batched native reads (parallel in Rust per batch).
 */
export async function parseObservationJsonFromPaths(
  items: readonly { name: string; nativePath: string }[],
  readTextBatch: (
    paths: readonly string[],
  ) => Promise<readonly HostTextReadResult[]>,
  options?: ParseObservationJsonPathsOptions,
): Promise<ParsedObservationFile[]> {
  const total = items.length;
  if (total === 0) {
    return [];
  }
  const batchSize = Math.min(
    128,
    Math.max(1, options?.readBatchSize ?? DEFAULT_JSON_READ_BATCH),
  );
  const out: ParsedObservationFile[] = [];
  let filesRead = 0;

  for (let i = 0; i < total; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const paths = chunk.map(it => it.nativePath);
    const reads = await readTextBatch(paths);
    if (reads.length !== chunk.length) {
      throw new Error(
        `readTextBatch returned ${reads.length} results, expected ${chunk.length}`,
      );
    }
    for (let j = 0; j < chunk.length; j++) {
      const item = chunk[j]!;
      const r = reads[j]!;
      if (r.error != null || r.text == null) {
        out.push({
          fileName: item.name,
          observations: [],
          error: r.error ?? 'Could not read file',
        });
      } else {
        out.push(parseObservationJsonString(item.name, r.text));
      }
    }
    filesRead += chunk.length;
    options?.onReadProgress?.(filesRead, total);
  }

  return out;
}

const RUST_PARSE_CHUNK = 128;

/**
 * Read and parse observation JSON via Rust (parallel per chunk). Preserves file order.
 */
export async function parseObservationJsonPathsViaRust(
  items: readonly { name: string; nativePath: string }[],
  onBatchProgress?: (filesRead: number, totalJsonFiles: number) => void,
): Promise<ParsedObservationFile[]> {
  const total = items.length;
  if (total === 0) {
    return [];
  }
  const out: ParsedObservationFile[] = [];
  for (let i = 0; i < total; i += RUST_PARSE_CHUNK) {
    const chunk = items.slice(i, i + RUST_PARSE_CHUNK);
    const paths = chunk.map(c => c.nativePath);
    const rows = await tauriClient.parseImportObservationJsonPaths(paths);
    if (rows.length !== chunk.length) {
      throw new Error(
        `parseImportObservationJsonPaths returned ${rows.length} rows, expected ${chunk.length}`,
      );
    }
    for (let j = 0; j < chunk.length; j++) {
      const r = rows[j]!;
      out.push({
        fileName: r.fileName,
        observations: r.observations,
        error: r.error,
      });
    }
    onBatchProgress?.(Math.min(i + chunk.length, total), total);
  }
  return out;
}

export function flattenObservations(
  parsed: ParsedObservationFile[],
): ApiObservation[] {
  const out: ApiObservation[] = [];
  for (const f of parsed) {
    out.push(...f.observations);
  }
  return out;
}

/**
 * Ignore null / placeholder syncedAt values (same floor as Formulus
 * `MIN_VALID_SYNCED_AT_MS` in observationSyncStatus.ts).
 */
export const MIN_VALID_IMPORT_SYNCED_AT_MS = new Date('1980-01-01').getTime();

function parseImportTimestampMs(raw: string | null | undefined): number | null {
  if (raw == null || !raw.trim()) {
    return null;
  }
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * True when Formulus-style export metadata says the observation was fully
 * synced (`syncedAt` set and `updatedAt <= syncedAt`). Used to offer skipping
 * already-synced rows during hail-mary device exports.
 */
export function isImportObservationApparentlySynced(
  observation: ApiObservation,
): boolean {
  const syncedMs = parseImportTimestampMs(observation.extras?.syncedAt ?? null);
  if (syncedMs == null || syncedMs <= MIN_VALID_IMPORT_SYNCED_AT_MS) {
    return false;
  }
  const updatedMs = parseImportTimestampMs(observation.updatedAt ?? null);
  if (updatedMs == null) {
    return true;
  }
  return updatedMs <= syncedMs;
}

export interface ImportSyncAppearancePartition {
  total: number;
  apparentlySynced: ApiObservation[];
  unsynced: ApiObservation[];
}

/** Split flattened import rows by Formulus sync appearance (`syncedAt`). */
export function partitionImportObservationsBySyncAppearance(
  observations: readonly ApiObservation[],
): ImportSyncAppearancePartition {
  const apparentlySynced: ApiObservation[] = [];
  const unsynced: ApiObservation[] = [];
  for (const obs of observations) {
    if (isImportObservationApparentlySynced(obs)) {
      apparentlySynced.push(obs);
    } else {
      unsynced.push(obs);
    }
  }
  return {
    total: observations.length,
    apparentlySynced,
    unsynced,
  };
}
