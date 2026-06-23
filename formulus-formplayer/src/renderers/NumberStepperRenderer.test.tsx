// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { JsonForms } from '@jsonforms/react';
import Ajv from 'ajv';
import { theme } from '../theme/theme';
import { FormContext } from '../App';
import { numberStepperRenderer } from './NumberStepperRenderer';

const ajv = new Ajv({ allErrors: true, strict: false });

const hbSchema = {
  type: 'object',
  properties: {
    hb_resultado: {
      type: 'number',
      title: 'Resultado de hemoglobina',
      minimum: 0,
      maximum: 25,
    },
  },
};

const hbUischema = {
  type: 'Control',
  scope: '#/properties/hb_resultado',
};

function NumericTestHarness({
  schema,
  uischema,
  initialData = {},
  validationMode = 'ValidateAndShow' as const,
}: {
  schema: object;
  uischema: object;
  initialData?: Record<string, unknown>;
  validationMode?: 'ValidateAndShow' | 'ValidateAndHide' | 'NoValidation';
}) {
  const [data, setData] = useState<Record<string, unknown>>(initialData);

  return (
    <ThemeProvider theme={theme}>
      <FormContext.Provider
        value={{
          formInitData: null,
          keyboardEnterKeyHint: 'next',
          draftSessionKey: null,
        }}>
        <JsonForms
          schema={schema}
          uischema={uischema}
          data={data}
          renderers={[numberStepperRenderer]}
          ajv={ajv}
          validationMode={validationMode}
          onChange={({ data: next }) => setData(next || {})}
        />
        <pre data-testid="committed-data">{JSON.stringify(data)}</pre>
      </FormContext.Provider>
    </ThemeProvider>
  );
}

afterEach(() => cleanup());

function readCommittedData(): Record<string, unknown> {
  return JSON.parse(screen.getByTestId('committed-data').textContent || '{}');
}

describe('NumberStepperRenderer', () => {
  it('uses text input with decimal inputMode and enterKeyHint', () => {
    render(
      <NumericTestHarness schema={hbSchema} uischema={hbUischema} />,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('enterkeyhint', 'next');
  });

  it('stores JSON numbers not strings when typing', async () => {
    const user = userEvent.setup();
    render(<NumericTestHarness schema={hbSchema} uischema={hbUischema} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    fireEvent.change(input, { target: { value: '16' } });
    await user.tab();

    await waitFor(() => {
      const data = readCommittedData();
      expect(data.hb_resultado).toBe(16);
      expect(typeof data.hb_resultado).toBe('number');
    });
  });

  it('allows clearing an over-max value without forcing a bound digit', async () => {
    const user = userEvent.setup();
    render(
      <NumericTestHarness
        schema={hbSchema}
        uischema={hbUischema}
        initialData={{ hb_resultado: 35 }}
      />,
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    expect(input.value).toBe('35');

    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    await user.tab();

    await waitFor(() => {
      expect(readCommittedData().hb_resultado).toBeUndefined();
    });
  });

  it('shows validation error for values above maximum while keeping typed value', async () => {
    const user = userEvent.setup();
    render(<NumericTestHarness schema={hbSchema} uischema={hbUischema} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, '35');

    expect((input as HTMLInputElement).value).toBe('35');
    expect(screen.getByText(/must be <= 25/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(readCommittedData().hb_resultado).toBe(35);
    });
  });

  it('disables stepper plus at maximum without altering typed draft', async () => {
    const user = userEvent.setup();
    render(
      <NumericTestHarness
        schema={hbSchema}
        uischema={hbUischema}
        initialData={{ hb_resultado: 25 }}
      />,
    );

    await user.click(screen.getByRole('textbox'));

    const addButton = screen.getByRole('button', { name: /increase/i });
    expect(addButton).toBeDisabled();
  });

  it('commits decimal values for type number', async () => {
    const user = userEvent.setup();
    const decimalSchema = {
      type: 'object',
      properties: {
        value: { type: 'number', multipleOf: 0.1 },
      },
    };
    const decimalUi = { type: 'Control', scope: '#/properties/value' };

    render(
      <NumericTestHarness schema={decimalSchema} uischema={decimalUi} />,
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    fireEvent.change(input, { target: { value: '12.5' } });
    await user.tab();

    await waitFor(() => {
      expect(readCommittedData().value).toBe(12.5);
    });
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });
});
