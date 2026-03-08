/**
 * CustomValidatorContract.ts
 *
 * Defines the public interface that custom validators must follow.
 * Form authors create validator functions that accept these parameters and return validation errors.
 *
 * Usage in UI Schema:
 *   {
 *     "type": "Control",
 *     "scope": "#/properties/age",
 *     "options": {
 *       "customValidators": [
 *         {
 *           "name": "isAdult",
 *           "config": { "minAge": 18 }
 *         }
 *       ]
 *     }
 *   }
 *
 * Usage in custom_app:
 *   custom_app/validators/isAdult/index.js
 *   module.exports = {
 *     default: function validate({ value, config, path, data }) {
 *       const minAge = config.minAge || 18;
 *       if (typeof value !== 'number' || value < minAge) {
 *         return [{ path, message: `Must be at least ${minAge} years old` }];
 *       }
 *       return [];
 *     }
 *   };
 */

import type Ajv from 'ajv';

/**
 * A validation error returned by a custom validator.
 */
export interface ValidationError {
  /** Data path of the field (e.g., "#/properties/age" or "/age") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** Optional keyword for error categorization (defaults to "customValidator") */
  keyword?: string;
  /** Optional additional parameters */
  params?: Record<string, unknown>;
}

/**
 * Parameters passed to a custom validator function.
 */
export interface CustomValidatorParams {
  /** Full form data object (all field values) */
  data: Record<string, unknown>;
  /** Current field value being validated */
  value: unknown;
  /** Data path of the field (e.g., "#/properties/age") */
  path: string;
  /** Validator configuration object from UI schema */
  config: Record<string, unknown>;
  /** Optional AJV instance for schema validation utilities */
  ajv?: Ajv;
}

/**
 * Custom validator function signature.
 * Returns an array of validation errors, or an empty array/void if validation passes.
 */
export type CustomValidatorFunction = (
  params: CustomValidatorParams,
) => ValidationError[] | void;

/**
 * Manifest passed from the native side describing available custom validators.
 * Each entry maps a validator name to the source code of the module that implements it.
 * The RN side reads the JS file and passes the source string here for sandboxed evaluation.
 */
export interface CustomValidatorManifest {
  validators: Record<
    string,
    {
      /** The JS source code of the module (read by RN via RNFS.readFile) */
      source: string;
    }
  >;
}

/**
 * Extended manifest that includes both question types and validators.
 */
export interface FormplayerManifest {
  custom_types?: Record<string, { source: string }>;
  validators?: Record<string, { source: string }>;
}
