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

let capturedProps: CustomQuestionTypeProps | null = null;

function SpyCqt(props: CustomQuestionTypeProps) {
  capturedProps = props;
  return <div data-testid="spy-cqt" />;
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

const rawUischema: UISchemaElement = {
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
};

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
  capturedProps = null;
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
    expect(capturedProps?.options).toEqual({
      lowLabel: 'Nada',
      highLabel: 'Completamente',
    });
  });

  it('passes default options when locale has no translation block', () => {
    const uischema = applyFormUiTranslations(
      rawUischema,
      'de',
    ) as UISchemaElement;

    renderWithUischema(uischema);

    expect(capturedProps?.options).toEqual({
      lowLabel: 'Not at all',
      highLabel: 'Completely',
    });
  });
});
