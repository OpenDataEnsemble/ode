import type { SxProps, Theme } from '@mui/material';

export type ColumnCount = 2 | 3 | 4 | 5;

export type ChoiceLayout =
  | { mode: 'vertical' }
  | { mode: 'horizontal' }
  | { mode: 'flow' }
  | { mode: 'columns'; columns: ColumnCount };

const COLS_PATTERN = /^cols-([2-5])$/;

export function parseChoiceLayout(
  options?: Record<string, unknown>,
): ChoiceLayout {
  const orientation = options?.orientation;
  if (orientation === 'horizontal' || orientation === 'flow') {
    return { mode: orientation };
  }
  if (typeof orientation === 'string') {
    const match = COLS_PATTERN.exec(orientation);
    if (match) {
      return { mode: 'columns', columns: Number(match[1]) as ColumnCount };
    }
  }
  return { mode: 'vertical' };
}

const formControlLabelRowSx = {
  '& .MuiFormControlLabel-root': {
    width: 'auto',
    marginRight: 0.5,
  },
};

export function choiceListSx(layout: ChoiceLayout): SxProps<Theme> {
  if (layout.mode === 'columns') {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
      gap: 0.5,
      alignItems: 'start',
      ...formControlLabelRowSx,
    };
  }

  return {
    display: 'flex',
    flexDirection: layout.mode === 'vertical' ? 'column' : 'row',
    flexWrap: layout.mode === 'flow' ? 'wrap' : 'nowrap',
    gap: layout.mode === 'vertical' ? 0 : 0.5,
    alignItems: layout.mode === 'vertical' ? undefined : 'center',
    ...(layout.mode !== 'vertical' ? formControlLabelRowSx : {}),
  };
}

/** ToggleButtonGroup only supports vertical/horizontal; cols-* falls back to flow wrap. */
export function toggleButtonListSx(
  layout: ChoiceLayout,
  separated: boolean,
): SxProps<Theme> {
  const wrap =
    layout.mode === 'flow' || layout.mode === 'columns' ? 'wrap' : 'nowrap';
  return {
    flexWrap: wrap,
    ...(separated
      ? {
          gap: 1,
          '& .MuiToggleButtonGroup-grouped': {
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            '&:not(:first-of-type)': { marginLeft: 0 },
          },
        }
      : {}),
  };
}

export function toggleButtonOrientation(
  layout: ChoiceLayout,
): 'vertical' | 'horizontal' {
  return layout.mode === 'vertical' ? 'vertical' : 'horizontal';
}
