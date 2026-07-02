// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { JsonForms } from '@jsonforms/react';
import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import { materialRenderers } from '@jsonforms/material-renderers';
import Ajv from 'ajv';
import { theme } from '../theme/theme';
import { FormContext } from '../App';
import LikertScaleQuestionRenderer, {
  likertScaleQuestionTester,
} from './LikertScaleQuestionRenderer';
import LikertScaleControl from '../components/likert/LikertScaleControl';
import { resolveLikertOptions } from '../components/likert/likertConfig';
import type { LikertJsonSchema } from '../components/likert/likertTypes';
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

const satisfactionSchema: JsonSchema7 = {
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
          schema={satisfactionSchema}
          uischema={satisfactionUischema}
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
});

describe('resolveLikertOptions', () => {
  it('uses preset when oneOf is omitted', async () => {
    const resolved = resolveLikertOptions({
      type: 'integer',
      format: 'likert',
      likert: { preset: 'agreement' },
    } as LikertJsonSchema);
    expect(resolved.options).toHaveLength(5);
    expect(resolved.options[0].label).toBe('Strongly disagree');
  });
});
