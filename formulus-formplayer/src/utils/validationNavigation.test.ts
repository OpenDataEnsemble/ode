import { describe, expect, it } from 'vitest';
import {
  coerceSchemaIntegerValue,
  coerceSchemaRootIntegers,
  prepareRootObservationData,
} from './formObservationData';
import {
  firstBlockingErrorInstancePath,
  instancePathForAjvError,
} from './validationNavigation';

describe('coerceSchemaIntegerValue', () => {
  it('coerces numeric strings to integers', () => {
    expect(coerceSchemaIntegerValue('5')).toBe(5);
    expect(coerceSchemaIntegerValue(5)).toBe(5);
  });

  it('leaves non-integer values unchanged', () => {
    expect(coerceSchemaIntegerValue('')).toBe('');
    expect(coerceSchemaIntegerValue('1.5')).toBe('1.5');
  });
});

describe('coerceSchemaRootIntegers', () => {
  it('coerces integer schema properties including format int', () => {
    const schema = {
      properties: {
        quarto_num: { type: 'integer' },
        cama_num: { type: 'integer', format: 'int' },
        af: { type: 'string' },
      },
    };
    const data = { quarto_num: '2', cama_num: '3', af: 'A1' };
    expect(coerceSchemaRootIntegers(data, schema)).toEqual({
      quarto_num: 2,
      cama_num: 3,
      af: 'A1',
    });
  });
});

describe('prepareRootObservationData', () => {
  it('strips non-schema keys and coerces integers', () => {
    const schema = {
      properties: {
        quarto_num: { type: 'integer' },
      },
    };
    expect(
      prepareRootObservationData({ quarto_num: '1', theme: 'dark' }, schema),
    ).toEqual({ quarto_num: 1 });
  });
});

describe('firstBlockingErrorInstancePath', () => {
  it('prefers instancePath from JSON Forms errors', () => {
    expect(
      firstBlockingErrorInstancePath([{ instancePath: '/quarto_num' }]),
    ).toBe('/quarto_num');
  });

  it('falls back to custom validator path (normalized)', () => {
    expect(
      firstBlockingErrorInstancePath([{ path: '#/properties/validar_cama' }]),
    ).toBe('/validar_cama');
  });

  it('resolves AJV required missingProperty at root', () => {
    expect(
      firstBlockingErrorInstancePath([
        {
          instancePath: '',
          keyword: 'required',
          params: { missingProperty: 'nome_chefe' },
        },
      ]),
    ).toBe('/nome_chefe');
  });

  it('resolves AJV required missingProperty under a parent object', () => {
    expect(
      instancePathForAjvError({
        instancePath: '/pessoas/0',
        keyword: 'required',
        params: { missingProperty: 'sexo' },
      }),
    ).toBe('/pessoas/0/sexo');
  });
});
