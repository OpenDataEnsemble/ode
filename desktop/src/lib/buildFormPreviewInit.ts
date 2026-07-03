import type { FormInitData } from './formplayerHost';
import { sanitizePortableAttachmentsInFormData } from './sanitizeFormSavedData';
import { resolveDesktopUiLocale } from './uiLocale';
import { resolveDesktopFormLocale } from './formLocale';
import {
  buildLinkedFormSpecs,
  type LoadLinkedFormSpec,
} from './buildLinkedFormSpecs';
import type { BundleFormSpec } from '../types/domain';

/** Infer SQLite observation id from embedded saved row data (matches Workbench navigate-from-custom-app). */
export function inferObservationIdFromSavedData(
  savedData: Record<string, unknown>,
): string | null {
  const oid = savedData.observationId;
  if (typeof oid === 'string' && oid.trim()) {
    return oid.trim();
  }
  const id = savedData.id;
  if (typeof id === 'string' && id.trim()) {
    return id.trim();
  }
  return null;
}

export function buildFormPreviewInit(args: {
  formType: string;
  params: Record<string, unknown>;
  savedData: Record<string, unknown>;
  formSchema: unknown;
  uiSchema: unknown;
  /** When set, formplayer treats this as edit mode (`updateObservation` on finalize). */
  observationId?: string | null;
  /** Nested sub-observation session opened via `openFormplayer`. */
  subObservationMode?: boolean;
  skipFinalize?: boolean;
  skipDraftSelection?: boolean;
  extensions?: FormInitData['extensions'];
  customQuestionTypes?: FormInitData['customQuestionTypes'];
  linkedFormSpecs?: FormInitData['linkedFormSpecs'];
}): FormInitData {
  const locale =
    typeof args.params.locale === 'string'
      ? resolveDesktopUiLocale(args.params.locale)
      : resolveDesktopUiLocale();
  const savedFormLocale =
    typeof args.savedData.formLocale === 'string'
      ? args.savedData.formLocale
      : null;
  const formLocale = resolveDesktopFormLocale(
    typeof args.params.formLocale === 'string' ? args.params.formLocale : null,
    savedFormLocale,
  );
  const init: FormInitData = {
    formType: args.formType,
    observationId: args.observationId ?? null,
    params: { ...args.params, locale, formLocale },
    savedData: sanitizePortableAttachmentsInFormData(args.savedData),
    formSchema: args.formSchema,
    uiSchema: args.uiSchema,
    extensions: args.extensions,
    customQuestionTypes: args.customQuestionTypes,
  };
  if (args.subObservationMode) {
    init.subObservationMode = true;
  }
  if (args.skipFinalize) {
    init.skipFinalize = true;
  }
  if (args.skipDraftSelection) {
    init.skipDraftSelection = true;
  }
  if (args.linkedFormSpecs) {
    init.linkedFormSpecs = args.linkedFormSpecs;
  }
  return init;
}

/**
 * Build preview init from a bundle form spec, including linked child forms for sub-obs columns.
 */
export async function buildFormPreviewInitFromBundleSpec(args: {
  spec: BundleFormSpec;
  params: Record<string, unknown>;
  savedData: Record<string, unknown>;
  observationId?: string | null;
  subObservationMode?: boolean;
  skipFinalize?: boolean;
  skipDraftSelection?: boolean;
  extensions?: FormInitData['extensions'];
  customQuestionTypes?: FormInitData['customQuestionTypes'];
  loadLinkedFormSpec: LoadLinkedFormSpec;
}): Promise<FormInitData> {
  const linkedFormSpecs = await buildLinkedFormSpecs(
    args.spec.formSchema,
    args.loadLinkedFormSpec,
  );
  return buildFormPreviewInit({
    formType: args.spec.formType,
    observationId: args.observationId ?? null,
    params: args.params,
    savedData: args.savedData,
    formSchema: args.spec.formSchema,
    uiSchema: args.spec.uiSchema,
    extensions: args.extensions,
    customQuestionTypes: args.customQuestionTypes,
    subObservationMode: args.subObservationMode,
    skipFinalize: args.skipFinalize,
    skipDraftSelection: args.skipDraftSelection,
    linkedFormSpecs,
  });
}

export function parseJsonObject(
  text: string,
  label: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { ok: true, value: {} };
  }
  try {
    const v = JSON.parse(trimmed) as unknown;
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      return {
        ok: false,
        error: `${label} must be a JSON object (e.g. {}).`,
      };
    }
    return { ok: true, value: v as Record<string, unknown> };
  } catch (e) {
    return {
      ok: false,
      error: `${label}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
