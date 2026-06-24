import { describe, expect, it } from 'vitest';
import {
  findAutoFocusPropertyPath,
  controlWantsAutoFocus,
} from './autofocusHelpers';

describe('controlWantsAutoFocus', () => {
  it('is false unless options.autoFocus is true', () => {
    expect(controlWantsAutoFocus({ type: 'Control' })).toBe(false);
    expect(
      controlWantsAutoFocus({ type: 'Control', options: { autoFocus: false } }),
    ).toBe(false);
    expect(
      controlWantsAutoFocus({ type: 'Control', options: { autoFocus: true } }),
    ).toBe(true);
  });
});

describe('findAutoFocusPropertyPath', () => {
  it('returns the first Control with autoFocus on the page', () => {
    const page = {
      type: 'VerticalLayout',
      elements: [
        { type: 'Control', scope: '#/properties/foo' },
        {
          type: 'Control',
          scope: '#/properties/bar',
          options: { autoFocus: true },
        },
        {
          type: 'Control',
          scope: '#/properties/baz',
          options: { autoFocus: true },
        },
      ],
    };
    expect(findAutoFocusPropertyPath(page)).toBe('bar');
  });

  it('walks nested layouts', () => {
    const page = {
      type: 'Group',
      elements: [
        {
          type: 'VerticalLayout',
          elements: [
            {
              type: 'Control',
              scope: '#/properties/nested',
              options: { autoFocus: true },
            },
          ],
        },
      ],
    };
    expect(findAutoFocusPropertyPath(page)).toBe('nested');
  });
});
