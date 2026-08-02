import React from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, rankWith, schemaMatches } from '@jsonforms/core';
import QuestionShell from '../components/QuestionShell';
import { useClearOnHide } from '../jsonforms/useClearOnHide';
import DurationControl from '../components/duration/DurationControl';
import { formatControlErrors } from '../utils/formatControlErrors';

export const durationQuestionTester = rankWith(
  12,
  schemaMatches(
    schema =>
      typeof schema === 'object' &&
      schema !== null &&
      (schema as { format?: string }).format === 'duration',
  ),
);

const DurationQuestionRenderer: React.FC<ControlProps> = ({
  data,
  handleChange,
  path,
  errors,
  schema,
  uischema,
  enabled = true,
  visible = true,
  label,
  required,
}) => {
  const hasErrors = Boolean(
    errors && (Array.isArray(errors) ? errors.length > 0 : true),
  );
  const errorMessage = formatControlErrors(
    hasErrors
      ? Array.isArray(errors)
        ? errors.map((e: { message?: string } | string) =>
            typeof e === 'object' && e && 'message' in e && e.message
              ? String(e.message)
              : String(e),
          )
        : errors
      : null,
  );

  useClearOnHide({ visible, path, data, handleChange });
  if (visible === false) {
    return null;
  }

  const title =
    (uischema as { label?: string })?.label ?? label ?? schema.title ?? '';
  const description = schema.description;

  return (
    <QuestionShell
      block
      title={title}
      description={description}
      required={required}
      error={errorMessage}>
      <DurationControl
        value={data}
        onChange={newValue => handleChange(path, newValue)}
        schema={schema as Record<string, unknown>}
        enabled={enabled}
        hasError={Boolean(errorMessage)}
      />
    </QuestionShell>
  );
};

export default withJsonFormsControlProps(DurationQuestionRenderer);
