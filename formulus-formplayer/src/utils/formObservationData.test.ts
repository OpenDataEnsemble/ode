import { describe, expect, it } from 'vitest';
import {
  applySchemaDefaultTokens,
  dataMatchingSchemaRoot,
  initialFormDataFromParams,
  resolveDefaultToken,
  shouldOfferDraftSelector,
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

describe('resolveDefaultToken', () => {
  it('resolves $today to a local YYYY-MM-DD date', () => {
    const result = resolveDefaultToken('$today');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(d.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });

  it('resolves $now to an ISO date-time', () => {
    const result = resolveDefaultToken('$now');
    expect(typeof result).toBe('string');
    expect(() => new Date(result as string).toISOString()).not.toThrow();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns undefined for static or unknown defaults', () => {
    expect(resolveDefaultToken('2026-01-01')).toBeUndefined();
    expect(resolveDefaultToken('hello')).toBeUndefined();
    expect(resolveDefaultToken(5)).toBeUndefined();
    expect(resolveDefaultToken(undefined)).toBeUndefined();
  });
});

describe('applySchemaDefaultTokens', () => {
  it('injects $today only for missing fields with a token default', () => {
    const schema = {
      properties: {
        obsdate: { type: 'string', format: 'date', default: '$today' },
        name: { type: 'string' },
      },
    };
    const out = applySchemaDefaultTokens({ name: 'x' }, schema);
    expect(out.name).toBe('x');
    expect(out.obsdate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not override values already provided via params/defaultData', () => {
    const schema = {
      properties: {
        obsdate: { type: 'string', format: 'date', default: '$today' },
      },
    };
    expect(
      applySchemaDefaultTokens({ obsdate: '2020-05-05' }, schema).obsdate,
    ).toBe('2020-05-05');
  });

  it('fills empty-string values (treated as missing)', () => {
    const schema = {
      properties: {
        obsdate: { type: 'string', format: 'date', default: '$today' },
      },
    };
    expect(applySchemaDefaultTokens({ obsdate: '' }, schema).obsdate).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('leaves static defaults untouched (no auto-merge of plain defaults)', () => {
    const schema = {
      properties: {
        color: { type: 'string', default: 'red' },
      },
    };
    expect(applySchemaDefaultTokens({}, schema)).toEqual({});
  });

  it('is a no-op when schema has no properties', () => {
    expect(applySchemaDefaultTokens({ a: 1 }, {})).toEqual({ a: 1 });
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

describe('shouldOfferDraftSelector', () => {
  it('returns false for sub-observation sessions', () => {
    expect(
      shouldOfferDraftSelector({ subObservationMode: true }, {}),
    ).toBe(false);
  });

  it('returns false when skipDraftSelection is set', () => {
    expect(
      shouldOfferDraftSelector({ skipDraftSelection: true }, {}),
    ).toBe(false);
  });

  it('returns false when savedData is non-empty', () => {
    expect(
      shouldOfferDraftSelector({}, { name: 'x' }),
    ).toBe(false);
  });

  it('returns true for new root form without skip flag', () => {
    expect(shouldOfferDraftSelector({}, {})).toBe(true);
    expect(shouldOfferDraftSelector({}, null)).toBe(true);
  });

  it('returns false for legacy returnOnly sub-observation flag', () => {
    expect(
      shouldOfferDraftSelector({ returnOnly: true }, {}),
    ).toBe(false);
  });
});
