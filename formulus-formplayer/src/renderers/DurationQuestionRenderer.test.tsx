// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { JsonForms } from '@jsonforms/react';
import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import { materialRenderers } from '@jsonforms/material-renderers';
import Ajv from 'ajv';
import { theme } from '../theme/theme';
import { FormContext } from '../App';
import DurationQuestionRenderer, {
  durationQuestionTester,
} from './DurationQuestionRenderer';
import DurationControl from '../components/duration/DurationControl';
import {
  formatDurationHuman,
  formatDurationSeconds,
} from '../components/duration/durationFormat';
import type { DurationJsonSchema } from '../components/duration/durationFormat';
import { shellMaterialRenderers } from '../theme/material-wrappers';

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat('duration', () => true);

const durationFieldSchema: DurationJsonSchema = {
  type: 'number',
  format: 'duration',
  title: 'Time to complete the task',
  minimum: 0,
  duration: {
    mode: 'stopwatch',
    unit: 'seconds',
    precision: 1,
    allowManualEntry: true,
  },
};

const durationSchema: JsonSchema7 = {
  type: 'object',
  properties: {
    task_duration: durationFieldSchema,
  },
};

const durationUischema: UISchemaElement = {
  type: 'Control',
  scope: '#/properties/task_duration',
};

const productionRenderers = [
  ...shellMaterialRenderers,
  ...materialRenderers,
  { tester: durationQuestionTester, renderer: DurationQuestionRenderer },
];

function DurationIntegrationHarness({
  initialData = {},
}: {
  initialData?: Record<string, unknown>;
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
          schema={durationSchema}
          uischema={durationUischema}
          data={data}
          renderers={productionRenderers}
          ajv={ajv}
          onChange={({ data: d }) => setData(d || {})}
        />
      </FormContext.Provider>
    </ThemeProvider>
  );
}

afterEach(() => cleanup());

describe('durationFormat', () => {
  it('formats seconds as MM:SS.s', () => {
    expect(formatDurationSeconds(83.4, 1)).toBe('01:23.4');
  });

  it('formats human-readable duration', () => {
    expect(formatDurationHuman(83.4)).toBe('1 min 23.4 sec');
  });
});

describe('durationQuestionTester', () => {
  it('matches schema with format duration', () => {
    const rank = durationQuestionTester(durationUischema, durationSchema, {
      rootSchema: durationSchema,
      config: {},
    } as never);
    expect(rank).toBe(12);
  });
});

describe('DurationControl', () => {
  it('renders stopwatch controls', () => {
    render(
      <ThemeProvider theme={theme}>
        <FormContext.Provider
          value={{
            formInitData: null,
            keyboardEnterKeyHint: 'next',
            draftSessionKey: null,
          }}>
          <DurationControl
            value={undefined}
            onChange={() => {}}
            schema={durationFieldSchema as Record<string, unknown>}
            enabled
            hasError={false}
          />
        </FormContext.Provider>
      </ThemeProvider>,
    );
    expect(screen.getByText('Start')).toBeTruthy();
    expect(screen.getByText('00:00.0')).toBeTruthy();
  });
});

describe('DurationQuestionRenderer integration', () => {
  it('renders via JsonForms with production renderer order', () => {
    render(<DurationIntegrationHarness />);
    expect(screen.getByText('Start')).toBeTruthy();
    expect(screen.getByText('Time to complete the task')).toBeTruthy();
  });

  it('shows saved value when provided', () => {
    render(
      <DurationIntegrationHarness initialData={{ task_duration: 45.5 }} />,
    );
    expect(screen.getByText(/Saved:/)).toBeTruthy();
  });

  it('allows manual entry of seconds', () => {
    render(<DurationIntegrationHarness />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12.5' } });
    fireEvent.blur(input);
    expect(input).toBeTruthy();
  });
});
