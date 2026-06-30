import { describe, expect, it } from 'vitest';
import {
  mergeSubObservationColumnDefs,
  resolveSubObservationColumns,
} from './subObservationColumnLabels';

describe('subObservationColumnLabels', () => {
  const childSpec = {
    schema: {
      properties: {
        quarto_num: { type: 'string', title: 'Room number' },
        quarto_display: { type: 'string', title: 'Summary' },
      },
    },
    uiSchema: {
      type: 'VerticalLayout',
      elements: [
        {
          type: 'Control',
          scope: '#/properties/quarto_num',
          label: 'Room #',
          translations: { pt: { label: 'Quarto nº' } },
        },
      ],
    },
  };

  it('resolveSubObservationColumns uses static label when provided', () => {
    const cols = resolveSubObservationColumns(
      [{ key: 'quarto_num', label: 'Static' }],
      'censo_milda_quarto',
      { censo_milda_quarto: childSpec },
    );
    expect(cols).toEqual([{ key: 'quarto_num', label: 'Static' }]);
  });

  it('resolveSubObservationColumns resolves from linked child form', () => {
    const cols = resolveSubObservationColumns(
      [{ key: 'quarto_num' }, { key: 'quarto_display' }],
      'censo_milda_quarto',
      { censo_milda_quarto: childSpec },
    );
    expect(cols[0]?.label).toBe('Room #');
    expect(cols[1]?.label).toBe('Summary');
  });

  it('mergeSubObservationColumnDefs merges ui options over schema', () => {
    const merged = mergeSubObservationColumnDefs([{ key: 'a' }], {
      options: { columns: [{ key: 'a', label: 'Override' }] },
    });
    expect(merged).toEqual([{ key: 'a', label: 'Override' }]);
  });
});
