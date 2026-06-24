/**
 * NumberStepperRenderer
 *
 * Custom renderer for number/integer fields that adds simple +/- buttons
 * via Material-UI's InputAdornment. Uses QuestionShell for unified layout.
 *
 * Numeric input policy: draft text while focused; observation JSON stores
 * numbers only; never clamp to schema bounds while typing.
 */

import React from 'react';
import {
  ControlProps,
  RankedTester,
  rankWith,
  schemaMatches,
  JsonFormsRendererRegistryEntry,
} from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import QuestionShell from '../components/QuestionShell';
import { useFormContext } from '../App';
import {
  useNumericDraftInput,
  type NumericSchemaKind,
} from '../hooks/useNumericDraftInput';

const isNumberControl: RankedTester = rankWith(
  5,
  schemaMatches(schema => {
    const type = schema.type;
    return type === 'number' || type === 'integer';
  }),
);

function committedNumeric(data: unknown): number | undefined {
  if (data === undefined || data === null || data === '') return undefined;
  const n = typeof data === 'number' ? data : Number(data);
  return Number.isNaN(n) ? undefined : n;
}

const NumberStepperRenderer = ({
  data,
  handleChange,
  path,
  schema,
  uischema,
  errors,
  enabled = true,
  label,
  visible,
  required,
}: ControlProps) => {
  const { keyboardEnterKeyHint } = useFormContext();
  const schemaKind: NumericSchemaKind =
    schema.type === 'integer' ? 'integer' : 'number';

  const {
    isFocused,
    displayValue,
    onFocus,
    onBlur,
    onChange,
    syncDraftFromData,
    inputProps,
  } = useNumericDraftInput({
    data,
    path,
    handleChange,
    schemaKind,
    enterKeyHint: keyboardEnterKeyHint,
    enabled,
  });

  if (visible === false) return null;

  const min = schema.minimum ?? (schema as { minimum?: number }).minimum;
  const max = schema.maximum ?? (schema as { maximum?: number }).maximum;
  const step = schema.multipleOf ?? (schema as { step?: number }).step ?? 1;

  const title =
    (uischema as { label?: string })?.label || schema.title || label;
  const description = schema.description;
  const isRequired = Boolean(
    (uischema as { options?: { required?: boolean } })?.options?.required ??
    required,
  );
  const autoFocus =
    (uischema as { options?: { autoFocus?: boolean } })?.options?.autoFocus ===
    true;

  const currentValue = committedNumeric(data) ?? 0;

  const applyStepperValue = (newValue: number) => {
    handleChange(path, newValue);
    syncDraftFromData(newValue);
  };

  const handleAdd = () => {
    const newValue = currentValue + step;
    if (max === undefined || newValue <= max) {
      applyStepperValue(newValue);
    }
  };

  const handleSubtract = () => {
    const newValue = currentValue - step;
    if (min === undefined || newValue >= min) {
      applyStepperValue(newValue);
    }
  };

  const addDisabled = max !== undefined && currentValue >= max;
  const subtractDisabled = min !== undefined && currentValue <= min;

  const errorStr = Array.isArray(errors)
    ? errors.filter(Boolean).join(', ')
    : errors || null;

  return (
    <QuestionShell
      title={title}
      description={description}
      required={isRequired}
      error={errorStr}>
      <TextField
        value={displayValue}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={!enabled}
        error={Boolean(errorStr)}
        fullWidth
        autoFocus={autoFocus}
        inputProps={{
          ...inputProps,
          ...(autoFocus ? { 'data-formplayer-autofocus': 'true' } : {}),
        }}
        InputProps={{
          endAdornment: isFocused ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={handleSubtract}
                onMouseDown={e => e.preventDefault()}
                disabled={subtractDisabled || !enabled}
                edge="end"
                aria-label={`Decrease ${title || 'value'}`}>
                <Remove fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={handleAdd}
                onMouseDown={e => e.preventDefault()}
                disabled={addDisabled || !enabled}
                edge="end"
                aria-label={`Increase ${title || 'value'}`}>
                <Add fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
        sx={{ width: '100%' }}
      />
    </QuestionShell>
  );
};

export const numberStepperRenderer: JsonFormsRendererRegistryEntry = {
  tester: isNumberControl,
  renderer: withJsonFormsControlProps(NumberStepperRenderer),
};

export default withJsonFormsControlProps(NumberStepperRenderer);
