import type { ReactNode } from 'react';
import { Box, FormGroup } from '@mui/material';
import { choiceListSx, type ChoiceLayout } from './choiceLayout';

type ChoiceOptionListProps = {
  layout: ChoiceLayout;
  role?: 'group' | 'radiogroup';
  children: ReactNode;
};

/** FormGroup theme sets flexDirection column; use Box for non-vertical layouts. */
export function ChoiceOptionList({
  layout,
  role = 'group',
  children,
}: ChoiceOptionListProps) {
  if (layout.mode === 'vertical') {
    return <FormGroup sx={choiceListSx(layout)}>{children}</FormGroup>;
  }
  return (
    <Box role={role} sx={choiceListSx(layout)}>
      {children}
    </Box>
  );
}
