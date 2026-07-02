import React, { useCallback } from 'react';
import {
  alpha,
  Box,
  Button,
  ButtonBase,
  FormControlLabel,
  Radio,
  RadioGroup,
  Rating,
  Slider,
  Typography,
  useTheme,
} from '@mui/material';
import { getSpectrumColor } from './likertColors';
import type { LikertOption, ResolvedLikertOptions } from './likertTypes';
import { isNotApplicableValue, valuesEqual } from './likertConfig';

export interface LikertScaleControlProps {
  value: unknown;
  onChange: (value: unknown) => void;
  resolved: ResolvedLikertOptions;
  enabled: boolean;
  hasError: boolean;
}

function numericValues(options: LikertOption[]): number[] {
  return options.map(o =>
    typeof o.value === 'number' ? o.value : Number(o.value),
  );
}

/** Left/right captions under a scale — standard endpoint anchor pattern. */
function EndpointLabels({ options }: { options: LikertOption[] }) {
  if (options.length < 2) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        px: 0.5,
        mt: 0.5,
      }}>
      <Typography variant="caption" color="text.secondary">
        {options[0].label}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {options[options.length - 1].label}
      </Typography>
    </Box>
  );
}

export default function LikertScaleControl({
  value,
  onChange,
  resolved,
  enabled,
  hasError,
}: LikertScaleControlProps) {
  const theme = useTheme();
  const {
    options,
    display,
    colorMode,
    endpointLabelsOnly,
    allowClear,
    allowNotApplicable,
    notApplicableLabel,
    notApplicableValue,
    orientation,
  } = resolved;

  const isNa = isNotApplicableValue(value, notApplicableValue);
  const scaleValue = isNa ? null : value;
  const vertical = orientation === 'vertical';

  const handleSelect = useCallback(
    (newValue: unknown) => {
      if (!enabled) return;
      if (
        allowClear &&
        scaleValue !== null &&
        scaleValue !== undefined &&
        valuesEqual(scaleValue, newValue)
      ) {
        onChange(undefined);
        return;
      }
      onChange(newValue);
    },
    [allowClear, enabled, onChange, scaleValue],
  );

  const handleNa = useCallback(() => {
    if (!enabled) return;
    onChange(isNa ? undefined : notApplicableValue);
  }, [enabled, isNa, notApplicableValue, onChange]);

  /** Accent for the selected option: theme primary, or semantic spectrum. */
  const accentFor = (index: number): string =>
    colorMode === 'spectrum'
      ? getSpectrumColor(index, options.length)
      : theme.palette.primary.main;

  const neutralBorder = hasError
    ? theme.palette.error.main
    : theme.palette.divider;

  /**
   * One shared cell style for buttons / numeric / emoji so every Likert
   * looks the same: outlined neutral cells, tinted accent when selected.
   */
  const cellSx = (index: number, selected: boolean) => {
    const accent = accentFor(index);
    return {
      minHeight: 44,
      px: 1,
      py: 0.75,
      borderRadius: 1.5,
      border: '1px solid',
      borderColor: selected ? accent : neutralBorder,
      backgroundColor: selected ? alpha(accent, 0.1) : 'transparent',
      color: selected ? accent : theme.palette.text.primary,
      fontWeight: selected ? 600 : 400,
      fontSize: '0.8125rem',
      lineHeight: 1.3,
      textAlign: 'center' as const,
      overflowWrap: 'break-word' as const,
      hyphens: 'auto' as const,
      transition: theme.transitions.create(
        ['border-color', 'background-color', 'color'],
        { duration: theme.transitions.duration.shortest },
      ),
      '&:hover': {
        backgroundColor: selected
          ? alpha(accent, 0.14)
          : theme.palette.action.hover,
      },
      '&.Mui-focusVisible': {
        outline: `2px solid ${alpha(accent, 0.5)}`,
        outlineOffset: 1,
      },
      '&.Mui-disabled': {
        color: theme.palette.text.disabled,
        borderColor: theme.palette.divider,
      },
    };
  };

  const cellRowSx = {
    display: 'flex',
    flexDirection: vertical ? 'column' : 'row',
    flexWrap: vertical ? 'nowrap' : 'wrap',
    gap: 0.75,
  } as const;

  /**
   * Horizontal sizing per variant:
   * - labeled cells share the row equally but wrap onto extra rows when a
   *   cell would drop below a readable width (long labels, narrow screens);
   * - compact cells (numeric) keep a fixed square-ish footprint and wrap.
   */
  const horizontalCellSx = (labelled: boolean) =>
    labelled
      ? { flex: '1 1 88px', minWidth: 72 }
      : { flex: '0 0 auto', minWidth: 48 };

  const renderCells = (
    content: (opt: LikertOption, index: number) => React.ReactNode,
    labelled: boolean,
  ) => (
    <Box>
      <Box sx={cellRowSx} role="group">
        {options.map((opt, index) => {
          const selected = valuesEqual(scaleValue, opt.value);
          return (
            <ButtonBase
              key={String(opt.value)}
              disabled={!enabled}
              onClick={() => handleSelect(opt.value)}
              aria-label={opt.label}
              aria-pressed={selected}
              focusRipple
              sx={{
                ...cellSx(index, selected),
                ...(vertical
                  ? { justifyContent: 'flex-start', textAlign: 'left', px: 1.5 }
                  : horizontalCellSx(labelled)),
              }}>
              {content(opt, index)}
            </ButtonBase>
          );
        })}
      </Box>
      {endpointLabelsOnly && !vertical && <EndpointLabels options={options} />}
    </Box>
  );

  const renderButtons = () =>
    renderCells(
      opt => (endpointLabelsOnly ? String(opt.value) : opt.label),
      !endpointLabelsOnly,
    );

  const renderNumeric = () => renderCells(opt => String(opt.value), false);

  const renderEmoji = () =>
    renderCells(
      opt => (
        <Box
          sx={{
            display: 'flex',
            flexDirection: vertical ? 'row' : 'column',
            alignItems: 'center',
            gap: vertical ? 1 : 0.25,
          }}>
          <Typography
            component="span"
            sx={{ fontSize: '1.5rem', lineHeight: 1 }}>
            {opt.emoji ?? opt.label.charAt(0)}
          </Typography>
          {!endpointLabelsOnly && (
            <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
              {opt.label}
            </Typography>
          )}
        </Box>
      ),
      true,
    );

  const renderRadio = () => (
    <Box>
      <RadioGroup
        value={scaleValue ?? ''}
        onChange={e => {
          const opt = options.find(o => String(o.value) === e.target.value);
          if (opt) handleSelect(opt.value);
        }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: vertical ? 'column' : 'row',
            flexWrap: vertical ? 'nowrap' : 'wrap',
            rowGap: vertical ? 0 : 1,
            width: '100%',
          }}>
          {options.map(opt => (
            <FormControlLabel
              key={String(opt.value)}
              disabled={!enabled}
              value={String(opt.value)}
              control={<Radio />}
              labelPlacement={vertical ? 'end' : 'bottom'}
              label={
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: vertical ? '0.875rem' : '0.75rem',
                    textAlign: 'center',
                    overflowWrap: 'break-word',
                    hyphens: 'auto',
                  }}>
                  {endpointLabelsOnly ? String(opt.value) : opt.label}
                </Typography>
              }
              sx={
                vertical
                  ? undefined
                  : {
                      flex: endpointLabelsOnly ? '0 1 48px' : '1 1 64px',
                      m: 0,
                      minWidth: endpointLabelsOnly ? 40 : 56,
                      alignItems: 'center',
                    }
              }
            />
          ))}
        </Box>
      </RadioGroup>
      {endpointLabelsOnly && !vertical && <EndpointLabels options={options} />}
    </Box>
  );

  const renderSlider = () => {
    const nums = numericValues(options);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const step = nums.length > 1 ? Math.abs(nums[1] - nums[0]) || 1 : 1;
    const current =
      typeof scaleValue === 'number'
        ? scaleValue
        : scaleValue !== null && scaleValue !== undefined
          ? Number(scaleValue)
          : min;
    const currentIndex = options.findIndex(o => valuesEqual(o.value, current));

    return (
      <Box sx={{ px: 1, pt: 1 }}>
        <Slider
          disabled={!enabled}
          min={min}
          max={max}
          step={step}
          marks
          value={Number.isNaN(current) ? min : current}
          onChange={(_e, v) => handleSelect(v as number)}
          valueLabelDisplay="auto"
          sx={
            colorMode === 'spectrum' && currentIndex >= 0
              ? { color: accentFor(currentIndex) }
              : undefined
          }
        />
        <EndpointLabels options={options} />
      </Box>
    );
  };

  const renderStars = () => {
    const starIndex = options.findIndex(o => valuesEqual(o.value, scaleValue));
    const ratingValue = starIndex >= 0 ? starIndex + 1 : null;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Rating
          max={options.length}
          value={ratingValue}
          disabled={!enabled}
          size="large"
          onChange={(_e, newRating) => {
            if (newRating == null) {
              if (allowClear) onChange(undefined);
              return;
            }
            handleSelect(options[newRating - 1].value);
          }}
          getLabelText={star => options[star - 1]?.label ?? String(star)}
        />
        {ratingValue !== null && (
          <Typography variant="body2" color="text.secondary">
            {options[ratingValue - 1]?.label ?? ''}
          </Typography>
        )}
      </Box>
    );
  };

  const renderScale = () => {
    switch (display) {
      case 'radio':
        return renderRadio();
      case 'slider':
        return renderSlider();
      case 'numeric':
        return renderNumeric();
      case 'stars':
        return renderStars();
      case 'emoji':
        return renderEmoji();
      case 'buttons':
      default:
        return renderButtons();
    }
  };

  if (options.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No scale options configured.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {renderScale()}
      {allowNotApplicable && (
        <Button
          variant={isNa ? 'contained' : 'outlined'}
          size="small"
          color="inherit"
          disabled={!enabled}
          onClick={handleNa}
          sx={{
            alignSelf: 'flex-start',
            textTransform: 'none',
            ...(isNa
              ? {
                  backgroundColor: theme.palette.text.secondary,
                  color: theme.palette.background.paper,
                }
              : { color: theme.palette.text.secondary }),
          }}>
          {notApplicableLabel}
        </Button>
      )}
    </Box>
  );
}
