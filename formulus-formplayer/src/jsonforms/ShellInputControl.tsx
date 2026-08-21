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
import {
  resolveControlDescription,
  resolveControlLabel,
} from '../utils/controlDisplayText';
import { useClearOnHide } from './useClearOnHide';

/**
 * String control that renders the stock MuiInputText cell inside QuestionShell
 * (two-column layout + unified typography) instead of MaterialInputControl's
 * floating InputLabel.
 */
const ShellInputControl = (props: ControlProps) => {
  const { keyboardEnterKeyHint } = useFormContext();
  const {
    uischema,
    schema,
    errors,
    visible,
    required,
    path,
    data,
    handleChange,
  } = props;

  useClearOnHide({ visible, path, data, handleChange });
  if (visible === false) return null;

  const title = resolveControlLabel(props);
  const description = resolveControlDescription(props) ?? schema?.description;
  const isRequired = Boolean(
    (uischema as { options?: { required?: boolean } })?.options?.required ??
    required,
  );
  const errorStr = Array.isArray(errors)
    ? errors.filter(Boolean).join(', ')
    : errors || null;
  const isValid = !errorStr;
  const autoFocus =
    (uischema as { options?: { autoFocus?: boolean } })?.options?.autoFocus ===
    true;
  const uiOptions = (
    uischema as {
      options?: {
        multi?: boolean;
        minRows?: number;
        rows?: number;
        maxRows?: number;
      };
    }
  )?.options;
  const multiline = uiOptions?.multi === true;
  const minRows =
    typeof uiOptions?.minRows === 'number' ? uiOptions.minRows : undefined;
  const rows = typeof uiOptions?.rows === 'number' ? uiOptions.rows : undefined;
  const maxRows =
    typeof uiOptions?.maxRows === 'number' ? uiOptions.maxRows : undefined;

  const cellProps = {
    ...(props as React.ComponentProps<typeof MuiInputText>),
    errors: '',
  };

  return (
    <QuestionShell
      title={title}
      description={description}
      required={isRequired}
      error={errorStr}>
      <MuiInputText
        {...cellProps}
        label={undefined}
        isValid={isValid}
        muiInputProps={{
          ...(multiline ? { multiline: true } : {}),
          ...(minRows != null ? { minRows } : {}),
          ...(rows != null ? { rows } : {}),
          ...(maxRows != null ? { maxRows } : {}),
          ...(keyboardEnterKeyHint
            ? { enterKeyHint: keyboardEnterKeyHint }
            : {}),
          ...(autoFocus
            ? {
                autoFocus: true,
                'data-formplayer-autofocus': 'true',
              }
            : {}),
        }}
      />
    </QuestionShell>
  );
};

export const shellInputControlTester: RankedTester = rankWith(
  2,
  isStringControl,
);

export default withJsonFormsControlProps(ShellInputControl);
