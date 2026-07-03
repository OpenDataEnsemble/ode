import { describe, expect, it } from '@jest/globals';
import { collectTranslationLocalesFromUiSchema } from './collectTranslationLocales';

describe('collectTranslationLocalesFromUiSchema', () => {
  it('returns empty array when no translations', () => {
    expect(
      collectTranslationLocalesFromUiSchema({
        type: 'VerticalLayout',
        elements: [{ type: 'Control', scope: '#/properties/a', label: 'A' }],
      }),
    ).toEqual([]);
  });

  it('collects locale keys from nested controls', () => {
    const locales = collectTranslationLocalesFromUiSchema({
      type: 'VerticalLayout',
      elements: [
        {
          type: 'Control',
          scope: '#/properties/a',
          label: 'A',
          translations: { fj: { label: 'A' }, pt: { label: 'A' } },
        },
        {
          type: 'Control',
          scope: '#/properties/b',
          label: 'B',
          translations: { fr: { label: 'B' } },
        },
      ],
    });
    expect(locales).toEqual(['fj', 'fr', 'pt']);
  });

  it('walks SwipeLayout option columns', () => {
    const locales = collectTranslationLocalesFromUiSchema({
      type: 'SwipeLayout',
      options: {
        columns: [
          {
            type: 'Control',
            scope: '#/properties/q',
            translations: { 'pt-BR': { label: 'Pergunta' } },
          },
        ],
      },
      elements: [],
    });
    expect(locales).toEqual(['pt-BR']);
  });
});
