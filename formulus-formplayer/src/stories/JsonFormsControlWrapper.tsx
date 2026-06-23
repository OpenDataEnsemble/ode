import React, { useState } from 'react';
import { JsonForms } from '@jsonforms/react';
import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import type { JsonFormsRendererRegistryEntry } from '@jsonforms/core';
import { FormContext } from '../App';
import type { KeyboardPrimaryEnterKeyHint } from '../utils/keyboardEnterKeyHint';

interface JsonFormsControlWrapperProps {
  schema: JsonSchema7;
  uischema: UISchemaElement;
  initialData?: Record<string, unknown>;
  renderers: JsonFormsRendererRegistryEntry[];
  keyboardEnterKeyHint?: KeyboardPrimaryEnterKeyHint;
  validationMode?: 'ValidateAndShow' | 'ValidateAndHide' | 'NoValidation';
}

/**
 * Wraps a single control in JsonForms so it receives proper ControlProps (data, handleChange, path, etc.).
 * Use this in Storybook stories to render question renderers in isolation.
 */
export function JsonFormsControlWrapper({
  schema,
  uischema,
  initialData = {},
  renderers,
  keyboardEnterKeyHint = 'next',
  validationMode = 'ValidateAndShow',
}: JsonFormsControlWrapperProps) {
  const [data, setData] = useState<Record<string, unknown>>(initialData);

  return (
    <FormContext.Provider
      value={{
        formInitData: null,
        keyboardEnterKeyHint,
        draftSessionKey: null,
      }}>
      <JsonForms
        schema={schema}
        uischema={uischema}
        data={data}
        renderers={renderers}
        validationMode={validationMode}
        onChange={({ data: newData }) => setData(newData || {})}
      />
    </FormContext.Provider>
  );
}
