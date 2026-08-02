// @vitest-environment jsdom
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
import { applyClearOnHideToRenderers } from './applyClearOnHideToRenderers';
import { shellMaterialRenderers } from '../theme/material-wrappers';

const ajv = new Ajv({ allErrors: true, strict: false });

afterEach(() => cleanup());

describe('applyClearOnHideToRenderers', () => {
  it('clears a Control value via the registry wrapper when hidden', async () => {
    const schema: JsonSchema7 = {
      type: 'object',
      properties: {
        gate: { type: 'string', title: 'Gate', enum: ['yes', 'no'] },
        detail: { type: 'string', title: 'Detail' },
      },
    };
    const uischema: UISchemaElement = {
      type: 'VerticalLayout',
      elements: [
        {
          type: 'Control',
          scope: '#/properties/gate',
          options: { display: 'buttons' },
        },
        {
          type: 'Control',
          scope: '#/properties/detail',
          rule: {
            effect: 'SHOW',
            condition: {
              scope: '#/properties/gate',
              schema: { const: 'yes' },
            },
          },
        },
      ],
    } as UISchemaElement;

    function Harness() {
      const [data, setData] = useState<Record<string, unknown>>({
        gate: 'yes',
        detail: 'keep-me',
      });
      return (
        <ThemeProvider theme={theme}>
          <div data-testid="data-json">{JSON.stringify(data)}</div>
          <JsonForms
            schema={schema}
            uischema={uischema}
            data={data}
            renderers={applyClearOnHideToRenderers([
              ...shellMaterialRenderers,
              ...materialRenderers,
            ])}
            ajv={ajv}
            onChange={({ data: next }) =>
              setData(next as Record<string, unknown>)
            }
          />
        </ThemeProvider>
      );
    }

    render(<Harness />);
    expect(screen.getByDisplayValue('keep-me')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'no' })[0]);

    await waitFor(() => {
      const data = JSON.parse(
        screen.getByTestId('data-json').textContent || '{}',
      ) as Record<string, unknown>;
      expect(data.gate).toBe('no');
      expect(data.detail).toBeUndefined();
    });
    expect(screen.queryByDisplayValue('keep-me')).toBeNull();
  });
});
