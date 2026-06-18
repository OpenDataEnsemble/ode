import { describe, it, expect } from 'vitest';
import {
  formDataJsonEqual,
  mergePreservingSubObsArrays,
  readDataPath,
  writeDataPath,
  resolveTemplateValue,
  resolveInitialValues,
  buildColumns,
  sortRows,
  coerceSubObservationRows,
  readSubObservationField,
  optionalRecordMap,
  resolveItemLabel,
  resolveAddButtonLabel,
  resolveEmptyLabel,
  resolveDeleteFallbackLabel,
} from './subObservationHelpers';

describe('subObservationHelpers', () => {
  it('mergePreservingSubObsArrays keeps longer baseline arrays', () => {
    const baseline = { pessoas: [{ id: 1 }] };
    const incoming = { validar_cama: '1' };
    const merged = mergePreservingSubObsArrays(baseline, incoming);
    expect(merged.pessoas).toEqual([{ id: 1 }]);
    expect(merged.validar_cama).toBe('1');
  });

  it('mergePreservingSubObsArrays restores omitted quartos from baseline', () => {
    const baseline = {
      comments: 'old',
      quartos: [{ quarto_num: 1, camas: [] }],
      person_codigos: [],
    };
    const incoming = { comments: 'new', assistant1: 'AB' };
    const merged = mergePreservingSubObsArrays(baseline, incoming);
    expect(merged.comments).toBe('new');
    expect(merged.quartos).toEqual(baseline.quartos);
    expect(merged.person_codigos).toEqual([]);
  });

  it('formDataJsonEqual compares stable JSON snapshots', () => {
    expect(formDataJsonEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(formDataJsonEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('readDataPath resolves dotted paths', () => {
    expect(readDataPath({ a: { b: 3 } }, 'a.b')).toBe(3);
    expect(readDataPath({}, 'x')).toBeUndefined();
  });

  it('writeDataPath sets top-level and nested paths immutably', () => {
    const root = { a: { b: 1 }, pessoas: [] as unknown[] };
    const next = writeDataPath(root, 'pessoas', [{ id: 1 }]);
    expect(next.pessoas).toEqual([{ id: 1 }]);
    expect(root.pessoas).toEqual([]);
    const nested = writeDataPath({ a: { b: 1 } }, 'a.b', 9);
    expect(nested).toEqual({ a: { b: 9 } });
    expect(root.a).toEqual({ b: 1 });
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

  it('resolveItemLabel trims and rejects empty strings', () => {
    expect(resolveItemLabel({ itemLabel: '  room  ' })).toBe('room');
    expect(resolveItemLabel({ itemLabel: '' })).toBeNull();
    expect(resolveItemLabel({ itemLabel: '   ' })).toBeNull();
    expect(resolveItemLabel(undefined)).toBeNull();
  });

  it('resolveAddButtonLabel uses defaults, itemLabel, and ui override', () => {
    expect(resolveAddButtonLabel({ itemLabel: null, busy: false })).toBe(
      '+ Add observation',
    );
    expect(resolveAddButtonLabel({ itemLabel: null, busy: true })).toBe(
      'Adding…',
    );
    expect(resolveAddButtonLabel({ itemLabel: 'quarto', busy: false })).toBe(
      '+ Add quarto',
    );
    expect(resolveAddButtonLabel({ itemLabel: 'quarto', busy: true })).toBe(
      'Adding quarto…',
    );
    expect(
      resolveAddButtonLabel({
        itemLabel: 'quarto',
        addButtonLabel: '+ Adicionar quarto',
        busy: false,
      }),
    ).toBe('+ Adicionar quarto');
    expect(
      resolveAddButtonLabel({
        itemLabel: 'quarto',
        addButtonLabel: '+ Adicionar quarto',
        busy: true,
      }),
    ).toBe('Adding…');
  });

  it('resolveEmptyLabel and resolveDeleteFallbackLabel respect itemLabel', () => {
    expect(resolveEmptyLabel(null)).toBe('No observations');
    expect(resolveEmptyLabel('room')).toBe('No room');
    expect(resolveDeleteFallbackLabel(null)).toBe('this sub-observation');
    expect(resolveDeleteFallbackLabel('room')).toBe('this room');
  });
});
