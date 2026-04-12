/**
 * Types and placeholders for embedding formplayer (see `formulus-formplayer`).
 * Full WebView host wiring is tracked in the ODE Desktop plan.
 */

/** Subset of fields hosts pass into formplayer init (expand as integration grows). */
export interface FormInitDataShape {
  formType: string;
  observationId?: string | null;
  params?: unknown;
  savedData?: unknown;
  formSchema?: unknown;
  uiSchema?: unknown;
  extensions?: unknown;
  customQuestionTypes?: unknown;
}
