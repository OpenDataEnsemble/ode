/**
 * CustomQuestionTypeLoader.ts
 *
 * Loads custom question type modules from source strings.
 * The native Formulus RN side reads each renderer's JS source and
 * passes it in the manifest. This loader evaluates each source in
 * a CommonJS-compatible sandbox.
 *
 * This loader:
 *  1. Iterates over the manifest
 *  2. Evaluates each module's source with CommonJS shims (module, exports)
 *  3. Validates the default export is a function (React component)
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
import Fuse from 'fuse.js';

export interface CustomQuestionTypeLoadResult {
  /** JSON Forms renderer entries ready to be merged into the renderers array */
  renderers: JsonFormsRendererRegistryEntry[];
  /** Format strings that need to be registered with AJV */
  formats: string[];
  /** Any errors that occurred during loading */
  errors: Array<{ format: string; error: string }>;
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
        `[CustomQuestionTypeLoader] Loading "${formatName}" (${meta.source.length} bytes)`,
      );

      // Create a CommonJS-compatible sandbox with module/exports shims
      // The renderers use: module.exports = { default: ComponentFunction }
      // Injected: React, MaterialUI (window), Fuse (formplayer dependency)
      const moduleShim: { exports: Record<string, unknown> } = {
        exports: {},
      };
      const exportsShim = moduleShim.exports;

      // Evaluate the source in a function scope with CommonJS shims
      const factory = new Function(
        'module',
        'exports',
        'React',
        'MaterialUI',
        'Fuse',
        meta.source,
      );
      factory(
        moduleShim,
        exportsShim,
        (window as any).React,
        (window as any).MaterialUI,
        Fuse,
      );

      // Extract the component: try module.exports.default, then module.exports itself
      const component = moduleShim.exports.default ?? moduleShim.exports;

      // Validate that the export is a function (React component)
      if (typeof component !== 'function') {
        throw new Error(
          `Module does not export a valid React component. ` +
            `Expected a function, got ${typeof component}. ` +
            `Make sure your module exports a default function.`,
        );
      }

      loadedComponents.set(
        formatName,
        component as React.ComponentType<CustomQuestionTypeProps>,
      );
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
