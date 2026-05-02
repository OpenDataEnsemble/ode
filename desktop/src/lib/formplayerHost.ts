/**
 * Types and placeholders for embedding formplayer (see `formulus-formplayer`).
 * Full WebView host wiring is tracked in the ODE Desktop plan.
 */

/** Mirrors `FormulusInterfaceDefinition.FormInitData` for the embedded formplayer host. */
export interface FormInitData {
  formType: string;
  observationId: string | null;
  params: Record<string, unknown>;
  savedData: Record<string, unknown>;
  formSchema?: unknown;
  uiSchema?: unknown;
  operationId?: string;
  /** Embedded child form returns JSON to parent; host skips persisting as a top-level observation. */
  subObservationMode?: boolean;
  extensions?: unknown;
  customQuestionTypes?: unknown;
}

/** @deprecated Use `FormInitData` */
export type FormInitDataShape = FormInitData;
