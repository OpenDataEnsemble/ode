import { describe, expect, it } from 'vitest';
import {
  dataMatchingSchemaRoot,
  initialFormDataFromParams,
} from './formObservationData';

describe('initialFormDataFromParams', () => {
  it('does not copy bridge keys when defaultData is missing', () => {
    const params = {
      theme: 'dark',
      darkMode: true,
      themeColors: { primary: '#000' },
      species: 'oak',
    };
    expect(initialFormDataFromParams(params)).toEqual({ species: 'oak' });
  });

  it('uses plain object defaultData when present', () => {
    const params = {
      defaultData: { a: 1 },
      theme: 'light',
      extra: 'ignored-at-root',
    };
    expect(initialFormDataFromParams(params)).toEqual({ a: 1 });
  });
});

describe('dataMatchingSchemaRoot', () => {
  it('keeps only schema root keys plus locale when properties is non-empty', () => {
    const data = {
      name: 'x',
      themeColors: { z: 1 },
      junk: true,
      locale: 'sv',
    };
    const schema = { properties: { name: { type: 'string' } } };
    expect(dataMatchingSchemaRoot(data, schema)).toEqual({
      name: 'x',
      locale: 'sv',
    });
  });

  it('passes data through when properties is missing', () => {
    const data = { a: 1, theme: 'x' };
    expect(dataMatchingSchemaRoot(data, {})).toEqual(data);
  });

  it('passes data through when properties is empty', () => {
    const data = { a: 1, theme: 'x' };
    expect(dataMatchingSchemaRoot(data, { properties: {} })).toEqual(data);
  });
});
