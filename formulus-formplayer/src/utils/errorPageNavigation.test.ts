import { describe, expect, it } from 'vitest';
import {
  findSwipePageIndexForInstancePath,
  formatBlockingErrorSummary,
  instancePathMatchesControlScope,
  normalizeErrorInstancePath,
  resolveErrorPageIndex,
} from './errorPageNavigation';

const nestedGroupLayout = {
  type: 'SwipeLayout',
  options: { headerFields: ['cama_num'] },
  elements: [
    {
      type: 'Group',
      label: 'Page 1',
      elements: [
        {
          type: 'Control',
          scope: '#/properties/validar_cama',
          label: 'A cama é válida',
        },
      ],
    },
    {
      type: 'Group',
      label: 'Page 2',
      elements: [
        {
          type: 'Control',
          scope: '#/properties/viutenda',
          label: 'Viu/tem tenda?',
        },
      ],
    },
    { type: 'Finalize' },
  ],
};

describe('normalizeErrorInstancePath', () => {
  it('converts custom validator JSON pointer paths', () => {
    expect(normalizeErrorInstancePath('#/properties/validar_cama')).toBe(
      '/validar_cama',
    );
  });

  it('leaves AJV instance paths unchanged', () => {
    expect(normalizeErrorInstancePath('/pessoas/0/sexo')).toBe(
      '/pessoas/0/sexo',
    );
  });
});

describe('instancePathMatchesControlScope', () => {
  it('matches root property scopes', () => {
    expect(
      instancePathMatchesControlScope(
        '/validar_cama',
        '#/properties/validar_cama',
      ),
    ).toBe(true);
  });

  it('matches nested array item scopes', () => {
    expect(
      instancePathMatchesControlScope(
        '/pessoas/0/sexo',
        '#/properties/pessoas/items/properties/sexo',
      ),
    ).toBe(true);
  });
});

describe('findSwipePageIndexForInstancePath', () => {
  const layouts = nestedGroupLayout.elements;

  it('finds controls nested inside Group pages', () => {
    expect(
      findSwipePageIndexForInstancePath(layouts, '/validar_cama', []),
    ).toBe(0);
    expect(findSwipePageIndexForInstancePath(layouts, '/viutenda', [])).toBe(1);
  });

  it('routes header-only fields to the first content page', () => {
    expect(
      findSwipePageIndexForInstancePath(layouts, '/cama_num', ['cama_num']),
    ).toBe(0);
  });
});

describe('resolveErrorPageIndex', () => {
  it('resolves page index from SwipeLayout uischema', () => {
    expect(
      resolveErrorPageIndex(nestedGroupLayout as never, '/validar_cama'),
    ).toBe(0);
  });
});

describe('formatBlockingErrorSummary', () => {
  const schema = {
    properties: {
      validar_cama: { type: 'string', title: 'A cama é válida' },
      viutenda: { type: 'string', title: 'Viu/tem tenda?' },
    },
  };

  it('includes field titles in the alert copy', () => {
    const message = formatBlockingErrorSummary(
      [{ instancePath: '/validar_cama' }],
      schema,
    );
    expect(message).toContain('A cama é válida');
    expect(message).toContain('Tap Done to review');
  });
});
