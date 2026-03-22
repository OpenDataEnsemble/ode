import { describe, expect, it } from 'vitest';
import {
  dataMatchingSchemaRoot,
  initialFormDataFromParams,
} from './formObservationData';

/**
 * Mirrors App `initializeForm` when there is no savedData: default data from params,
 * then root filter against schema. Use this in tests to catch regressions in the PR
 * that stopped host bridge keys (theme, etc.) from becoming observation JSON.
 */
function initialObservationDataForNewForm(
  params: unknown,
  formSchema: unknown,
) {
  return dataMatchingSchemaRoot(initialFormDataFromParams(params), formSchema);
}

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

describe('observation pipeline (regression: host params vs observation JSON)', () => {
  it('does not put bridge keys into initial observation data when defaultData is absent (non-empty schema.properties)', () => {
    const params = {
      theme: 'dark',
      darkMode: true,
      themeColors: { primary: '#111' },
      species: 'oak',
    };
    const formSchema = {
      properties: {
        species: { type: 'string' },
      },
    };
    expect(initialObservationDataForNewForm(params, formSchema)).toEqual({
      species: 'oak',
    });
  });

  it('matches finalize/submit: raw form data is filtered to schema root keys', () => {
    const schema = { properties: { species: { type: 'string' } } };
    const rawPayload = {
      species: 'birch',
      theme: 'light',
      darkMode: false,
      themeColors: { accent: '#abc' },
    };
    expect(dataMatchingSchemaRoot(rawPayload, schema)).toEqual({
      species: 'birch',
    });
  });

  it('cleans legacy polluted rows on load when schema has non-empty properties', () => {
    const savedData = {
      species: 'pine',
      theme: 'dark',
      themeColors: { primary: '#000' },
      darkMode: true,
    };
    const formSchema = { properties: { species: { type: 'string' } } };
    expect(dataMatchingSchemaRoot(savedData, formSchema)).toEqual({
      species: 'pine',
    });
  });

  it('with empty schema.properties, bridge keys are still omitted from params-only init (defense in depth)', () => {
    const params = {
      theme: 'dark',
      themeColors: { x: 1 },
      fieldA: 2,
    };
    const formSchema = { properties: {} };
    expect(initialObservationDataForNewForm(params, formSchema)).toEqual({
      fieldA: 2,
    });
  });
});
