import React from 'react';
import {
  ControlProps,
  isStringControl,
  RankedTester,
  rankWith,
} from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { MuiInputText } from '@jsonforms/material-renderers';
import QuestionShell from '../components/QuestionShell';
import { useFormContext } from '../App';

/**
 * String control that renders the stock MuiInputText cell inside QuestionShell
 * (two-column layout + unified typography) instead of MaterialInputControl's
 * floating InputLabel.
 */
const ShellInputControl = (props: ControlProps) => {
  const { keyboardEnterKeyHint } = useFormContext();
  const { uischema, schema, errors, label, visible, required } = props;

  if (visible === false) return null;

  const title = (uischema as { label?: string })?.label || schema?.title || label;
  const description = schema?.description;
  const isRequired = Boolean(
    (uischema as { options?: { required?: boolean } })?.options?.required ??
      required,
  );
  const errorStr = Array.isArray(errors)
    ? errors.filter(Boolean).join(', ')
    : errors || null;
  const isValid = !errorStr;

  return (
    <QuestionShell
      title={title}
      description={description}
      required={isRequired}
      error={errorStr}>
      <MuiInputText
        {...(props as React.ComponentProps<typeof MuiInputText>)}
        label={undefined}
        isValid={isValid}
        muiInputProps={
          keyboardEnterKeyHint
            ? { enterKeyHint: keyboardEnterKeyHint }
            : undefined
        }
      />
    </QuestionShell>
  );
};

export const shellInputControlTester: RankedTester = rankWith(
  2,
  isStringControl,
);

export default withJsonFormsControlProps(ShellInputControl);
