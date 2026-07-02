import React, { useCallback } from 'react';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import {
  alpha,
  Box,
  ButtonBase,
  FormControlLabel,
  Radio,
  RadioGroup,
  Rating,
  Slider,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { getSpectrumColor } from './likertColors';
import type { LikertOption, ResolvedLikertOptions } from './likertTypes';
import { isNotApplicableValue, valuesEqual } from './likertConfig';
import { choiceListSx } from '../../theme/choiceLayout';

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
        gap: 1,
        px: 0.5,
        mt: 0.5,
      }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textAlign: 'left', maxWidth: '48%' }}>
        {options[0].label}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textAlign: 'right', maxWidth: '48%' }}>
        {options[options.length - 1].label}
      </Typography>
    </Box>
  );
}

/**
 * True when the endpoints carry real word labels (not just the numeric
 * value). Research on survey scales recommends pairing numeric anchors with
 * verbal endpoint labels, so we surface them under numeric scales.
 */
function hasWordEndpoints(options: LikertOption[]): boolean {
  if (options.length < 2) return false;
  const first = options[0];
  const last = options[options.length - 1];
  return (
    first.label !== String(first.value) || last.label !== String(last.value)
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
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const {
    options,
    display,
    colorMode,
    endpointLabelsOnly,
    allowClear,
    allowNotApplicable,
    notApplicableLabel,
    notApplicableValue,
    layout,
  } = resolved;

  const isNa = isNotApplicableValue(value, notApplicableValue);
  const scaleValue = isNa ? null : value;
  const vertical = layout.mode === 'vertical';
  const useGrid = layout.mode === 'columns';

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

  type CellWidth = 'word' | 'emoji' | 'compact';

  /**
   * One shared cell style for buttons / numeric / emoji: outlined pills with a
   * faint fill so options read as tappable (not bare labels). Selected option
   * gets an accent tint; in review/disabled mode the answer stays prominent
   * while unselected options fade back.
   */
  const cellSx = (index: number, selected: boolean, width: CellWidth) => {
    const accent = accentFor(index);
    const unselectedBg =
      width === 'compact' || width === 'emoji'
        ? theme.palette.action.hover
        : alpha(theme.palette.text.primary, 0.04);
    return {
      minHeight: 44,
      px: 1,
      py: 0.75,
      borderRadius: 1.5,
      border: '1px solid',
      borderColor: selected ? accent : neutralBorder,
      backgroundColor: selected ? alpha(accent, 0.12) : unselectedBg,
      color: selected ? accent : theme.palette.text.primary,
      fontWeight: selected ? 600 : 400,
      fontSize: '0.8125rem',
      lineHeight: 1.3,
      textAlign: 'center' as const,
      overflowWrap: 'break-word' as const,
      hyphens: 'auto' as const,
      transition: theme.transitions.create(
        ['border-color', 'background-color', 'color', 'opacity'],
        { duration: theme.transitions.duration.shortest },
      ),
      '&:hover': enabled
        ? {
            backgroundColor: selected
              ? alpha(accent, 0.16)
              : theme.palette.action.selected,
          }
        : undefined,
      '&.Mui-focusVisible': {
        outline: `2px solid ${alpha(accent, 0.5)}`,
        outlineOffset: 1,
      },
      '&.Mui-disabled': selected
        ? {
            color: accent,
            borderColor: accent,
            backgroundColor: alpha(accent, 0.14),
            opacity: 1,
          }
        : {
            color: theme.palette.text.disabled,
            borderColor: theme.palette.divider,
            backgroundColor: alpha(theme.palette.text.primary, 0.02),
            opacity: 0.55,
          },
    };
  };

  const naCellSx = () => {
    const accent = theme.palette.text.secondary;
    return {
      minHeight: 44,
      px: 1.25,
      py: 0.75,
      borderRadius: 1.5,
      border: '1px dashed',
      borderColor: isNa ? accent : neutralBorder,
      backgroundColor: isNa ? alpha(accent, 0.12) : theme.palette.action.hover,
      color: isNa ? accent : theme.palette.text.secondary,
      fontWeight: isNa ? 600 : 400,
      fontSize: '0.8125rem',
      gap: 0.5,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      textTransform: 'none' as const,
      '&.Mui-focusVisible': {
        outline: `2px solid ${alpha(accent, 0.4)}`,
        outlineOffset: 1,
      },
    };
  };

  /**
   * Row container per variant. Word scales use an equal-column CSS grid so every
   * option is the same width and the last one never orphans to a full-width row
   * (a flex-wrap artifact). Compact/emoji cells wrap in a flex row.
   */
  const cellRowSxFor = (width: CellWidth) => {
    if (useGrid) return choiceListSx(layout);
    if (vertical) {
      return { display: 'flex', flexDirection: 'column', gap: 0.75 };
    }
    if (width === 'word' || width === 'emoji') {
      const cols = `repeat(${options.length}, minmax(0, 1fr))`;
      return {
        display: 'grid',
        // Word scales stack on phones; emoji stay in one equal-width row (they
        // are compact), both use equal columns from the sm breakpoint up.
        gridTemplateColumns: width === 'word' ? { xs: '1fr', sm: cols } : cols,
        gap: 0.75,
        alignItems: 'stretch',
      };
    }
    return {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 0.75,
    };
  };

  /**
   * Horizontal per-item sizing:
   * - `word` / `emoji` : sizing comes from the equal-column grid; only guard
   *             against overflow so labels wrap inside the cell (equal widths).
   * - `compact`: small fixed cells (numeric/NPS), touch-friendly (44px min).
   */
  const horizontalCellSx = (width: CellWidth) => {
    switch (width) {
      case 'word':
      case 'emoji':
        return useGrid ? { width: '100%' } : { minWidth: 0 };
      case 'compact':
      default:
        return { flex: '0 0 auto', minWidth: 48 };
    }
  };

  const renderNaCell = (inline: boolean) => {
    if (!allowNotApplicable) return null;
    return (
      <ButtonBase
        disabled={!enabled}
        onClick={handleNa}
        aria-label={notApplicableLabel}
        aria-pressed={isNa}
        focusRipple
        sx={{
          ...naCellSx(),
          ...(inline
            ? { flex: '0 0 auto', minWidth: 48, alignSelf: 'stretch' }
            : { alignSelf: 'flex-start', mt: inline ? 0 : 0.25 }),
        }}>
        <BlockOutlinedIcon sx={{ fontSize: 16 }} />
        {notApplicableLabel}
      </ButtonBase>
    );
  };

  // Inline N/A only in compact flex rows (numeric / endpoint-only buttons).
  // Grid-based scales (word buttons, emoji) keep the N/A below so the
  // equal-column grid stays uniform (no mismatched extra cell).
  const inlineNa =
    allowNotApplicable &&
    !vertical &&
    (display === 'numeric' || (display === 'buttons' && endpointLabelsOnly));

  const renderCells = (
    content: (opt: LikertOption, index: number) => React.ReactNode,
    width: CellWidth,
    showEndpoints: boolean,
  ) => (
    <Box>
      <Box sx={cellRowSxFor(width)} role="group">
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
                ...cellSx(index, selected, width),
                ...(vertical
                  ? { justifyContent: 'flex-start', textAlign: 'left', px: 1.5 }
                  : horizontalCellSx(width)),
              }}>
              {content(opt, index)}
            </ButtonBase>
          );
        })}
        {inlineNa && renderNaCell(true)}
      </Box>
      {showEndpoints && !vertical && <EndpointLabels options={options} />}
    </Box>
  );

  const renderButtons = () =>
    renderCells(
      opt => (endpointLabelsOnly ? String(opt.value) : opt.label),
      endpointLabelsOnly ? 'compact' : 'word',
      endpointLabelsOnly,
    );

  const renderNumeric = () =>
    renderCells(
      opt => String(opt.value),
      'compact',
      // Surface verbal endpoint anchors when the form provides them.
      hasWordEndpoints(options),
    );

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
          {/* Always pair the emoji with its text label to avoid the
              cultural/interpretive ambiguity of emoji-only scales. */}
          <Typography
            variant="caption"
            sx={{ fontSize: '0.7rem', textAlign: 'center' }}>
            {opt.label}
          </Typography>
        </Box>
      ),
      'emoji',
      false,
    );

  const renderRadio = () => {
    // Phones: stack rows with the label beside each radio — the standard
    // readable mobile pattern. Tablets/desktop: a row with labels below.
    const stack = vertical || (isPhone && !endpointLabelsOnly);
    return (
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
              flexDirection: stack ? 'column' : 'row',
              flexWrap: stack ? 'nowrap' : 'wrap',
              rowGap: stack ? 0 : 1,
              width: '100%',
            }}>
            {options.map(opt => (
              <FormControlLabel
                key={String(opt.value)}
                disabled={!enabled}
                value={String(opt.value)}
                control={<Radio />}
                labelPlacement={stack ? 'end' : 'bottom'}
                label={
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: stack ? '0.875rem' : '0.75rem',
                      textAlign: stack ? 'left' : 'center',
                      overflowWrap: 'break-word',
                      hyphens: 'auto',
                    }}>
                    {endpointLabelsOnly ? String(opt.value) : opt.label}
                  </Typography>
                }
                sx={
                  stack
                    ? undefined
                    : endpointLabelsOnly
                      ? {
                          flex: '0 1 48px',
                          m: 0,
                          minWidth: 40,
                          alignItems: 'center',
                        }
                      : {
                          flex: '1 1 64px',
                          m: 0,
                          minWidth: 56,
                          alignItems: 'center',
                        }
                }
              />
            ))}
          </Box>
        </RadioGroup>
        {endpointLabelsOnly && !vertical && (
          <EndpointLabels options={options} />
        )}
      </Box>
    );
  };

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
          valueLabelDisplay="on"
          valueLabelFormat={v => `${v}/${max}`}
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
      {allowNotApplicable && !inlineNa && renderNaCell(false)}
    </Box>
  );
}
