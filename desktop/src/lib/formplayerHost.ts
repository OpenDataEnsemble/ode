/**
 * Types and placeholders for embedding formplayer (see `formulus-formplayer`).
 * Full WebView host wiring is tracked in the ODE Desktop plan.
 */

/** Mirrors `FormulusInterfaceDefinition.ExtensionMetadata`. */
export interface ExtensionMetadata {
  definitions?: Record<string, unknown>;
  functions?: Record<
    string,
    {
      name: string;
      module: string;
      export?: string;
    }
  >;
  renderers?: Record<
    string,
    {
      name: string;
      format: string;
      module: string;
      tester?: string;
      renderer?: string;
    }
  >;
  basePath?: string;
}

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
  skipFinalize?: boolean;
  /** Skip DraftSelector when the host orchestrates the session. */
  skipDraftSelection?: boolean;
  extensions?: ExtensionMetadata;
  customQuestionTypes?: unknown;
  /**
   * Linked child form specs for sub-observation column label resolution.
   * Populated by the host at open time (Formulus / ODE Desktop preview).
   */
  linkedFormSpecs?: Record<
    string,
    {
      schema: unknown;
      uiSchema: unknown;
    }
  >;
}

/** @deprecated Use `FormInitData` */
export type FormInitDataShape = FormInitData;
