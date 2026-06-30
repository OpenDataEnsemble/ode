import { describe, expect, it } from 'vitest';
import { applyFormUiTranslations } from './applyFormUiTranslations';

describe('applyFormUiTranslations', () => {
  it('returns same reference when no translations', () => {
    const ui = {
      type: 'VerticalLayout',
      elements: [{ type: 'Control', scope: '#/properties/a', label: 'A' }],
    };
    expect(applyFormUiTranslations(ui, 'fr')).toBe(ui);
  });

  it('merges partial control label', () => {
    const ui = {
      type: 'Control',
      scope: '#/properties/name',
      label: 'Name',
      translations: { fr: { label: 'Nom' } },
    };
    const out = applyFormUiTranslations(ui, 'fr') as typeof ui;
    expect(out.label).toBe('Nom');
    expect((out as { translations?: unknown }).translations).toBeUndefined();
  });

  it('falls back to default for missing locale', () => {
    const ui = {
      type: 'Control',
      scope: '#/properties/name',
      label: 'Name',
      translations: { fr: { label: 'Nom' } },
    };
    const out = applyFormUiTranslations(ui, 'de') as typeof ui;
    expect(out.label).toBe('Name');
  });

  it('merges SwipeLayout options', () => {
    const ui = {
      type: 'SwipeLayout',
      options: { headerTitle: 'Census', nextButtonLabel: 'Next' },
      translations: {
        pt: {
          options: { headerTitle: 'Censo', nextButtonLabel: 'Seguinte' },
        },
      },
      elements: [],
    };
    const out = applyFormUiTranslations(ui, 'pt') as {
      options: { headerTitle: string; nextButtonLabel: string };
    };
    expect(out.options.headerTitle).toBe('Censo');
    expect(out.options.nextButtonLabel).toBe('Seguinte');
  });

  it('merges oneOf by const', () => {
    const ui = {
      type: 'Control',
      scope: '#/properties/q',
      options: {
        oneOf: [
          { const: 'yes', title: 'Yes' },
          { const: 'no', title: 'No' },
        ],
      },
      translations: {
        fr: {
          options: {
            oneOf: [{ const: 'yes', title: 'Oui' }],
          },
        },
      },
    };
    const out = applyFormUiTranslations(ui, 'fr') as {
      options: { oneOf: { const: string; title: string }[] };
    };
    expect(out.options.oneOf[0]?.title).toBe('Oui');
    expect(out.options.oneOf[1]?.title).toBe('No');
  });

  it('handles pt-BR via pt fallback', () => {
    const ui = {
      type: 'Label',
      text: 'Hello',
      translations: { pt: { text: 'Olá' } },
    };
    const out = applyFormUiTranslations(ui, 'pt-BR') as { text: string };
    expect(out.text).toBe('Olá');
  });

  it('perf smoke: large form with few translations', () => {
    const elements = Array.from({ length: 200 }, (_, i) => ({
      type: 'Control',
      scope: `#/properties/f${i}`,
      label: `Field ${i}`,
      ...(i < 20 ? { translations: { fr: { label: `Champ ${i}` } } } : {}),
    }));
    const ui = { type: 'VerticalLayout', elements };
    const start = performance.now();
    applyFormUiTranslations(ui, 'fr');
    expect(performance.now() - start).toBeLessThan(50);
  });
});
