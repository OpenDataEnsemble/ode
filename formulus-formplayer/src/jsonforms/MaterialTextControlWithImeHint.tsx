import React from 'react';
import {
  ControlProps,
  isStringControl,
  RankedTester,
  rankWith,
} from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import {
  MaterialInputControl,
  MuiInputText,
} from '@jsonforms/material-renderers';
import { useFormContext } from '../App';

/** Stock typings omit `muiInputProps`; MuiInputText still reads it from spread props. */
const MaterialInputControlUntyped = MaterialInputControl as React.FC<
  ControlProps & {
    input: typeof MuiInputText;
    muiInputProps?: React.ComponentProps<typeof MuiInputText>['muiInputProps'];
  }
>;

/**
 * Same as JSON Forms Material text control, but sets `enterKeyHint` from
 * {@link FormContextType.keyboardEnterKeyHint} for mobile IME labels.
 */
const MaterialTextControlWithImeHint = (props: ControlProps) => {
  const { keyboardEnterKeyHint } = useFormContext();

  return (
    <MaterialInputControlUntyped
      {...props}
      muiInputProps={
        keyboardEnterKeyHint
          ? { enterKeyHint: keyboardEnterKeyHint }
          : undefined
      }
      input={MuiInputText}
    />
  );
};

/** Rank 2 beats stock `materialTextControlTester` (rank 1). */
export const materialTextControlWithImeHintTester: RankedTester = rankWith(
  2,
  isStringControl,
);

export default withJsonFormsControlProps(MaterialTextControlWithImeHint);
