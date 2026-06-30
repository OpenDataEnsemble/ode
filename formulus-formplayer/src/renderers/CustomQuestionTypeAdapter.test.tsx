// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { JsonForms } from '@jsonforms/react';
import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import Ajv from 'ajv';
import { theme } from '../theme/theme';
import { FormContext } from '../App';
import { registerCustomQuestionTypes } from '../services/CustomQuestionTypeRegistry';
import type { CustomQuestionTypeProps } from '../types/CustomQuestionTypeContract';
import { applyFormUiTranslations } from '../i18n/applyFormUiTranslations';

const FORMAT = 'confidence-rating-test';
const ajv = new Ajv({ allErrors: true, strict: false });

function SpyCqt(props: CustomQuestionTypeProps) {
  return (
    <div
      data-testid="spy-cqt"
      data-options={JSON.stringify(props.options ?? null)}
    />
  );
}

function readCapturedOptions(): Record<string, unknown> | null {
  const raw = screen.getByTestId('spy-cqt').getAttribute('data-options');
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

const schema: JsonSchema7 = {
  type: 'object',
  properties: {
    confidence: {
      type: 'number',
      title: 'Confidence',
      format: FORMAT,
    },
  },
};

const rawUischema = {
  type: 'Control',
  scope: '#/properties/confidence',
  options: {
    lowLabel: 'Not at all',
    highLabel: 'Completely',
  },
  translations: {
    pt: {
      options: {
        lowLabel: 'Nada',
        highLabel: 'Completamente',
      },
    },
  },
} as UISchemaElement;

function renderWithUischema(uischema: UISchemaElement) {
  const renderers = registerCustomQuestionTypes(new Map([[FORMAT, SpyCqt]]));

  render(
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
          data={{}}
          renderers={renderers}
          ajv={ajv}
          onChange={() => {}}
        />
      </FormContext.Provider>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe('CustomQuestionTypeAdapter', () => {
  it('passes preprocessed ui.json options to the custom component', () => {
    const uischema = applyFormUiTranslations(
      rawUischema,
      'pt',
    ) as UISchemaElement;

    renderWithUischema(uischema);

    expect(screen.getByTestId('spy-cqt')).toBeTruthy();
    expect(readCapturedOptions()).toEqual({
      lowLabel: 'Nada',
      highLabel: 'Completamente',
    });
  });

  it('passes default options when locale has no translation block', () => {
    // rawUischema.translations only defines `pt`; `de` is not in ui.json.
    const uischema = applyFormUiTranslations(
      rawUischema,
      'de',
    ) as UISchemaElement;

    renderWithUischema(uischema);

    expect(readCapturedOptions()).toEqual({
      lowLabel: 'Not at all',
      highLabel: 'Completely',
    });
  });
});
