import { describe, it, expect } from 'vitest';
import type { JsonSchema, UISchemaElement } from '@jsonforms/core';
import {
  choiceControlTester,
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
      items: { oneOf: [{ const: 'x', title: 'X' }] },
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
