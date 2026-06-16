import { describe, it, expect } from 'vitest';
import {
  readDataPath,
  resolveTemplateValue,
  resolveInitialValues,
  buildColumns,
  sortRows,
  coerceSubObservationRows,
  readSubObservationField,
  optionalRecordMap,
} from './subObservationHelpers';

describe('subObservationHelpers', () => {
  it('readDataPath resolves dotted paths', () => {
    expect(readDataPath({ a: { b: 3 } }, 'a.b')).toBe(3);
    expect(readDataPath({}, 'x')).toBeUndefined();
  });

  it('resolveTemplateValue expands tokens', () => {
    expect(resolveTemplateValue('{{parentValue}}', {}, 'P1')).toBe('P1');
    expect(
      resolveTemplateValue(
        '{{currentInstanceId}}',
        { observationId: 'obs99' },
        null,
      ),
    ).toBe('obs99');
    expect(resolveTemplateValue('{{p_id}}', { p_id: 'x' }, null)).toBe('x');
  });

  it('resolveTemplateValue preserves JSON type for a whole-string single token', () => {
    // Numbers stay numbers (so AJV type:"integer" passes on copied sub-obs data)
    expect(resolveTemplateValue('{{age}}', { age: 5 }, null)).toBe(5);
    expect(resolveTemplateValue('{{n}}', { n: 0 }, null)).toBe(0);
    expect(resolveTemplateValue('{{flag}}', { flag: false }, null)).toBe(false);
    // Missing -> empty string (unchanged behavior)
    expect(resolveTemplateValue('{{missing}}', {}, null)).toBe('');
    // Mixed templates still interpolate as text
    expect(resolveTemplateValue('AF-{{num}}', { num: 7 }, null)).toBe('AF-7');
  });

  it('resolveInitialValues maps object values', () => {
    expect(
      resolveInitialValues(
        { p_id: '{{parentValue}}', q: 1 },
        { observationId: 'o1' },
        'PAR',
      ),
    ).toEqual({ p_id: 'PAR', q: 1 });
  });

  it('buildColumns uses columns or displayField fallback', () => {
    expect(buildColumns({ columns: [{ key: 'a', label: 'A' }] }, [])).toEqual([
      { key: 'a', label: 'A' },
    ]);
    expect(buildColumns({ displayField: 'name' }, [])).toEqual([
      { key: 'name', label: 'Summary' },
    ]);
  });

  it('sortRows sorts by createdAt desc when no orderBy key', () => {
    const a = { createdAt: new Date('2020-01-01') };
    const b = { createdAt: new Date('2021-01-01') };
    const out = sortRows([a, b], undefined);
    expect(out[0]).toBe(b);
    expect(out[1]).toBe(a);
  });

  it('sortRows sorts by dotted path key', () => {
    const rows = [{ z: 'b' }, { z: 'a' }];
    const asc = sortRows(rows, { key: 'z', direction: 'asc' });
    expect(asc.map(r => r.z)).toEqual(['a', 'b']);
  });

  it('coerceSubObservationRows normalizes values', () => {
    expect(coerceSubObservationRows(null)).toEqual([]);
    expect(coerceSubObservationRows([{ x: 1 }])).toEqual([{ x: 1 }]);
  });

  it('readSubObservationField summarizes plain objects for observationId column', () => {
    expect(
      readSubObservationField({ a: 'hello', b: 'world' }, 'observationId'),
    ).toContain('hello');
  });

  it('optionalRecordMap narrows object maps only', () => {
    expect(optionalRecordMap({ a: 1 })).toEqual({ a: 1 });
    expect(optionalRecordMap(null)).toBeUndefined();
    expect(optionalRecordMap([1, 2])).toBeUndefined();
  });
});
