// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { JsonForms } from '@jsonforms/react';
import type { UISchemaElement } from '@jsonforms/core';
import { materialRenderers } from '@jsonforms/material-renderers';
import Ajv from 'ajv';
import { theme } from '../theme/theme';
import { FormContext } from '../App';
import LikertScaleQuestionRenderer, {
  likertScaleQuestionTester,
} from './LikertScaleQuestionRenderer';
import LikertScaleControl from '../components/likert/LikertScaleControl';
import { resolveLikertOptions } from '../components/likert/likertConfig';
import type {
  LikertJsonSchema,
  LikertObjectJsonSchema,
} from '../components/likert/likertTypes';
import { shellMaterialRenderers } from '../theme/material-wrappers';

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat('likert', () => true);

const likertFieldSchema: LikertJsonSchema = {
  type: 'integer',
  format: 'likert',
  title: 'Service satisfaction',
  oneOf: [
    { const: 1, title: 'Very dissatisfied' },
    { const: 2, title: 'Dissatisfied' },
    { const: 3, title: 'Neutral' },
    { const: 4, title: 'Satisfied' },
    { const: 5, title: 'Very satisfied' },
  ],
  likert: {
    display: 'buttons',
    colorMode: 'spectrum',
    allowClear: true,
  },
};

const satisfactionSchema: LikertObjectJsonSchema = {
  type: 'object',
  properties: {
    satisfaction: likertFieldSchema,
  },
};

const satisfactionUischema: UISchemaElement = {
  type: 'Control',
  scope: '#/properties/satisfaction',
};

const productionRenderers = [
  ...shellMaterialRenderers,
  ...materialRenderers,
  { tester: likertScaleQuestionTester, renderer: LikertScaleQuestionRenderer },
];

function LikertIntegrationHarness({
  initialData = {},
  uischema = satisfactionUischema,
}: {
  initialData?: Record<string, unknown>;
  uischema?: UISchemaElement;
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
          schema={satisfactionSchema}
          uischema={uischema}
          data={data}
          renderers={productionRenderers}
          ajv={ajv}
          onChange={({ data: d }) => setData(d || {})}
        />
        <pre data-testid="committed-data">{JSON.stringify(data)}</pre>
      </FormContext.Provider>
    </ThemeProvider>
  );
}

function readCommittedData(): Record<string, unknown> {
  return JSON.parse(screen.getByTestId('committed-data').textContent || '{}');
}

afterEach(() => cleanup());

describe('likertScaleQuestionTester', () => {
  it('matches schema with format likert', () => {
    const rank = likertScaleQuestionTester(
      satisfactionUischema,
      satisfactionSchema,
      { rootSchema: satisfactionSchema, config: {} } as never,
    );
    expect(rank).toBe(12);
  });
});

describe('LikertScaleControl', () => {
  it('renders scale options from oneOf', () => {
    render(
      <ThemeProvider theme={theme}>
        <LikertScaleControl
          value={undefined}
          onChange={() => {}}
          resolved={resolveLikertOptions(likertFieldSchema)}
          enabled
          hasError={false}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText('Very dissatisfied')).toBeTruthy();
    expect(screen.getByText('Very satisfied')).toBeTruthy();
  });

  it('selects and clears an option', () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider theme={theme}>
        <LikertScaleControl
          value={4}
          onChange={onChange}
          resolved={resolveLikertOptions(likertFieldSchema)}
          enabled
          hasError={false}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Satisfied' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('excludes N/A when selecting a scale value', () => {
    const onChange = vi.fn();
    const schemaWithNa: LikertJsonSchema = {
      ...likertFieldSchema,
      type: ['integer', 'null'],
      likert: {
        ...likertFieldSchema.likert,
        allowNotApplicable: true,
        notApplicableLabel: 'Not applicable',
      },
    };
    render(
      <ThemeProvider theme={theme}>
        <LikertScaleControl
          value={null}
          onChange={onChange}
          resolved={resolveLikertOptions(schemaWithNa)}
          enabled
          hasError={false}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Neutral' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});

describe('LikertScaleQuestionRenderer integration', () => {
  it('renders via JsonForms with production renderer order', () => {
    render(<LikertIntegrationHarness />);
    expect(screen.getByText('Very dissatisfied')).toBeTruthy();
    expect(screen.getByText('Service satisfaction')).toBeTruthy();
  });

  it('commits the selected oneOf const to observation data', async () => {
    render(<LikertIntegrationHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Satisfied' }));
    await waitFor(() => {
      expect(readCommittedData()).toEqual({ satisfaction: 4 });
    });
  });

  it('clears a re-selected value when allowClear is enabled', async () => {
    render(<LikertIntegrationHarness initialData={{ satisfaction: 4 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Satisfied' }));
    await waitFor(() => {
      expect(readCommittedData()).toEqual({});
    });
  });
});

describe('resolveLikertOptions', () => {
  it('uses preset when oneOf is omitted', () => {
    const resolved = resolveLikertOptions({
      type: 'integer',
      format: 'likert',
      likert: { preset: 'agreement' },
    } as LikertJsonSchema);
    expect(resolved.options).toHaveLength(5);
    expect(resolved.options[0].label).toBe('Strongly disagree');
  });

  it('defaults to horizontal layout when orientation is omitted', () => {
    const resolved = resolveLikertOptions(likertFieldSchema);
    expect(resolved.layout).toEqual({ mode: 'horizontal' });
  });

  it('parses cols-2 layout from ui options', () => {
    const resolved = resolveLikertOptions(likertFieldSchema, {
      options: { orientation: 'cols-2' },
    });
    expect(resolved.layout).toEqual({ mode: 'columns', columns: 2 });
  });
});

describe('LikertScaleControl display variants', () => {
  const emojiSchema: LikertJsonSchema = {
    type: 'integer',
    format: 'likert',
    title: 'How do you feel?',
    oneOf: [
      { const: 1, title: 'Very bad', emoji: '😞' },
      { const: 2, title: 'Okay', emoji: '😐' },
      { const: 3, title: 'Great', emoji: '😄' },
    ],
    likert: { display: 'emoji' },
  };

  it('always pairs emoji with its text label', () => {
    render(
      <ThemeProvider theme={theme}>
        <LikertScaleControl
          value={undefined}
          onChange={() => {}}
          resolved={resolveLikertOptions(emojiSchema)}
          enabled
          hasError={false}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText('Very bad')).toBeTruthy();
    expect(screen.getByText('Okay')).toBeTruthy();
    expect(screen.getByText('Great')).toBeTruthy();
  });

  it('shows verbal endpoint anchors on a numeric scale', () => {
    const numericSchema: LikertJsonSchema = {
      type: 'integer',
      format: 'likert',
      title: 'Pain level',
      oneOf: [
        { const: 0, title: 'No pain' },
        { const: 1, title: '1' },
        { const: 2, title: '2' },
        { const: 3, title: 'Worst pain' },
      ],
      likert: { display: 'numeric' },
    };
    render(
      <ThemeProvider theme={theme}>
        <LikertScaleControl
          value={undefined}
          onChange={() => {}}
          resolved={resolveLikertOptions(numericSchema)}
          enabled
          hasError={false}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText('No pain')).toBeTruthy();
    expect(screen.getByText('Worst pain')).toBeTruthy();
  });
});
