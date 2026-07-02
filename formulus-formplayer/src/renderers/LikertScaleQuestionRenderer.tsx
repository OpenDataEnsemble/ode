import React from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, rankWith, schemaMatches } from '@jsonforms/core';
import QuestionShell from '../components/QuestionShell';
import LikertScaleControl from '../components/likert/LikertScaleControl';
import { resolveLikertOptions } from '../components/likert/likertConfig';
import { formatControlErrors } from '../utils/formatControlErrors';

export const likertScaleQuestionTester = rankWith(
  12,
  schemaMatches(
    schema =>
      typeof schema === 'object' &&
      schema !== null &&
      (schema as { format?: string }).format === 'likert',
  ),
);

const LikertScaleQuestionRenderer: React.FC<ControlProps> = ({
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
  const resolved = resolveLikertOptions(
    schema,
    uischema as { options?: Record<string, unknown> },
  );
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

  if (visible === false) {
    return null;
  }

  const title =
    (uischema as { label?: string })?.label ?? label ?? schema.title ?? '';
  const description = schema.description;

  return (
    <QuestionShell
      title={title}
      description={description}
      required={required}
      error={errorMessage}>
      <LikertScaleControl
        value={data}
        onChange={newValue => handleChange(path, newValue)}
        resolved={resolved}
        enabled={enabled}
        hasError={Boolean(errorMessage)}
      />
    </QuestionShell>
  );
};

export default withJsonFormsControlProps(LikertScaleQuestionRenderer);
