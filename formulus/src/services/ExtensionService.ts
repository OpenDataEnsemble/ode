import RNFS from 'react-native-fs';

/**
 * Extension definition structure
 */
export interface ExtensionDefinition {
  definitions?: Record<string, unknown>; // JSON Schema definitions for $ref
  functions?: Record<string, ExtensionFunction>; // Custom functions
  renderers?: Record<string, ExtensionRenderer>; // Custom question type renderers
}

/**
 * Extension function declaration
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
  // Path to JS module (relative to custom app root)
  module?: string;
  // Export name (defaults to function name)
  export?: string;
}

/**
 * Extension renderer declaration
 */
export interface ExtensionRenderer {
  name: string;
  format: string; // The format string that triggers this renderer
  description?: string;
  // Path to JS module (relative to custom app root)
  module: string;
  // Export names
  tester?: string; // Tester function export name
  renderer?: string; // Renderer component export name (defaults to name)
  // Optional dependencies
  dependencies?: string[];
}

/**
 * Merged extension result
 */
export interface MergedExtensions {
  definitions: Record<string, unknown>;
  functions: Record<string, ExtensionFunction>;
  renderers: Record<string, ExtensionRenderer>;
}

/**
 * Service for loading and merging custom app extensions
 */
export class ExtensionService {
  private static instance: ExtensionService | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ExtensionService {
    if (!ExtensionService.instance) {
      ExtensionService.instance = new ExtensionService();
    }
    return ExtensionService.instance;
  }

  /**
   * Get merged extensions for a custom app
   *
   * Discovers ext.json files in:
   * - /forms/ext.json (app-level)
   * - /forms/{formName}/ext.json (form-level)
   *
   * Merges with precedence: form-level → app-level → core defaults
   *
   * @param customAppPath - Path to the custom app directory
   * @param formName - Optional form name for form-level extensions
   * @returns Merged extension object
   */
  public async getCustomAppExtensions(
    customAppPath: string,
    formName?: string,
  ): Promise<MergedExtensions> {
    const result: MergedExtensions = {
      definitions: {},
      functions: {},
      renderers: {},
    };

    // Load app-level extensions
    const appExtPath = `${customAppPath}/forms/ext.json`;
    const appLevelExt = await this.loadExtensionFile(appExtPath);
    if (appLevelExt) {
      this.mergeExtension(result, appLevelExt);
    } else {
      console.warn(
        `[ExtensionService] App-level ext.json not found or failed to load: ${appExtPath}`,
      );
    }

    // Load form-level extensions (higher precedence)
    if (formName) {
      const formExtPath = `${customAppPath}/forms/${formName}/ext.json`;
      const formLevelExt = await this.loadExtensionFile(formExtPath);
      if (formLevelExt) {
        this.mergeExtension(result, formLevelExt);
      }
    }

    return result;
  }

  /**
   * Load an extension file
   */
  private async loadExtensionFile(
    filePath: string,
  ): Promise<ExtensionDefinition | null> {
    try {
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return null;
      }

      const content = await RNFS.readFile(filePath, 'utf8');
      const rawExtension = JSON.parse(content) as Record<string, unknown>;

      // Normalize the extension format to match ExtensionDefinition interface
      const extension: ExtensionDefinition = {
        // Handle both "schemas.definitions" and direct "definitions"
        definitions:
          rawExtension.definitions || rawExtension.schemas?.definitions || {},

        // Transform functions from {key: {path, export}} to {key: {name, module, export}}
        functions: rawExtension.functions
          ? Object.entries(rawExtension.functions).reduce(
              (acc, [key, func]: [string, Record<string, unknown>]) => {
                acc[key] = {
                  name: key, // Use key as name
                  module: func.path || func.module || '', // Support both "path" and "module"
                  export: func.export || key, // Use export if provided, otherwise use key
                };
                return acc;
              },
              {} as Record<string, ExtensionFunction>,
            )
          : undefined,

        // Transform renderers (similar structure)
        renderers: rawExtension.renderers
          ? Object.entries(rawExtension.renderers).reduce(
              (acc, [key, renderer]: [string, Record<string, unknown>]) => {
                // Handle both flat structure and nested structure
                const rendererObj = renderer.renderer || renderer;
                const testerObj = renderer.tester || {};

                acc[key] = {
                  name: key,
                  format: renderer.format || rendererObj?.format || '',
                  module:
                    rendererObj?.path ||
                    rendererObj?.module ||
                    renderer.module ||
                    '',
                  tester: testerObj?.export || renderer.tester?.export,
                  renderer:
                    rendererObj?.export || renderer.renderer?.export || key,
                };
                return acc;
              },
              {} as Record<string, ExtensionRenderer>,
            )
          : undefined,
      };

      // Validate structure
      this.validateExtension(extension, filePath);

      return extension;
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        // File doesn't exist - this is OK
        return null;
      }
      console.warn(
        `[ExtensionService] Failed to load extension file ${filePath}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Validate extension structure
   */
  private validateExtension(
    extension: ExtensionDefinition,
    filePath: string,
  ): void {
    if (typeof extension !== 'object' || extension === null) {
      throw new Error(`Invalid extension file ${filePath}: must be an object`);
    }

    // Validate functions
    if (extension.functions) {
      if (typeof extension.functions !== 'object') {
        throw new Error(
          `Invalid extension file ${filePath}: functions must be an object`,
        );
      }
      for (const [key, func] of Object.entries(extension.functions)) {
        if (!func.name) {
          throw new Error(
            `Invalid extension file ${filePath}: function ${key} must have a name`,
          );
        }
      }
    }

    // Validate renderers
    if (extension.renderers) {
      if (typeof extension.renderers !== 'object') {
        throw new Error(
          `Invalid extension file ${filePath}: renderers must be an object`,
        );
      }
      for (const [key, renderer] of Object.entries(extension.renderers)) {
        if (!renderer.name) {
          throw new Error(
            `Invalid extension file ${filePath}: renderer ${key} must have a name`,
          );
        }
        // Format can be empty for custom renderers that handle their own testers
        if (!renderer.module) {
          throw new Error(
            `Invalid extension file ${filePath}: renderer ${key} must have a module path`,
          );
        }
      }
    }

    // Validate definitions
    if (extension.definitions) {
      if (typeof extension.definitions !== 'object') {
        throw new Error(
          `Invalid extension file ${filePath}: definitions must be an object`,
        );
      }
    }
  }

  /**
   * Merge extension into result (form-level overrides app-level)
   */
  private mergeExtension(
    result: MergedExtensions,
    extension: ExtensionDefinition,
  ): void {
    // Merge definitions (form-level can override app-level)
    if (extension.definitions) {
      Object.assign(result.definitions, extension.definitions);
    }

    // Merge functions (form-level can override app-level)
    if (extension.functions) {
      Object.assign(result.functions, extension.functions);
    }

    // Merge renderers (form-level can override app-level)
    if (extension.renderers) {
      Object.assign(result.renderers, extension.renderers);
    }
  }

  /**
   * Get all extension files for a custom app (for discovery)
   */
  public async discoverExtensions(
    customAppPath: string,
  ): Promise<Array<{ path: string; type: 'app' | 'form'; formName?: string }>> {
    const extensions: Array<{
      path: string;
      type: 'app' | 'form';
      formName?: string;
    }> = [];

    try {
      // Check app-level extension
      const appExtPath = `${customAppPath}/forms/ext.json`;
      const appExtExists = await RNFS.exists(appExtPath);
      if (appExtExists) {
        extensions.push({ path: appExtPath, type: 'app' });
      }

      // Check form-level extensions
      const formsPath = `${customAppPath}/forms`;
      const formsExists = await RNFS.exists(formsPath);
      if (formsExists) {
        const forms = await RNFS.readDir(formsPath);
        for (const form of forms) {
          if (form.isDirectory()) {
            const formExtPath = `${form.path}/ext.json`;
            const formExtExists = await RNFS.exists(formExtPath);
            if (formExtExists) {
              extensions.push({
                path: formExtPath,
                type: 'form',
                formName: form.name,
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to discover extensions:', error);
    }

    return extensions;
  }
}
