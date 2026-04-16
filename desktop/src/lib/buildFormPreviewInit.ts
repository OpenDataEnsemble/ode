import type { FormInitData } from './formplayerHost';

export function buildFormPreviewInit(args: {
  formType: string;
  params: Record<string, unknown>;
  savedData: Record<string, unknown>;
  formSchema: unknown;
  uiSchema: unknown;
  /** When set, formplayer treats this as edit mode (`updateObservation` on finalize). */
  observationId?: string | null;
  extensions?: FormInitData['extensions'];
  customQuestionTypes?: FormInitData['customQuestionTypes'];
}): FormInitData {
  return {
    formType: args.formType,
    observationId: args.observationId ?? null,
    params: args.params,
    savedData: args.savedData,
    formSchema: args.formSchema,
    uiSchema: args.uiSchema,
    extensions: args.extensions,
    customQuestionTypes: args.customQuestionTypes,
  };
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
