import { describe, expect, it } from 'vitest';
import {
  buildControlIndexByFieldKey,
  resolveControlLabel,
  resolveFieldLabel,
} from './controlDisplayText';
import type { ControlProps } from '@jsonforms/core';

describe('controlDisplayText', () => {
  it('resolveControlLabel prefers uischema.label over props.label', () => {
    const props = {
      label: 'Schema title from JsonForms',
      uischema: { label: 'UI label' },
      schema: { title: 'Schema title' },
    } as ControlProps;
    expect(resolveControlLabel(props)).toBe('UI label');
  });

  it('resolveControlLabel falls back to props.label then schema title', () => {
    const fromProps = {
      label: 'From JsonForms',
      uischema: {},
      schema: { title: 'Schema title' },
    } as ControlProps;
    expect(resolveControlLabel(fromProps)).toBe('From JsonForms');

    const schemaOnly = {
      label: '',
      uischema: {},
      schema: { title: 'Schema title' },
    } as ControlProps;
    expect(resolveControlLabel(schemaOnly)).toBe('Schema title');
  });

  it('resolveFieldLabel uses localized ui label over schema title', () => {
    const schema = {
      properties: {
        codigo: { type: 'string', title: 'Envelope code' },
      },
    };
    const uischema = {
      type: 'VerticalLayout',
      elements: [
        {
          type: 'Control',
          scope: '#/properties/codigo',
          label: 'Scan the envelope code',
        },
      ],
    };
    expect(resolveFieldLabel(schema, uischema, 'codigo')).toBe(
      'Scan the envelope code',
    );
  });

  it('buildControlIndexByFieldKey maps scope to control', () => {
    const uischema = {
      type: 'Control',
      scope: '#/properties/foo',
      label: 'Foo',
    };
    const index = buildControlIndexByFieldKey(uischema);
    expect(index.get('foo')?.label).toBe('Foo');
  });
});
