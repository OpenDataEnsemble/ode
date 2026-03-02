/**
 * CustomValidatorExecutor.ts
 *
 * Executes custom validators in the JSON Forms validation lifecycle.
 * Extracts validators from UI schema options, executes them with form context,
 * and converts errors to JSON Forms/AJV-compatible format.
 */

import type { ErrorObject } from 'ajv';
import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import type {
  CustomValidatorFunction,
  ValidationError as CustomValidationError,
} from '../types/CustomValidatorContract';
import { customValidatorRegistry } from './CustomValidatorRegistry';
import type Ajv from 'ajv';

/**
 * Configuration for a custom validator reference in UI schema.
 */
export interface CustomValidatorReference {
  /** Validator name (must match registry) */
  name: string;
  /** Validator configuration object */
  config?: Record<string, unknown>;
}

/**
 * Extract custom validators from UI schema options.
 *
 * @param uischema - UI schema element (Control, Layout, etc.)
 * @returns Array of validator references, or empty array
 */
export function extractCustomValidators(
  uischema: UISchemaElement | undefined,
): CustomValidatorReference[] {
  if (!uischema || typeof uischema !== 'object') {
    return [];
  }

  // Check if this is a Control with options.customValidators
  const options = (uischema as any).options;
  if (!options || typeof options !== 'object') {
    return [];
  }

  const customValidators = options.customValidators;
  if (!Array.isArray(customValidators)) {
    return [];
  }

  return customValidators
    .filter((ref: any) => ref && typeof ref === 'object' && ref.name)
    .map((ref: any) => ({
      name: String(ref.name),
      config: ref.config || {},
    }));
}

/**
 * Convert a data path (e.g., "#/properties/age") to an instance path (e.g., "/age").
 *
 * @param path - JSON Schema path
 * @returns Instance path for AJV errors
 */
function pathToInstancePath(path: string): string {
  // Remove "#/properties/" prefix and convert to instance path
  if (path.startsWith('#/properties/')) {
    return '/' + path.replace('#/properties/', '').replace(/\//g, '/');
  }
  // If already an instance path, return as-is
  if (path.startsWith('/')) {
    return path;
  }
  // Fallback: remove leading "#" and convert
  return path.replace(/^#/, '').replace(/\/properties\//g, '/');
}

/**
 * Convert custom validation errors to AJV ErrorObject format.
 *
 * @param errors - Custom validation errors
 * @param fieldPath - Field path (e.g., "#/properties/age")
 * @returns AJV-compatible error objects
 */
function convertToAjvErrors(
  errors: CustomValidationError[],
  fieldPath: string,
): ErrorObject[] {
  const instancePath = pathToInstancePath(fieldPath);

  return errors.map(error => {
    const ajvError: ErrorObject = {
      instancePath: error.path ? pathToInstancePath(error.path) : instancePath,
      schemaPath: fieldPath,
      keyword: error.keyword || 'customValidator',
      params: error.params || {},
      message: error.message,
    };
    return ajvError;
  });
}

/**
 * Execute custom validators for a specific field.
 *
 * @param validatorRefs - Array of validator references from UI schema
 * @param data - Full form data
 * @param value - Current field value
 * @param path - Field path (e.g., "#/properties/age")
 * @param ajv - Optional AJV instance
 * @returns Array of AJV-compatible error objects
 */
export function executeCustomValidators(
  validatorRefs: CustomValidatorReference[],
  data: Record<string, unknown>,
  value: unknown,
  path: string,
  ajv?: Ajv,
): ErrorObject[] {
  const allErrors: ErrorObject[] = [];

  for (const ref of validatorRefs) {
    const validator = customValidatorRegistry.get(ref.name);

    if (!validator) {
      console.warn(
        `[CustomValidatorExecutor] Validator "${ref.name}" not found in registry. ` +
          `Available validators: ${customValidatorRegistry.getNames().join(', ')}`,
      );
      continue;
    }

    try {
      // Execute validator with full context
      const result = validator({
        data,
        value,
        path,
        config: ref.config || {},
        ajv,
      });

      // Convert result to array of errors
      const errors: CustomValidationError[] = Array.isArray(result)
        ? result
        : result !== undefined && result !== null
          ? [result as CustomValidationError]
          : [];

      // Convert to AJV format
      const ajvErrors = convertToAjvErrors(errors, path);
      allErrors.push(...ajvErrors);

      if (ajvErrors.length > 0) {
        console.debug(
          `[CustomValidatorExecutor] Validator "${ref.name}" returned ${ajvErrors.length} error(s) for path "${path}"`,
        );
      }
    } catch (err) {
      // Graceful failure: log error but don't crash
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[CustomValidatorExecutor] Validator "${ref.name}" failed for path "${path}":`,
        errorMessage,
      );
      // Optionally return a generic error to indicate validator failure
      // For now, we just log and continue (graceful degradation)
    }
  }

  return allErrors;
}

/**
 * Execute custom validators for all fields in the form.
 * Scans the UI schema to find all fields with custom validators and executes them.
 *
 * @param uischema - Root UI schema
 * @param schema - JSON schema
 * @param data - Full form data
 * @param ajv - Optional AJV instance
 * @returns Map of field path → array of AJV error objects
 */
export function executeAllCustomValidators(
  uischema: UISchemaElement | undefined,
  schema: JsonSchema7 | undefined,
  data: Record<string, unknown>,
  ajv?: Ajv,
): Map<string, ErrorObject[]> {
  const errors = new Map<string, ErrorObject[]>();

  if (!uischema || !schema) {
    return errors;
  }

  // Recursively traverse UI schema to find all Controls with custom validators
  function traverseUISchema(
    element: UISchemaElement | UISchemaElement[] | undefined,
    currentPath: string = '',
  ): void {
    if (!element) {
      return;
    }

    if (Array.isArray(element)) {
      element.forEach(item => traverseUISchema(item, currentPath));
      return;
    }

    const elem = element as any;

    // If this is a Control, check for custom validators
    if (elem.type === 'Control' && elem.scope) {
      const validatorRefs = extractCustomValidators(elem);
      if (validatorRefs.length > 0) {
        // Extract field path from scope (e.g., "#/properties/age" -> "age")
        const fieldPath = elem.scope;
        const fieldName = fieldPath.replace('#/properties/', '');
        const fieldValue = data[fieldName];

        // Execute validators for this field
        const fieldErrors = executeCustomValidators(
          validatorRefs,
          data,
          fieldValue,
          fieldPath,
          ajv,
        );

        if (fieldErrors.length > 0) {
          errors.set(fieldPath, fieldErrors);
        }
      }
    }

    // Recursively process children
    if (elem.elements) {
      traverseUISchema(elem.elements, currentPath);
    }
    if (elem.elements && Array.isArray(elem.elements)) {
      elem.elements.forEach((child: UISchemaElement) =>
        traverseUISchema(child, currentPath),
      );
    }
  }

  traverseUISchema(uischema);

  return errors;
}
