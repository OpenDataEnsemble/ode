import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { ApiObservation } from '../types/domain';
import type { BundleFormSpec } from '../types/domain';
import {
  referencedAttachmentNamesFromSchemaAndData,
  referencedAttachmentNamesHeuristic,
} from './attachmentReferenceExtraction';
import type { ParsedObservationFile } from './importSummary';

/** Formplayer / AJV custom formats — treated as valid (same idea as formplayer). */
const FORMPLAYER_CUSTOM_FORMATS = [
  'photo',
  'select_file',
  'signature',
  'audio',
  'video',
  'qrcode',
  'gps',
  'adate',
];

export type ImportIssueSeverity = 'error' | 'warning';

export interface ImportIssue {
  severity: ImportIssueSeverity;
  code: string;
  message: string;
  fileName?: string;
  observationId?: string;
  formType?: string | null;
}

export interface ImportValidationReport {
  issues: ImportIssue[];
  parsedFiles: ParsedObservationFile[];
  observationCount: number;
  formTypeCount: number;
  stagedAttachmentBasenames: string[];
  /** Union of referenced attachment basenames across observations. */
  referencedAttachmentNames: string[];
  missingAttachmentNames: string[];
  orphanAttachmentNames: string[];
}

function createAjv(): Ajv {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    validateSchema: false,
    validateFormats: false,
  });
  addFormats(ajv);
  for (const f of FORMPLAYER_CUSTOM_FORMATS) {
    try {
      ajv.addFormat(f, () => true);
    } catch {
      /* format may already be registered */
    }
  }
  return ajv;
}

export function normalizeBasename(s: string): string {
  return s.trim().toLowerCase();
}

function ajvErrorMessage(err: ErrorObject): string {
  const path = err.instancePath || '(root)';
  const msg = err.message ?? 'invalid';
  return `${path}: ${msg}`;
}

/** Same attachment refs as import validation: schema paths + heuristic (when schema missing). */
export function referencedNamesForObservation(
  formSchema: unknown | undefined,
  data: unknown,
): Set<string> {
  const refs = new Set<string>();
  if (formSchema !== undefined) {
    for (const n of referencedAttachmentNamesFromSchemaAndData(
      formSchema,
      data,
    )) {
      refs.add(n);
    }
  }
  for (const n of referencedAttachmentNamesHeuristic(data)) {
    refs.add(n);
  }
  return refs;
}

export interface RunImportValidationInput {
  parsedFiles: ParsedObservationFile[];
  formSpecsByType: Map<string, BundleFormSpec>;
  stagedAttachmentBasenames: string[];
  /** Called after each file’s validation pass (including parse-only failures). */
  onFileValidated?: (
    fileIndex: number,
    totalFiles: number,
    fileName: string,
  ) => void;
}

/**
 * Validates staged JSON observations against bundle form schemas (AJV) and
 * reconciles attachment basenames with staged files.
 */
/** Stable identity for staging dedupe / “staging changed” detection. */
export interface StagingFileMeta {
  name: string;
  size: number;
  lastModified: number;
}

export function stagingFileKey(m: StagingFileMeta): string {
  return `${m.name}:${m.size}:${m.lastModified}`;
}

/** Accepts a DOM `File` or explicit metadata (path-based staging). */
export function fileKeyForStaging(file: File | StagingFileMeta): string {
  return stagingFileKey(
    file instanceof File
      ? { name: file.name, size: file.size, lastModified: file.lastModified }
      : file,
  );
}

export function computeStagingKey(
  jsonFiles: StagingFileMeta[],
  attachmentFiles: StagingFileMeta[],
): string {
  const j = jsonFiles.map(stagingFileKey).sort().join('\0');
  const a = attachmentFiles.map(stagingFileKey).sort().join('\0');
  return `j:${j}|a:${a}`;
}

export function runImportValidation(
  input: RunImportValidationInput,
): ImportValidationReport {
  const issues: ImportIssue[] = [];
  const { parsedFiles, formSpecsByType, stagedAttachmentBasenames } = input;

  const formTypes = new Set<string>();
  let observationCount = 0;

  for (const f of parsedFiles) {
    if (f.error) {
      issues.push({
        severity: 'error',
        code: 'parse_file',
        message: `${f.fileName}: ${f.error}`,
        fileName: f.fileName,
      });
      continue;
    }
    for (const obs of f.observations) {
      observationCount += 1;
      if (obs.formType?.trim()) {
        formTypes.add(obs.formType.trim());
      }
    }
  }

  const ajv = createAjv();
  const validators = new Map<string, ValidateFunction>();
  const compileErrors = new Map<string, string>();

  for (const ft of formTypes) {
    const spec = formSpecsByType.get(ft);
    if (!spec) {
      continue;
    }
    try {
      validators.set(ft, ajv.compile(spec.formSchema as object));
    } catch (e) {
      compileErrors.set(
        ft,
        e instanceof Error ? e.message : 'Failed to compile schema',
      );
    }
  }

  for (const ft of formTypes) {
    if (!formSpecsByType.has(ft)) {
      issues.push({
        severity: 'error',
        code: 'missing_form_schema',
        message: `No form schema in the active app bundle for form type "${ft}".`,
        formType: ft,
      });
    } else if (compileErrors.has(ft)) {
      issues.push({
        severity: 'error',
        code: 'invalid_form_schema',
        message: `Could not compile JSON Schema for form type "${ft}": ${compileErrors.get(ft)}`,
        formType: ft,
      });
    }
  }

  const allReferenced = new Set<string>();

  const totalFiles = parsedFiles.length;
  for (let fi = 0; fi < parsedFiles.length; fi++) {
    const f = parsedFiles[fi]!;
    if (!f.error) {
      for (const obs of f.observations) {
        pushObservationIssues(
          f.fileName,
          obs,
          formSpecsByType,
          validators,
          issues,
          allReferenced,
        );
      }
    }
    input.onFileValidated?.(fi, totalFiles, f.fileName);
  }

  const stagedNorm = new Map<string, string>();
  for (const b of stagedAttachmentBasenames) {
    const k = normalizeBasename(b);
    if (k && !stagedNorm.has(k)) {
      stagedNorm.set(k, b);
    }
  }

  const referencedList = [...allReferenced];
  const missing: string[] = [];
  for (const ref of referencedList) {
    const kn = normalizeBasename(ref);
    if (kn && !stagedNorm.has(kn)) {
      missing.push(ref);
    }
  }
  missing.sort();

  const referencedNorm = new Set(
    referencedList.map(r => normalizeBasename(r)).filter(Boolean),
  );
  const orphan: string[] = [];
  for (const [norm, display] of stagedNorm) {
    if (!referencedNorm.has(norm)) {
      orphan.push(display);
    }
  }
  orphan.sort((a, b) => a.localeCompare(b));

  for (const m of missing) {
    issues.push({
      severity: 'error',
      code: 'missing_attachment',
      message: `Referenced attachment "${m}" is not in the staged attachment list.`,
    });
  }
  for (const o of orphan) {
    issues.push({
      severity: 'warning',
      code: 'orphan_attachment',
      message: `Staged attachment "${o}" is not referenced by any staged observation payload.`,
    });
  }

  return {
    issues,
    parsedFiles,
    observationCount,
    formTypeCount: formTypes.size,
    stagedAttachmentBasenames: [...stagedAttachmentBasenames].sort((a, b) =>
      a.localeCompare(b),
    ),
    referencedAttachmentNames: referencedList.sort((a, b) =>
      a.localeCompare(b),
    ),
    missingAttachmentNames: missing,
    orphanAttachmentNames: orphan,
  };
}

function pushObservationIssues(
  fileName: string,
  obs: ApiObservation,
  formSpecsByType: Map<string, BundleFormSpec>,
  validators: Map<string, ValidateFunction>,
  issues: ImportIssue[],
  allReferenced: Set<string>,
) {
  const ft = obs.formType?.trim();
  const data = obs.data;
  let formSchema: unknown | undefined;

  if (!ft) {
    issues.push({
      severity: 'warning',
      code: 'missing_form_type',
      message: `Observation ${obs.observationId} has no formType; schema validation was skipped (attachment checks use heuristics only).`,
      fileName,
      observationId: obs.observationId,
      formType: null,
    });
  } else {
    const spec = formSpecsByType.get(ft);
    formSchema = spec?.formSchema;
    const validate = validators.get(ft);
    if (validate && spec) {
      const ok = validate(data);
      if (!ok && validate.errors?.length) {
        for (const err of validate.errors) {
          issues.push({
            severity: 'error',
            code: 'schema_validation',
            message: `${obs.observationId}: ${ajvErrorMessage(err)}`,
            fileName,
            observationId: obs.observationId,
            formType: ft,
          });
        }
      }
    }
  }

  const refs = referencedNamesForObservation(formSchema, data);
  for (const r of refs) {
    allReferenced.add(r);
  }
}

/** Validate a single observation payload against a bundle form spec (save-time). */
export function validateObservationPayload(
  observationId: string,
  formType: string | null | undefined,
  data: unknown,
  formSpec: BundleFormSpec | undefined,
): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const ft = formType?.trim();
  if (!ft) {
    return issues;
  }
  if (!formSpec) {
    issues.push({
      severity: 'warning',
      code: 'missing_form_schema',
      message: `No form schema in the active app bundle for form type "${ft}".`,
      observationId,
      formType: ft,
    });
    return issues;
  }
  const ajv = createAjv();
  let validate: ValidateFunction;
  try {
    validate = ajv.compile(formSpec.formSchema as object);
  } catch (e) {
    issues.push({
      severity: 'error',
      code: 'invalid_form_schema',
      message: `Could not compile JSON Schema for "${ft}": ${e instanceof Error ? e.message : String(e)}`,
      observationId,
      formType: ft,
    });
    return issues;
  }
  const ok = validate(data);
  if (!ok && validate.errors?.length) {
    for (const err of validate.errors) {
      issues.push({
        severity: 'error',
        code: 'schema_validation',
        message: ajvErrorMessage(err),
        observationId,
        formType: ft,
      });
    }
  }
  return issues;
}

export type ImportIssueCategory =
  'schema' | 'observation' | 'attachment' | 'other';

export function categorizeImportIssue(issue: ImportIssue): ImportIssueCategory {
  const code = issue.code;
  if (
    code === 'missing_form_schema' ||
    code === 'invalid_form_schema' ||
    code === 'schema_validation'
  ) {
    return 'schema';
  }
  if (code === 'missing_attachment' || code === 'orphan_attachment') {
    return 'attachment';
  }
  if (code === 'parse_file' || code === 'missing_form_type') {
    return 'observation';
  }
  return 'other';
}

export function groupIssuesBySeverityAndCategory(issues: ImportIssue[]): {
  errors: Record<ImportIssueCategory, ImportIssue[]>;
  warnings: Record<ImportIssueCategory, ImportIssue[]>;
} {
  const empty = (): Record<ImportIssueCategory, ImportIssue[]> => ({
    schema: [],
    observation: [],
    attachment: [],
    other: [],
  });
  const errors = empty();
  const warnings = empty();
  for (const issue of issues) {
    const cat = categorizeImportIssue(issue);
    if (issue.severity === 'error') {
      errors[cat].push(issue);
    } else {
      warnings[cat].push(issue);
    }
  }
  return { errors, warnings };
}
