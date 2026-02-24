/**
 * CustomQuestionTypeLoader.ts
 *
 * Loads custom question type modules from the custom_app archive.
 * The native Formulus RN side scans `custom_app/question_types/` and
 * provides a manifest mapping format names to module paths.
 *
 * This loader:
 *  1. Iterates over the manifest
 *  2. Dynamically imports each module
 *  3. Validates the default export is a function (React component)
 *  4. Passes all loaded components to the registry
 *  5. Returns renderer entries + format strings for AJV registration
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
 * Load custom question types from a manifest.
 *
 * @param manifest - The manifest describing available custom question types
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
        `[CustomQuestionTypeLoader] Loading "${formatName}" from ${meta.modulePath}`,
      );

      // Dynamic import of the module
      const module = await import(/* @vite-ignore */ meta.modulePath);

      // Get the default export
      const component = module.default ?? module;

      // Validate that the export is a function (React component)
      if (typeof component !== 'function') {
        throw new Error(
          `Module does not export a valid React component. ` +
            `Expected a function, got ${typeof component}. ` +
            `Make sure your module has a default export.`,
        );
      }

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
      `[CustomQuestionTypeLoader] ${result.errors.length} type(s) failed to load:`,
      result.errors.map(e => e.format).join(', '),
    );
  }

  return result;
}
