import { describe, expect, it } from 'vitest';
import { createAjv } from '@jsonforms/core';
import {
  collectVisibleControlsInSubtree,
  pageIsVisibleInSwipe,
  visiblePageIndicesFromLayouts,
} from './swipeLayoutVisibility';

const ajv = createAjv();
const config = {};

describe('pageIsVisibleInSwipe', () => {
  it('returns false when nested Group only contains Controls hidden by SHOW + const (AJV)', () => {
    const page = {
      type: 'VerticalLayout',
      elements: [
        {
          type: 'Group',
          elements: [
            {
              type: 'Control',
              scope: '#/properties/foo',
              rule: {
                effect: 'SHOW',
                condition: {
                  scope: '#/properties/bar',
                  schema: { const: 'yes' },
                },
              },
            },
          ],
        },
      ],
    };
    const data = { bar: 'no', foo: '' };
    expect(pageIsVisibleInSwipe(page as any, data, '', ajv, config)).toBe(
      false,
    );
  });

  it('returns true when nested Control is visible under Group', () => {
    const page = {
      type: 'VerticalLayout',
      elements: [
        {
          type: 'Group',
          elements: [
            {
              type: 'Control',
              scope: '#/properties/foo',
              rule: {
                effect: 'SHOW',
                condition: {
                  scope: '#/properties/bar',
                  schema: { const: 'yes' },
                },
              },
            },
          ],
        },
      ],
    };
    const data = { bar: 'yes', foo: 'x' };
    expect(pageIsVisibleInSwipe(page as any, data, '', ajv, config)).toBe(true);
  });

  it('respects SHOW + minLength (AJV) for nested Control', () => {
    const page = {
      type: 'VerticalLayout',
      elements: [
        {
          type: 'Control',
          scope: '#/properties/detail',
          rule: {
            effect: 'SHOW',
            condition: {
              scope: '#/properties/title',
              schema: { type: 'string', minLength: 1 },
            },
          },
        },
      ],
    };
    expect(
      pageIsVisibleInSwipe(
        page as any,
        { title: '', detail: '' },
        '',
        ajv,
        config,
      ),
    ).toBe(false);
    expect(
      pageIsVisibleInSwipe(
        page as any,
        { title: 'a', detail: '' },
        '',
        ajv,
        config,
      ),
    ).toBe(true);
  });

  it('respects SHOW + anyOf schema (AJV) for nested Control', () => {
    const page = {
      type: 'VerticalLayout',
      elements: [
        {
          type: 'Group',
          elements: [
            {
              type: 'Control',
              scope: '#/properties/name',
              rule: {
                effect: 'SHOW',
                condition: {
                  scope: '#/properties/flag',
                  schema: {
                    anyOf: [{ const: null }, { const: '' }, { const: false }],
                  },
                },
              },
            },
          ],
        },
      ],
    };
    expect(
      pageIsVisibleInSwipe(
        page as any,
        { flag: null, name: '' },
        '',
        ajv,
        config,
      ),
    ).toBe(true);
    expect(
      pageIsVisibleInSwipe(
        page as any,
        { flag: 'set', name: '' },
        '',
        ajv,
        config,
      ),
    ).toBe(false);
  });

  it('treats Finalize page as always visible', () => {
    const page = { type: 'Finalize' };
    expect(pageIsVisibleInSwipe(page as any, {}, '', ajv, config)).toBe(true);
  });

  it('returns true for empty VerticalLayout (legacy swipe behavior)', () => {
    const page = { type: 'VerticalLayout', elements: [] };
    expect(pageIsVisibleInSwipe(page as any, {}, '', ajv, config)).toBe(true);
  });

  it('hides page when VerticalLayout has SHOW rule that fails', () => {
    const page = {
      type: 'VerticalLayout',
      rule: {
        effect: 'SHOW',
        condition: {
          scope: '#/properties/on',
          schema: { const: true },
        },
      },
      elements: [{ type: 'Control', scope: '#/properties/foo' }],
    };
    expect(
      pageIsVisibleInSwipe(page as any, { on: false, foo: 1 }, '', ajv, config),
    ).toBe(false);
    expect(
      pageIsVisibleInSwipe(page as any, { on: true, foo: 1 }, '', ajv, config),
    ).toBe(true);
  });
});

describe('visiblePageIndicesFromLayouts', () => {
  it('filters out pages with no visible interactive content', () => {
    const layouts = [
      {
        type: 'VerticalLayout',
        elements: [
          {
            type: 'Control',
            scope: '#/properties/a',
            rule: {
              effect: 'SHOW',
              condition: {
                scope: '#/properties/toggle',
                schema: { const: 'one' },
              },
            },
          },
        ],
      },
      { type: 'Finalize' },
    ];
    const dataOne = { toggle: 'one', a: 1 };
    expect(
      visiblePageIndicesFromLayouts(layouts as any, dataOne, '', ajv, config),
    ).toEqual([0, 1]);

    const dataTwo = { toggle: 'two', a: 1 };
    expect(
      visiblePageIndicesFromLayouts(layouts as any, dataTwo, '', ajv, config),
    ).toEqual([1]);
  });
});

describe('collectVisibleControlsInSubtree', () => {
  it('collects only Controls that JsonForms would show', () => {
    const page = {
      type: 'VerticalLayout',
      elements: [
        {
          type: 'Control',
          scope: '#/properties/always',
        },
        {
          type: 'Control',
          scope: '#/properties/conditional',
          rule: {
            effect: 'SHOW',
            condition: {
              scope: '#/properties/toggle',
              schema: { const: 'x' },
            },
          },
        },
      ],
    };
    const data = { always: 1, toggle: 'y', conditional: 2 };
    const controls = collectVisibleControlsInSubtree(
      page as any,
      data,
      '',
      ajv,
      config,
    );
    expect(controls).toHaveLength(1);
    expect((controls[0] as any).scope).toBe('#/properties/always');
  });
});
