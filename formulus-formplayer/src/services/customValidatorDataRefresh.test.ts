import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { JsonSchema7 } from '@jsonforms/core';
import { customValidatorRegistry } from './CustomValidatorRegistry';
import { runCustomValidatorsAndRefreshData } from './customValidatorDataRefresh';

const schema: JsonSchema7 = {
  type: 'object',
  properties: {
    foo: { type: 'number' },
    quartos: { type: 'array' },
  },
};

const uischema = {
  type: 'VerticalLayout',
  elements: [
    {
      type: 'Control',
      scope: '#/properties/foo',
      options: {
        customValidators: [{ name: 'testMutator' }],
      },
    },
  ],
};

describe('runCustomValidatorsAndRefreshData', () => {
  beforeEach(() => {
    customValidatorRegistry.clear();
  });

  afterEach(() => {
    customValidatorRegistry.clear();
  });

  it('returns mutated clone when validator mutates data in place', () => {
    customValidatorRegistry.register('testMutator', ({ data }) => {
      data.foo = 1;
      return [];
    });

    const input = { foo: 0 };
    const result = runCustomValidatorsAndRefreshData(uischema, schema, input);

    expect(result.mutated).toBe(true);
    expect(result.data).toEqual({ foo: 1 });
    expect(result.data).not.toBe(input);
    expect(result.errors).toEqual([]);
  });

  it('keeps same reference when validator only returns errors', () => {
    customValidatorRegistry.register('testMutator', () => [
      { path: '#/properties/foo', message: 'bad' },
    ]);

    const input = { foo: 0 };
    const result = runCustomValidatorsAndRefreshData(uischema, schema, input);

    expect(result.mutated).toBe(false);
    expect(result.data).toBe(input);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toBe('bad');
  });

  it('clones nested array mutations', () => {
    customValidatorRegistry.register('testMutator', ({ data }) => {
      const quartos = data.quartos as Array<Record<string, unknown>>;
      if (Array.isArray(quartos) && quartos[0]) {
        quartos[0].quarto_num = 1;
      }
      return [];
    });

    const input = { quartos: [{}] };
    const result = runCustomValidatorsAndRefreshData(uischema, schema, input);

    expect(result.mutated).toBe(true);
    expect(result.data).not.toBe(input);
    expect((result.data.quartos as unknown[])[0]).toEqual({ quarto_num: 1 });
    expect((input.quartos as unknown[])[0]).toEqual({ quarto_num: 1 });
  });

  it('returns empty errors when uischema or schema is missing', () => {
    const input = { foo: 1 };
    const result = runCustomValidatorsAndRefreshData(undefined, schema, input);
    expect(result).toEqual({ errors: [], data: input, mutated: false });
  });
});
