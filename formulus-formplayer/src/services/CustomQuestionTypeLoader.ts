/**
 * CustomQuestionTypeLoader.ts
 *
 * Loads custom question type components from source strings provided by the
 * Formulus RN side. Instead of dynamically importing files from the filesystem,
 * this loader evaluates each module's source in a scoped sandbox using
 * `new Function()`, which restricts what the code can access.
 *
 * Security layers:
 *  1. RN-side static blocklist (in CustomQuestionTypeScanner) rejects dangerous patterns
 *  2. Scoped evaluation here only exposes React — no fetch, document, localStorage, etc.
 *
 * This loader:
 *  1. Iterates over the manifest
 *  2. Evaluates each source string in a scoped sandbox
 *  3. Extracts and validates the default export (must be a React component function)
 *  4. Passes all loaded components to the registry
 *  5. Returns renderer entries + format strings for AJV registration
 *
 * Custom question types use "format": "formatName" in schemas (not "type").
 */

import type { JsonFormsRendererRegistryEntry } from '@jsonforms/core';
import type {
  CustomQuestionTypeManifest,
  CustomQuestionTypeProps,
} from '../types/CustomQuestionTypeContract';
import { registerCustomQuestionTypes } from './CustomQuestionTypeRegistry';
import type React from 'react';

export interface CustomQuestionTypeLoadResult {
  /** JSON Forms renderer entries ready to be merged into the renderers array */
  renderers: JsonFormsRendererRegistryEntry[];
  /** Format strings that need to be registered with AJV */
  formats: string[];
  /** Any errors that occurred during loading */
  errors: Array<{ format: string; error: string }>;
}

/**
 * Evaluate a module source string in a scoped sandbox.
 *
 * The code has access to the variables we explicitly pass in:
 *  - module / exports (CommonJS-style export mechanism)
 *  - React (so the component can use createElement, hooks, etc.)
 *  - MaterialUI (full @mui/material package)
 *  - formulus (window.formulus API for safe database queries via getObservationsByQuery)
 *
 * Dangerous globals (fetch, XMLHttpRequest, document, localStorage, etc.)
 * are NOT available in this scope, but formulus API provides safe data access.
 */
function evaluateModuleInSandbox(
  source: string,
  formatName: string,
): React.ComponentType<CustomQuestionTypeProps> {
  const exports: Record<string, unknown> = {};
  const moduleObj = { exports };

  // Get React from the global scope (it's available in the WebView)
  // Try multiple ways to access it (window, globalThis, self)
  const ReactLib =
    (window as unknown as Record<string, unknown>).React ||
    (globalThis as unknown as Record<string, unknown>).React ||
    (self as unknown as Record<string, unknown>).React;

  if (!ReactLib) {
    console.error(
      '[CustomQuestionTypeLoader] React not found in window, globalThis, or self',
    );
    console.error(
      '[CustomQuestionTypeLoader] Available window keys:',
      Object.keys(window).slice(0, 20),
    );
    throw new Error('React is not available in the global scope');
  }

  // Get MUI from the global scope (custom components may use Material UI)
  const MUILib =
    (window as unknown as Record<string, unknown>).MaterialUI ||
    (globalThis as unknown as Record<string, unknown>).MaterialUI ||
    (self as unknown as Record<string, unknown>).MaterialUI;

  // Get Formulus API from global scope (for safe database queries)
  const FormulusAPI =
    (window as unknown as Record<string, unknown>).formulus || null;

  try {
    // Create a factory function with a restricted scope.
    // The code can access: module, exports, React, MaterialUI, formulus (for database queries)
    // It CANNOT access: fetch, XMLHttpRequest, document, localStorage, etc.
    // formulus API provides safe access to getObservationsByQuery, etc.
    const factory = new Function(
      'module',
      'exports',
      'React',
      'MaterialUI',
      'formulus',
      source,
    );

    factory(moduleObj, exports, ReactLib, MUILib, FormulusAPI);
  } catch (err) {
    throw new Error(
      `Failed to evaluate module source: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Extract the component from exports (support both default and module.exports patterns)
  const component =
    (moduleObj.exports as Record<string, unknown>).default ?? moduleObj.exports;

  if (typeof component !== 'function') {
    throw new Error(
      `Module "${formatName}" does not export a valid React component. ` +
        `Expected a function, got ${typeof component}. ` +
        `Make sure your module uses module.exports = Component or exports.default = Component.`,
    );
  }

  return component as React.ComponentType<CustomQuestionTypeProps>;
}

/**
 * Load custom question types from a manifest containing source strings.
 *
 * @param manifest - The manifest describing available custom question types (with source code)
 * @returns Loaded renderers, format strings, and any errors
 */
export async function loadCustomQuestionTypes(
  manifest: CustomQuestionTypeManifest,
): Promise<CustomQuestionTypeLoadResult> {
  const result: CustomQuestionTypeLoadResult = {
    renderers: [],
    formats: [],
    errors: [],
  };

  if (
    !manifest?.custom_types ||
    Object.keys(manifest.custom_types).length === 0
  ) {
    console.log(
      '[CustomQuestionTypeLoader] No custom question types in manifest',
    );
    return result;
  }

  const loadedComponents = new Map<
    string,
    React.ComponentType<CustomQuestionTypeProps>
  >();

  for (const [formatName, meta] of Object.entries(manifest.custom_types)) {
    try {
      console.log(
        `[CustomQuestionTypeLoader] Evaluating "${formatName}" (${meta.source.length} bytes)`,
      );

      // Evaluate the source in a scoped sandbox
      const component = evaluateModuleInSandbox(meta.source, formatName);

      loadedComponents.set(formatName, component);
      result.formats.push(formatName);

      console.log(
        `[CustomQuestionTypeLoader] Successfully loaded "${formatName}"`,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[CustomQuestionTypeLoader] Failed to load "${formatName}":`,
        errorMessage,
      );
      result.errors.push({ format: formatName, error: errorMessage });
    }
  }

  // Register all successfully loaded components
  if (loadedComponents.size > 0) {
    result.renderers = registerCustomQuestionTypes(loadedComponents);
    console.log(
      `[CustomQuestionTypeLoader] Registered ${loadedComponents.size} custom question type(s)`,
    );
  }

  if (result.errors.length > 0) {
    console.warn(
      `[CustomQuestionTypeLoader] ${result.errors.length} format(s) failed to load:`,
      result.errors.map(e => e.format).join(', '),
    );
  }

  return result;
}
