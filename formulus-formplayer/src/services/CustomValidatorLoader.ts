/**
 * CustomValidatorLoader.ts
 *
 * Loads custom validator modules from source strings.
 * The native Formulus RN side reads each validator's JS source and
 * passes it in the manifest. This loader evaluates each source in
 * a CommonJS-compatible sandbox.
 *
 * This loader:
 *  1. Iterates over the manifest
 *  2. Evaluates each module's source with CommonJS shims (module, exports)
 *  3. Validates the default export is a function (validator function)
 *  4. Passes all loaded validators to the registry
 *  5. Returns loaded validators map
 *
 * Custom validators are referenced in UI schema options.customValidators.
 */

import type {
  CustomValidatorFunction,
  CustomValidatorManifest,
  FormplayerManifest,
} from '../types/CustomValidatorContract';

export interface CustomValidatorLoadResult {
  /** Map of validator name → validator function */
  validators: Map<string, CustomValidatorFunction>;
  /** Any errors that occurred during loading */
  errors: Array<{ name: string; error: string }>;
}

/**
 * Load custom validators from a manifest containing source strings.
 *
 * @param manifest - The manifest describing available custom validators (with source code)
 * @returns Loaded validators map and any errors
 */
export async function loadCustomValidators(
  manifest: FormplayerManifest | CustomValidatorManifest,
): Promise<CustomValidatorLoadResult> {
  const result: CustomValidatorLoadResult = {
    validators: new Map(),
    errors: [],
  };

  // Extract validators from manifest (support both formats)
  const validatorsManifest =
    'validators' in manifest
      ? manifest.validators
      : (manifest as FormplayerManifest).validators;

  if (!validatorsManifest || Object.keys(validatorsManifest).length === 0) {
    console.log('[CustomValidatorLoader] No custom validators in manifest');
    return result;
  }

  for (const [validatorName, meta] of Object.entries(validatorsManifest)) {
    try {
      console.log(
        `[CustomValidatorLoader] Loading "${validatorName}" (${meta.source.length} bytes)`,
      );

      // Create a CommonJS-compatible sandbox with module/exports shims
      // The validators use: module.exports = { default: validateFunction }
      const moduleShim: { exports: Record<string, unknown> } = {
        exports: {},
      };
      const exportsShim = moduleShim.exports;

      // Evaluate the source in a function scope with CommonJS shims
      // Validators don't need React or MaterialUI, but we can provide them if needed
      const factory = new Function('module', 'exports', meta.source);
      factory(moduleShim, exportsShim);

      // Extract the validator: try module.exports.default, then module.exports itself
      const validator = moduleShim.exports.default ?? moduleShim.exports;

      // Validate that the export is a function
      if (typeof validator !== 'function') {
        throw new Error(
          `Module does not export a valid validator function. ` +
            `Expected a function, got ${typeof validator}. ` +
            `Make sure your module exports a default function.`,
        );
      }

      // Validate function signature by checking it accepts one parameter
      // We can't check the exact structure, but we can verify it's callable
      if (validator.length === 0) {
        console.warn(
          `[CustomValidatorLoader] Validator "${validatorName}" doesn't accept parameters. ` +
            `It should accept { data, value, path, config, ajv }`,
        );
      }

      result.validators.set(
        validatorName,
        validator as CustomValidatorFunction,
      );

      console.log(
        `[CustomValidatorLoader] Successfully loaded "${validatorName}"`,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[CustomValidatorLoader] Failed to load "${validatorName}":`,
        errorMessage,
      );
      result.errors.push({ name: validatorName, error: errorMessage });
    }
  }

  if (result.validators.size > 0) {
    console.log(
      `[CustomValidatorLoader] Loaded ${result.validators.size} custom validator(s)`,
    );
  }

  if (result.errors.length > 0) {
    console.warn(
      `[CustomValidatorLoader] ${result.errors.length} validator(s) failed to load:`,
      result.errors.map(e => e.name).join(', '),
    );
  }

  return result;
}
