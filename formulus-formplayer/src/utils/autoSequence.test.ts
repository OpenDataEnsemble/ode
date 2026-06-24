import { describe, expect, it } from 'vitest';
import { applyAutoSequences } from './autoSequence';

describe('applyAutoSequences', () => {
  it('assigns sibling max+1 in an array', async () => {
    const schema = {
      properties: {
        camas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              cama_num: {
                type: 'integer',
                'x-autoSequence': { scope: 'sibling' },
              },
            },
          },
        },
      },
    };

    const data = {
      camas: [{ cama_num: 1 }, { cama_num: null }, {}],
    };

    const { data: next, mutated } = await applyAutoSequences(data, schema);
    expect(mutated).toBe(true);
    expect(next.camas[1].cama_num).toBe(2);
    expect(next.camas[2].cama_num).toBe(3);
  });

  it('does not overwrite existing values when immutable', async () => {
    const schema = {
      properties: {
        quarto_num: {
          type: 'integer',
          'x-autoSequence': { scope: 'tree' },
        },
      },
    };

    const data = { quarto_num: 5 };
    const { data: next, mutated } = await applyAutoSequences(data, schema);
    expect(mutated).toBe(false);
    expect(next.quarto_num).toBe(5);
  });

  it('uses contextTree for household numbering', async () => {
    const schema = {
      properties: {
        nopessoa: {
          type: 'string',
          'x-autoSequence': {
            scope: 'contextTree',
            contextKey: 'quartos',
            field: 'nopessoa',
          },
        },
      },
    };

    const data = { nopessoa: '' };
    const { data: next } = await applyAutoSequences(data, schema, {
      subObservationContext: {
        quartos: [
          {
            quarto_num: 1,
            camas: [{ cama_num: 1, pessoas: [{ nopessoa: '3' }] }],
          },
        ],
      },
    });

    expect(next.nopessoa).toBe('4');
  });

  it('matches contextFilter with numeric coercion', async () => {
    const schema = {
      properties: {
        cama_num: {
          type: 'integer',
          'x-autoSequence': {
            scope: 'contextTree',
            contextKey: 'quartos',
            field: 'cama_num',
            contextFilter: { quarto_num: '$data.quarto_num' },
          },
        },
        quarto_num: { type: 'integer' },
      },
    };

    const data = { quarto_num: 2, cama_num: null };
    const { data: next } = await applyAutoSequences(data, schema, {
      subObservationContext: {
        quartos: [
          {
            quarto_num: 1,
            camas: [{ cama_num: 1 }, { cama_num: 2 }],
          },
          {
            quarto_num: '2',
            camas: [{ cama_num: 1 }],
          },
        ],
      },
    });

    expect(next.cama_num).toBe(2);
  });
});
