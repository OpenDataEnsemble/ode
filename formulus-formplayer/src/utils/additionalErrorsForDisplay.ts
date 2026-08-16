import type { ErrorObject } from 'ajv';
import type { ValidationMode } from '@jsonforms/core';

/**
 * JsonForms still paints `additionalErrors` under `ValidateAndHide` (AJV schema
 * errors are hidden, custom ones are not). Gate custom-validator display on Show
 * so clear-on-hide / early validator runs do not flash red before first Next.
 */
export function additionalErrorsForDisplay(
  validationMode: ValidationMode,
  customValidatorErrors: ErrorObject[],
): ErrorObject[] {
  return validationMode === 'ValidateAndShow' ? customValidatorErrors : [];
}
