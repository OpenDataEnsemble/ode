import type { ApiObservation } from '../types/domain';

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
      o.data !== undefined
        ? o.data
        : o.payload !== undefined
          ? o.payload
          : {};
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
    });
  }

  if (observations.length === 0) {
    return {
      observations: [],
      error: 'No observation objects with an id (observationId / observation_id / id)',
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

export async function parseObservationJsonFile(
  file: File,
): Promise<ParsedObservationFile> {
  const fileName = file.name;
  try {
    const text = await file.text();
    const root = JSON.parse(text) as unknown;
    const { observations, error } = extractObservationsFromJson(
      root,
      fileName,
    );
    if (error) {
      return { fileName, observations: [], error };
    }
    return { fileName, observations };
  } catch {
    return { fileName, observations: [], error: 'Invalid JSON' };
  }
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
