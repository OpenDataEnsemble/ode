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
import {
  resolveLikertOptions,
  injectLikertNotApplicable,
} from '../components/likert/likertConfig';
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

  it('overrides option labels from ui.json options.oneOf (translations)', () => {
    const resolved = resolveLikertOptions(likertFieldSchema, {
      options: {
        oneOf: [
          { const: 1, title: 'Muito insatisfeito' },
          { const: 5, title: 'Muito satisfeito' },
        ],
      },
    });
    expect(resolved.options[0].label).toBe('Muito insatisfeito');
    expect(resolved.options[4].label).toBe('Muito satisfeito');
    // Untranslated entries keep their schema label.
    expect(resolved.options[2].label).toBe('Neutral');
  });

  it('builds options from ui.json options.oneOf when schema omits oneOf', () => {
    const resolved = resolveLikertOptions(
      { type: 'integer', format: 'likert' } as LikertJsonSchema,
      {
        options: {
          oneOf: [
            { const: 1, title: 'Baixo' },
            { const: 2, title: 'Alto' },
          ],
        },
      },
    );
    expect(resolved.options.map(o => o.label)).toEqual(['Baixo', 'Alto']);
  });

  it('excludes the N/A value from displayed scale options', () => {
    const resolved = resolveLikertOptions({
      type: ['integer', 'null'],
      format: 'likert',
      oneOf: [
        { const: 1, title: 'Not important' },
        { const: 2, title: 'Important' },
        { const: null, title: 'Not applicable' },
      ],
      likert: { allowNotApplicable: true, notApplicableValue: null },
    } as unknown as LikertJsonSchema);
    expect(resolved.options.map(o => o.value)).toEqual([1, 2]);
    expect(resolved.allowNotApplicable).toBe(true);
  });
});

describe('injectLikertNotApplicable', () => {
  const naSchema: LikertObjectJsonSchema = {
    type: 'object',
    properties: {
      importance: {
        type: ['integer', 'null'],
        format: 'likert',
        title: 'How important is this feature?',
        oneOf: [
          { const: 1, title: 'Not important' },
          { const: 5, title: 'Very important' },
        ],
        likert: { allowNotApplicable: true, notApplicableValue: null },
      } as unknown as LikertJsonSchema,
    },
  };

  it('adds a matching oneOf branch so the N/A value validates', () => {
    const validate = new Ajv({ allErrors: true, strict: false });
    validate.addFormat('likert', () => true);

    // Original schema rejects the N/A (null) value.
    expect(validate.validate(naSchema, { importance: null })).toBe(false);

    const normalized = injectLikertNotApplicable(naSchema);
    const validateNormalized = new Ajv({ allErrors: true, strict: false });
    validateNormalized.addFormat('likert', () => true);

    expect(validateNormalized.validate(normalized, { importance: null })).toBe(
      true,
    );
    expect(validateNormalized.validate(normalized, { importance: 5 })).toBe(
      true,
    );
  });

  it('does not mutate the original schema', () => {
    const before = JSON.stringify(naSchema);
    injectLikertNotApplicable(naSchema);
    expect(JSON.stringify(naSchema)).toBe(before);
  });

  it('ensures type allows null for preset-based N/A fields without oneOf', () => {
    const normalized = injectLikertNotApplicable({
      type: 'object',
      properties: {
        freq: {
          type: 'integer',
          format: 'likert',
          likert: { preset: 'frequency', allowNotApplicable: true },
        },
      },
    }) as { properties: { freq: { type: unknown } } };
    expect(normalized.properties.freq.type).toEqual(['integer', 'null']);
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
