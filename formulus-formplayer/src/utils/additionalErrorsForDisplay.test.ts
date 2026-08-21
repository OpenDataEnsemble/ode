import { describe, expect, it } from 'vitest';
import type { ErrorObject } from 'ajv';
import { additionalErrorsForDisplay } from './additionalErrorsForDisplay';

const sampleError: ErrorObject = {
  instancePath: '/name',
  schemaPath: '#/properties/name/custom',
  keyword: 'custom',
  params: {},
  message: 'Custom validator failed',
};

describe('additionalErrorsForDisplay', () => {
  it('suppresses custom validator errors while ValidateAndHide', () => {
    expect(
      additionalErrorsForDisplay('ValidateAndHide', [sampleError]),
    ).toEqual([]);
  });

  it('suppresses custom validator errors while NoValidation', () => {
    expect(additionalErrorsForDisplay('NoValidation', [sampleError])).toEqual(
      [],
    );
  });

  it('passes through custom validator errors when ValidateAndShow', () => {
    expect(
      additionalErrorsForDisplay('ValidateAndShow', [sampleError]),
    ).toEqual([sampleError]);
  });
});
