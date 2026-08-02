// @vitest-environment jsdom
/**
 * Parent SHOW → child SHOW → grandchild: hiding the parent must clear the
 * child's value so the grandchild's SHOW rule fails (ODK-style relevant).
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { JsonForms } from '@jsonforms/react';
import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import { materialRenderers } from '@jsonforms/material-renderers';
import Ajv from 'ajv';
import { theme } from '../theme/theme';
import { FormContext } from '../App';
import { shellMaterialRenderers } from '../theme/material-wrappers';

const ajv = new Ajv({ allErrors: true, strict: false });

const schema: JsonSchema7 = {
  type: 'object',
  properties: {
    parent: {
      type: 'string',
      title: 'Parent',
      enum: ['1', '2'],
    },
    child: {
      type: 'string',
      title: 'Child',
      enum: ['1', '2'],
    },
    grandchild: {
      type: 'string',
      title: 'Grandchild',
      enum: ['1', '2'],
    },
  },
};

const uischema: UISchemaElement = {
  type: 'VerticalLayout',
  elements: [
    {
      type: 'Control',
      scope: '#/properties/parent',
      options: { display: 'buttons' },
    },
    {
      type: 'Control',
      scope: '#/properties/child',
      options: { display: 'buttons' },
      rule: {
        effect: 'SHOW',
        condition: {
          scope: '#/properties/parent',
          schema: { const: '1' },
        },
      },
    },
    {
      type: 'Control',
      scope: '#/properties/grandchild',
      options: { display: 'buttons' },
      rule: {
        effect: 'SHOW',
        condition: {
          scope: '#/properties/child',
          schema: { const: '1' },
        },
      },
    },
  ],
} as UISchemaElement;

const renderers = [...shellMaterialRenderers, ...materialRenderers];

function CascadeHarness({
  initialData,
}: {
  initialData: Record<string, unknown>;
}) {
  const [data, setData] = useState(initialData);
  return (
    <ThemeProvider theme={theme}>
      <FormContext.Provider
        value={{
          formInitData: null,
          keyboardEnterKeyHint: 'next',
          draftSessionKey: null,
        }}>
        <div data-testid="data-json">{JSON.stringify(data)}</div>
        <JsonForms
          schema={schema}
          uischema={uischema}
          data={data}
          renderers={renderers}
          ajv={ajv}
          onChange={({ data: next }) =>
            setData(next as Record<string, unknown>)
          }
        />
      </FormContext.Provider>
    </ThemeProvider>
  );
}

afterEach(() => cleanup());

describe('clear-on-hide cascade (SHOW/HIDE)', () => {
  it('clears child when parent hides it, which hides grandchild', async () => {
    render(
      <CascadeHarness
        initialData={{ parent: '1', child: '1', grandchild: '1' }}
      />,
    );

    expect(screen.getByText('Child')).toBeTruthy();
    expect(screen.getByText('Grandchild')).toBeTruthy();

    // Three fields each expose a "2" toggle; first is Parent.
    const parentTwo = screen.getAllByRole('button', { name: '2' })[0];
    fireEvent.click(parentTwo);

    await waitFor(() => {
      const raw = screen.getByTestId('data-json').textContent || '{}';
      const data = JSON.parse(raw) as Record<string, unknown>;
      expect(data.parent).toBe('2');
      expect(data.child).toBeUndefined();
      expect(data.grandchild).toBeUndefined();
    });

    expect(screen.queryByText('Child')).toBeNull();
    expect(screen.queryByText('Grandchild')).toBeNull();
  });
});
