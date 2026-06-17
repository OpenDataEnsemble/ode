/**
 * Run custom validators and refresh form data when validators mutate in place.
 */

import type { ErrorObject } from 'ajv';
import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import type Ajv from 'ajv';
import { executeAllCustomValidators } from './CustomValidatorExecutor';

export type FormDataRecord = Record<string, unknown>;

export interface CustomValidatorRefreshResult {
  errors: ErrorObject[];
  data: FormDataRecord;
  mutated: boolean;
}

function flattenCustomValidatorErrors(
  errorsByPath: Map<string, ErrorObject[]>,
): ErrorObject[] {
  const all: ErrorObject[] = [];
  for (const fieldErrors of errorsByPath.values()) {
    all.push(...fieldErrors);
  }
  return all;
}

/**
 * Executes all custom validators against `data`, detects in-place mutations,
 * and returns a shallow-safe clone via `structuredClone` when data changed.
 */
export function runCustomValidatorsAndRefreshData(
  uischema: UISchemaElement | undefined,
  schema: JsonSchema7 | undefined,
  data: FormDataRecord,
  ajv?: Ajv,
): CustomValidatorRefreshResult {
  if (!uischema || !schema) {
    return { errors: [], data, mutated: false };
  }

  const before = JSON.stringify(data);

  try {
    const errorsByPath = executeAllCustomValidators(
      uischema,
      schema,
      data,
      ajv,
    );
    const errors = flattenCustomValidatorErrors(errorsByPath);
    const mutated = JSON.stringify(data) !== before;
    return {
      errors,
      data: mutated ? structuredClone(data) : data,
      mutated,
    };
  } catch (error) {
    console.error(
      '[Formplayer] Error executing custom validators:',
      error,
    );
    return { errors: [], data, mutated: false };
  }
}
