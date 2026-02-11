/**
 * Extension Loader for Formplayer
 *
 * Dynamically loads and registers custom extensions (renderers, functions, definitions)
 * from custom app extensions.
 */

import { JsonFormsRendererRegistryEntry, RankedTester } from '@jsonforms/core';

/**
 * Extension metadata passed from Formulus
 */
export interface ExtensionMetadata {
  definitions?: Record<string, any>;
  functions?: Record<string, ExtensionFunctionMetadata>;
  renderers?: Record<string, ExtensionRendererMetadata>;
  basePath?: string; // Base path for loading modules (e.g., file:///...)
}

export interface ExtensionFunctionMetadata {
  name: string;
  module: string;
  export?: string;
}

export interface ExtensionRendererMetadata {
  name: string;
  format: string;
  module: string;
  tester?: string;
  renderer?: string;
}

/**
 * Loaded extension renderer
 */
export interface LoadedRenderer {
  tester: RankedTester;
  renderer: React.ComponentType<any>;
}

/**
 * Extension loader result
 */
export interface ExtensionLoadResult {
  renderers: JsonFormsRendererRegistryEntry[];
  // Functions with explicit signature for type safety
  functions: Map<string, (...args: any[]) => any>;
  definitions: Record<string, any>;
  errors: Array<{ type: string; message: string; details?: any }>;
}

/**
 * Load extensions dynamically
 */
export async function loadExtensions(
  metadata: ExtensionMetadata,
): Promise<ExtensionLoadResult> {
  const result: ExtensionLoadResult = {
    renderers: [],
    functions: new Map<string, (...args: any[]) => any>(),
    definitions: metadata.definitions || {},
    errors: [],
  };

  const basePath = metadata.basePath || '';

  // Load renderers
  if (metadata.renderers) {
    for (const [key, rendererMeta] of Object.entries(metadata.renderers)) {
      try {
        const loadedRenderer = await loadRenderer(rendererMeta, basePath);
        if (loadedRenderer) {
          result.renderers.push({
            tester: loadedRenderer.tester,
            renderer: loadedRenderer.renderer,
          });
        }
      } catch (error) {
        result.errors.push({
          type: 'renderer_load_error',
          message: `Failed to load renderer ${key}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          details: { renderer: key, error },
        });
        console.error(`Failed to load renderer ${key}:`, error);
      }
    }
  }

  // Load functions
  if (metadata.functions) {
    for (const [key, funcMeta] of Object.entries(metadata.functions)) {
      try {
        const loadedFunction = await loadFunction(funcMeta, basePath);
        if (loadedFunction) {
          result.functions.set(
            funcMeta.name,
            loadedFunction as (...args: any[]) => any,
          );
          console.log(
            `[ExtensionsLoader] Registered extension function "${funcMeta.name}" from module "${funcMeta.module}" (metadata key: ${key})`,
          );
        }
      } catch (error) {
        result.errors.push({
          type: 'function_load_error',
          message: `Failed to load function ${key}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          details: { function: key, error },
        });
        console.warn(`Failed to load function ${key}:`, error);
      }
    }
  }

  return result;
}

/**
 * Load a renderer module
 */
async function loadRenderer(
  metadata: ExtensionRendererMetadata,
  basePath: string,
): Promise<LoadedRenderer | null> {
  try {
    // Construct module path
    const modulePath = basePath
      ? `${basePath}/${metadata.module}`
      : metadata.module;

    // Dynamic import - handle both file:// URLs and relative paths
    // Note: Dynamic imports with variables are required for runtime extension loading
    // Webpack warnings are expected and can be safely ignored
    let module: any;
    try {
      // Try dynamic import (works for file:// URLs in WebView)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Dynamic import path is intentionally variable for runtime loading
      module = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePath
      );
    } catch {
      // Fallback: try with .js extension
      const modulePathWithExt = modulePath.endsWith('.js')
        ? modulePath
        : `${modulePath}.js`;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Dynamic import path is intentionally variable for runtime loading
      module = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePathWithExt
      );
    }

    // Get tester function
    const testerName = metadata.tester || `${metadata.name}Tester`;
    const tester = module[testerName] || module.default?.tester;
    if (!tester) {
      throw new Error(
        `Tester function "${testerName}" not found in module ${metadata.module}`,
      );
    }

    // Get renderer component
    const rendererName = metadata.renderer || metadata.name;
    const renderer =
      module[rendererName] || module.default?.renderer || module.default;
    if (!renderer) {
      throw new Error(
        `Renderer component "${rendererName}" not found in module ${metadata.module}`,
      );
    }

    return {
      tester,
      renderer,
    };
  } catch (error) {
    console.error(`Error loading renderer ${metadata.name}:`, error);
    throw error;
  }
}

/**
 * Load a function module
 */
async function loadFunction(
  metadata: ExtensionFunctionMetadata,
  basePath: string,
): Promise<((...args: any[]) => any) | null> {
  try {
    // Construct module path
    const modulePath = basePath
      ? `${basePath}/${metadata.module}`
      : metadata.module;

    // Dynamic import
    // Note: Dynamic imports with variables are required for runtime extension loading
    // Webpack warnings are expected and can be safely ignored
    let module: any;
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Dynamic import path is intentionally variable for runtime loading
      module = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePath
      );
    } catch {
      const modulePathWithExt = modulePath.endsWith('.js')
        ? modulePath
        : `${modulePath}.js`;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Dynamic import path is intentionally variable for runtime loading
      module = await import(
        /* @vite-ignore */ /* webpackIgnore: true */ modulePathWithExt
      );
    }

    // Get function
    const exportName = metadata.export || metadata.name;
    const func = module[exportName] || module.default;
    if (!func || typeof func !== 'function') {
      throw new Error(
        `Function "${exportName}" not found or not a function in module ${metadata.module}`,
      );
    }

    return func;
  } catch (error) {
    console.error(`Error loading function ${metadata.name}:`, error);
    throw error;
  }
}
