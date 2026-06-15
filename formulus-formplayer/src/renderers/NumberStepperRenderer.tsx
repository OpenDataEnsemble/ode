/**
 * NumberStepperRenderer
 *
 * Custom renderer for number/integer fields that adds simple +/- buttons
 * via Material-UI's InputAdornment. Uses QuestionShell for unified layout.
 */

import React, { useState } from 'react';
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

const isNumberControl: RankedTester = rankWith(
  5,
  schemaMatches(schema => {
    const type = schema.type;
    return type === 'number' || type === 'integer';
  }),
);

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
  if (visible === false) return null;

  const numericValue =
    data !== undefined && data !== null && data !== '' ? Number(data) : 0;
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

  const handleAdd = () => {
    const currentValue = numericValue || 0;
    const newValue = currentValue + step;
    if (max === undefined || newValue <= max) {
      handleChange(path, newValue);
    }
  };

  const handleSubtract = () => {
    const currentValue = numericValue || 0;
    const newValue = currentValue - step;
    if (min === undefined || newValue >= min) {
      handleChange(path, newValue);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value === '') {
      handleChange(path, undefined);
      return;
    }
    const numValue = Number(value);
    if (!isNaN(numValue)) {
      // Do not clamp while typing — validation surfaces out-of-range values.
      handleChange(path, numValue);
    }
  };

  const currentValue = numericValue || 0;
  const addDisabled = max !== undefined && currentValue >= max;
  const subtractDisabled = min !== undefined && currentValue <= min;

  const [isFocused, setIsFocused] = useState(false);

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
        type="number"
        value={numericValue === 0 && data === undefined ? '' : numericValue}
        onChange={handleInputChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={!enabled}
        error={Boolean(errorStr)}
        fullWidth
        inputProps={{ step }}
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
        sx={{
          width: '100%',
          '& input[type="number"]': {
            MozAppearance: 'textfield',
            '&::-webkit-outer-spin-button': {
              WebkitAppearance: 'none',
              margin: 0,
            },
            '&::-webkit-inner-spin-button': {
              WebkitAppearance: 'none',
              margin: 0,
            },
          },
        }}
      />
    </QuestionShell>
  );
};

export const numberStepperRenderer: JsonFormsRendererRegistryEntry = {
  tester: isNumberControl,
  renderer: withJsonFormsControlProps(NumberStepperRenderer),
};

export default withJsonFormsControlProps(NumberStepperRenderer);
