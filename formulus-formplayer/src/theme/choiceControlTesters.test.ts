import { describe, it, expect } from 'vitest';
import type { JsonSchema, UISchemaElement } from '@jsonforms/core';
import {
  choiceControlTester,
  enumArrayShellControlTester,
  multiChoiceControlTester,
} from './material-wrappers';

const rootSchema: JsonSchema = {
  type: 'object',
  properties: {
    color: { type: 'string', enum: ['r', 'g', 'b'] },
    ref: {
      type: 'string',
      oneOf: [
        { const: 'a', title: 'A' },
        { const: 'b', title: 'B' },
      ],
    },
    native: {
      type: 'string',
      format: 'native_enum',
      oneOf: [{ const: 'a', title: 'A' }],
    } as JsonSchema,
    tags: {
      type: 'array',
      uniqueItems: true,
      items: {
        oneOf: [
          { const: 'x', title: 'X' },
          { const: 'y', title: 'Y' },
        ],
      },
    } as JsonSchema,
  },
};

const ctx = { rootSchema, config: {} };

const control = (
  scope: string,
  options?: Record<string, unknown>,
): UISchemaElement =>
  ({
    type: 'Control',
    scope,
    ...(options ? { options } : {}),
  }) as unknown as UISchemaElement;

describe('choiceControlTester (single-select)', () => {
  it('claims an enum control with options.display=radio', () => {
    const ui = control('#/properties/color', { display: 'radio' });
    expect(choiceControlTester(ui, rootSchema, ctx)).toBe(7);
  });

  it('claims a oneOf ($ref) control with options.display=buttons', () => {
    const ui = control('#/properties/ref', { display: 'buttons' });
    expect(choiceControlTester(ui, rootSchema, ctx)).toBe(7);
  });

  it('defers when no options.display is set (keeps current default)', () => {
    const ui = control('#/properties/color');
    expect(choiceControlTester(ui, rootSchema, ctx)).toBe(-1);
  });

  it('defers when the schema has a format (custom question types win)', () => {
    const ui = control('#/properties/native', { display: 'radio' });
    expect(choiceControlTester(ui, rootSchema, ctx)).toBe(-1);
  });

  it('does not claim array (multi-select) controls', () => {
    const ui = control('#/properties/tags', { display: 'radio' });
    expect(choiceControlTester(ui, rootSchema, ctx)).toBe(-1);
  });
});

describe('enumArrayShellControlTester (default multi-select)', () => {
  it('claims array-of-enum when options.display is not set', () => {
    const ui = control('#/properties/tags');
    expect(enumArrayShellControlTester(ui, rootSchema, ctx)).toBe(6);
  });

  it('defers when options.display=checkboxes (MultiChoiceControl wins)', () => {
    const ui = control('#/properties/tags', { display: 'checkboxes' });
    expect(enumArrayShellControlTester(ui, rootSchema, ctx)).toBe(-1);
  });

  it('defers when options.display=buttons', () => {
    const ui = control('#/properties/tags', { display: 'buttons' });
    expect(enumArrayShellControlTester(ui, rootSchema, ctx)).toBe(-1);
  });
});

describe('multiChoiceControlTester (multi-select)', () => {
  it('claims an array-of-enum control with options.display=checkboxes', () => {
    const ui = control('#/properties/tags', { display: 'checkboxes' });
    expect(multiChoiceControlTester(ui, rootSchema, ctx)).toBe(7);
  });

  it('claims an array-of-enum control with options.display=buttons', () => {
    const ui = control('#/properties/tags', { display: 'buttons' });
    expect(multiChoiceControlTester(ui, rootSchema, ctx)).toBe(7);
  });

  it('defers when no options.display is set', () => {
    const ui = control('#/properties/tags');
    expect(multiChoiceControlTester(ui, rootSchema, ctx)).toBe(-1);
  });

  it('does not claim scalar controls', () => {
    const ui = control('#/properties/color', { display: 'checkboxes' });
    expect(multiChoiceControlTester(ui, rootSchema, ctx)).toBe(-1);
  });
});
