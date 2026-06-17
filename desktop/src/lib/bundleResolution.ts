/**
 * Bundle extension resolution aligned with Formulus `ExtensionService` merge rules
 * (`formulus/src/services/ExtensionService.ts`).
 *
 * File I/O is provided by the caller; this module merges parsed `ext.json` payloads.
 */

export interface ExtensionFunction {
  name: string;
  description?: string;
  parameters?: Array<{
    name: string;
    type: string;
    required?: boolean;
  }>;
  returnType?: string;
  module?: string;
  export?: string;
}

export interface ExtensionRenderer {
  name: string;
  format: string;
  description?: string;
  module: string;
  tester?: string;
  renderer?: string;
  dependencies?: string[];
}

/** Parsed body of a single `ext.json` (normalized). */
export interface ExtensionDefinition {
  definitions: Record<string, unknown>;
  functions: Record<string, ExtensionFunction>;
  renderers: Record<string, ExtensionRenderer>;
}

export interface MergedExtensions {
  definitions: Record<string, unknown>;
  functions: Record<string, ExtensionFunction>;
  renderers: Record<string, ExtensionRenderer>;
}

/**
 * Normalize raw JSON from disk into `ExtensionDefinition` (same field mapping as Formulus).
 */
export function normalizeExtJson(
  raw: Record<string, unknown>,
): ExtensionDefinition {
  const definitions =
    (raw.definitions as Record<string, unknown> | undefined) ??
    (raw.schemas as { definitions?: Record<string, unknown> } | undefined)
      ?.definitions ??
    {};

  const functionsRaw = raw.functions as
    | Record<string, Record<string, unknown>>
    | undefined;
  const functions: Record<string, ExtensionFunction> = {};
  if (functionsRaw) {
    for (const [key, func] of Object.entries(functionsRaw)) {
      functions[key] = {
        name: key,
        module: (func.path as string) || (func.module as string) || '',
        export: (func.export as string) || key,
      };
    }
  }

  const renderersRaw = raw.renderers as
    | Record<string, Record<string, unknown>>
    | undefined;
  const renderers: Record<string, ExtensionRenderer> = {};
  if (renderersRaw) {
    for (const [key, renderer] of Object.entries(renderersRaw)) {
      const rendererObj =
        (renderer.renderer as Record<string, unknown>) || renderer;
      const testerObj = (renderer.tester as Record<string, unknown>) || {};
      renderers[key] = {
        name: key,
        format:
          (renderer.format as string) || (rendererObj?.format as string) || '',
        module:
          (rendererObj?.path as string) ||
          (rendererObj?.module as string) ||
          (renderer.module as string) ||
          '',
        tester: (testerObj?.export as string) || undefined,
        renderer:
          (rendererObj?.export as string) ||
          (renderer.renderer as { export?: string })?.export ||
          key,
      };
    }
  }

  return { definitions, functions, renderers };
}

function mergeExtension(
  into: MergedExtensions,
  layer: ExtensionDefinition,
): void {
  Object.assign(into.definitions, layer.definitions);
  Object.assign(into.functions, layer.functions);
  Object.assign(into.renderers, layer.renderers);
}

/**
 * Merge precedence: **form-level → app-level** (later wins over earlier when using
 * `mergeExtension` in Formulus order: app first, then form).
 *
 * Pass `appLevel` first, then `formLevel` so form overrides app.
 */
export function mergeExtensionsFromLayers(
  appLevel: ExtensionDefinition | null,
  formLevel: ExtensionDefinition | null,
): MergedExtensions {
  const result: MergedExtensions = {
    definitions: {},
    functions: {},
    renderers: {},
  };
  if (appLevel) {
    mergeExtension(result, appLevel);
  }
  if (formLevel) {
    mergeExtension(result, formLevel);
  }
  return result;
}

/** Paths under a resolved bundle root (POSIX-style segments). */
export function appLevelExtJsonPath(bundleRoot: string): string {
  return `${bundleRoot.replace(/[/\\]+$/, '')}/forms/ext.json`;
}

export function formLevelExtJsonPath(
  bundleRoot: string,
  formName: string,
): string {
  return `${bundleRoot.replace(/[/\\]+$/, '')}/forms/${formName}/ext.json`;
}
