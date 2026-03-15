import React, { useState, useCallback } from 'react';
import { JsonForms } from '@jsonforms/react';
import { materialRenderers } from '@jsonforms/material-renderers';
import type { JsonSchema7, UISchemaElement } from '@jsonforms/core';
import type { JsonFormsRendererRegistryEntry } from '@jsonforms/core';

interface JsonFormsControlWrapperProps {
  schema: JsonSchema7;
  uischema: UISchemaElement;
  initialData?: Record<string, unknown>;
  renderers: JsonFormsRendererRegistryEntry[];
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
}: JsonFormsControlWrapperProps) {
  const [data, setData] = useState<Record<string, unknown>>(initialData);

  const handleChange = useCallback(
    (_path: string, value: unknown) => {
      const key = Object.keys(schema.properties || {})[0];
      if (key) setData(prev => ({ ...prev, [key]: value }));
    },
    [schema.properties],
  );

  return (
    <JsonForms
      schema={schema}
      uischema={uischema}
      data={data}
      renderers={renderers}
      onChange={({ data: newData }) => setData(newData || {})}
    />
  );
}
