import {
  and,
  or,
  isEnumControl,
  isOneOfEnumControl,
  optionIs,
  schemaMatches,
  uiTypeIs,
  RankedTester,
  rankWith,
  ControlProps,
  OwnPropsOfEnum,
  DispatchPropsOfMultiEnumControl,
} from '@jsonforms/core';
import {
  withJsonFormsControlProps,
  withJsonFormsOneOfEnumProps,
  withJsonFormsMultiEnumProps,
} from '@jsonforms/react';
import {
  Typography,
  Box,
  useTheme,
  FormControl,
  Select,
  MenuItem,
  FormHelperText,
  Radio,
  Checkbox,
  FormControlLabel,
  FormGroup,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import QuestionShell from '../components/QuestionShell';
import { tokens } from './tokens-adapter';

const parsePx = (value: string): number =>
  parseInt(String(value).replace('px', ''), 10) || 1;

type AnyControlProps = ControlProps & { errors?: string };

const cardEnumControlTester: RankedTester = rankWith(6, isEnumControl);

const CardEnumControl = (props: AnyControlProps) => {
  const theme = useTheme();
  const {
    data,
    handleChange,
    path,
    schema,
    uischema,
    errors,
    enabled = true,
  } = props;
  const label = (uischema as any)?.label || schema.title;
  const description = schema.description;
  const required = Boolean(
    (uischema as any)?.options?.required ?? (schema as any)?.options?.required,
  );

  const options =
    schema.oneOf?.map((o: any) => ({
      value: o.const ?? o.enum?.[0] ?? o,
      label: o.title ?? String(o.const ?? o),
    })) ||
    (schema.enum || []).map((v: any) => ({ value: v, label: String(v) }));

  return (
    <QuestionShell
      title={label}
      description={description}
      required={required}
      error={errors}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {options.map(opt => {
          const selected = data === opt.value;
          return (
            <Box
              key={String(opt.value)}
              onClick={() => enabled && handleChange(path, opt.value)}
              sx={theme => {
                const isDark = theme.palette.mode === 'dark';
                const grey = theme.palette.grey as unknown as
                  | Record<number, string>
                  | undefined;
                const lineColor = isDark
                  ? (grey?.[800] ?? theme.palette.divider)
                  : (grey?.[200] ?? theme.palette.divider);
                const borderColor = selected
                  ? theme.palette.primary.main
                  : lineColor;
                const leftBorderWidth =
                  (tokens as any).border?.width?.medium ?? '2px';
                const linePx = parsePx(leftBorderWidth);
                const borderBg = (color: string) => ({
                  backgroundImage: [
                    `linear-gradient(to right, ${color} 0, ${color} ${linePx}px, transparent 100%)`,
                    `linear-gradient(to right, ${color} 0, ${color} ${linePx}px, transparent 100%)`,
                  ].join(', '),
                  backgroundSize: `100% ${linePx}px, 100% ${linePx}px`,
                  backgroundPosition: '0 0, 0 100%',
                  backgroundRepeat: 'no-repeat',
                });
                return {
                  position: 'relative',
                  borderRadius: tokens.border.radius.lg,
                  backgroundColor: 'transparent',
                  ...borderBg(borderColor),
                  cursor: enabled ? 'pointer' : 'default',
                  overflow: 'hidden',
                  px: 2,
                  py: 1.5,
                  '&:hover': enabled
                    ? {
                        ...borderBg(theme.palette.primary.main),
                      }
                    : {},
                  '&:active': enabled
                    ? {
                        ...borderBg(theme.palette.primary.main),
                        '--option-active-color': theme.palette.primary.main,
                        '& > .MuiTypography-root.MuiTypography-subtitle1': {
                          color: 'var(--option-active-color)',
                          fontWeight: 500,
                        },
                      }
                    : {},
                };
              }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 500,
                  position: 'relative',
                  zIndex: 1,
                  color: selected
                    ? theme.palette.primary.main
                    : 'var(--option-active-color, inherit)',
                }}>
                {opt.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </QuestionShell>
  );
};

/**
 * Keyboard-free dropdown for `oneOf` enums (the shape produced by shared
 * `$ref` choice lists). The stock `MaterialOneOfEnumControl` defaults to an
 * Autocomplete, which opens the on-screen keyboard on tablets/phones. This
 * override renders a plain MUI `Select` (menu picker) instead. The theme sets
 * `MuiSelect` `inputProps.readOnly`/`inputMode: 'none'`, so no keyboard appears.
 *
 * Opt back into the searchable Autocomplete per field with
 * `ui.json` `"options": { "autocomplete": true }` (then the tester below
 * defers to the stock rank-5 control).
 */
const selectOneOfEnumControlTester: RankedTester = rankWith(
  6,
  (uischema, schema, context) => {
    if (!isOneOfEnumControl(uischema, schema, context)) {
      return false;
    }
    // Defer to format-based renderers (custom question types share rank 6 and
    // are registered later in the array, so on a tie the first match would win
    // here). A field that declares a `format` wants that specialized renderer
    // (e.g. GBMIS `native_enum`), so this Select only claims plain $ref/oneOf.
    if ((schema as any)?.format) {
      return false;
    }
    // Explicit opt-in to the searchable Autocomplete -> let the stock control win.
    const autocomplete = (uischema as any)?.options?.autocomplete;
    return autocomplete !== true;
  },
);

const SelectOneOfEnumControl = (props: ControlProps & OwnPropsOfEnum) => {
  const {
    data,
    handleChange,
    path,
    schema,
    uischema,
    errors,
    enabled = true,
    options = [],
  } = props;
  const label = (uischema as any)?.label || schema.title;
  const description = schema.description;
  const required = Boolean(
    (uischema as any)?.options?.required ?? (schema as any)?.options?.required,
  );
  const hasError = Boolean(errors && errors.length > 0);
  const placeholder =
    typeof (uischema as any)?.options?.placeholder === 'string'
      ? (uischema as any).options.placeholder
      : '—';

  return (
    <QuestionShell
      title={label}
      description={description}
      required={required}
      error={errors}>
      <FormControl fullWidth error={hasError} disabled={!enabled}>
        <Select
          value={data ?? ''}
          displayEmpty
          onChange={event => {
            const value = event.target.value;
            handleChange(path, value === '' ? undefined : value);
          }}
          renderValue={(selected: unknown) => {
            if (selected === undefined || selected === null || selected === '') {
              return <em>{placeholder}</em>;
            }
            const match = options.find(o => o.value === selected);
            return match ? match.label : String(selected);
          }}>
          <MenuItem value="">
            <em>{placeholder}</em>
          </MenuItem>
          {options.map(option => (
            <MenuItem key={String(option.value)} value={option.value as any}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {hasError ? <FormHelperText>{errors}</FormHelperText> : null}
      </FormControl>
    </QuestionShell>
  );
};

// ---------------------------------------------------------------------------
// Choice display options (opt-in via `ui.json` control `options`)
//
//   options.display:
//     single-select (enum / oneOf): "radio" | "buttons"
//     multi-select  (array enum):   "checkboxes" | "buttons"
//   options.orientation: "vertical" (default) | "horizontal" | "flow" (wrap)
//   options.buttonGroup: "segmented" (default) | "separated"
//
// Single-select radio/buttons support tap-the-selected-option-to-clear.
// These claim rank 7 so they win over the rank-6 enum controls, but only when
// `options.display` is set and the field has no `schema.format` (so custom
// question types like `native_enum` still win).
// ---------------------------------------------------------------------------

type ChoiceOption = { value: unknown; label: string };

const deriveChoiceOptions = (schema: any): ChoiceOption[] =>
  schema.oneOf?.map((o: any) => ({
    value: o.const ?? o.enum?.[0] ?? o,
    label: o.title ?? String(o.const ?? o),
  })) ||
  (schema.enum || []).map((v: any) => ({ value: v, label: String(v) }));

type ChoiceOrientation = 'vertical' | 'horizontal' | 'flow';

const readChoiceLayout = (uischema: any) => {
  const o = uischema?.options ?? {};
  const orientation: ChoiceOrientation =
    o.orientation === 'horizontal' || o.orientation === 'flow'
      ? o.orientation
      : 'vertical';
  const separated = o.buttonGroup === 'separated';
  return { orientation, separated };
};

const choiceListSx = (orientation: ChoiceOrientation) => ({
  display: 'flex',
  flexDirection: orientation === 'vertical' ? 'column' : 'row',
  flexWrap: orientation === 'flow' ? 'wrap' : 'nowrap',
  gap: orientation === 'vertical' ? 0 : 0.5,
});

const toggleGroupSx = (orientation: ChoiceOrientation, separated: boolean) => ({
  flexWrap: orientation === 'flow' ? 'wrap' : 'nowrap',
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
});

export const choiceControlTester: RankedTester = rankWith(
  7,
  and(
    or(isEnumControl, isOneOfEnumControl),
    schemaMatches(schema => !(schema as any)?.format),
    or(optionIs('display', 'radio'), optionIs('display', 'buttons')),
  ),
);

export const ChoiceControl = (props: AnyControlProps) => {
  const {
    data,
    handleChange,
    path,
    schema,
    uischema,
    errors,
    enabled = true,
  } = props;
  const label = (uischema as any)?.label || schema.title;
  const description = schema.description;
  const required = Boolean(
    (uischema as any)?.options?.required ?? (schema as any)?.options?.required,
  );
  const display = (uischema as any)?.options?.display;
  const { orientation, separated } = readChoiceLayout(uischema);
  const options = deriveChoiceOptions(schema);

  const body =
    display === 'buttons' ? (
      <ToggleButtonGroup
        exclusive
        disabled={!enabled}
        orientation={orientation === 'vertical' ? 'vertical' : 'horizontal'}
        value={data ?? null}
        onChange={(_e, val) => {
          if (!enabled) return;
          // Exclusive group returns null when re-clicking the active option,
          // which gives tap-to-clear for free.
          handleChange(path, val == null ? undefined : val);
        }}
        sx={toggleGroupSx(orientation, separated)}>
        {options.map(opt => (
          <ToggleButton key={String(opt.value)} value={opt.value as any}>
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    ) : (
      <Box role="radiogroup" sx={choiceListSx(orientation)}>
        {options.map(opt => {
          const selected = data === opt.value;
          return (
            <FormControlLabel
              key={String(opt.value)}
              disabled={!enabled}
              control={
                <Radio
                  checked={selected}
                  onClick={() => {
                    if (!enabled) return;
                    // Tap the selected option again to clear it.
                    handleChange(path, selected ? undefined : opt.value);
                  }}
                />
              }
              label={opt.label}
            />
          );
        })}
      </Box>
    );

  return (
    <QuestionShell
      title={label}
      description={description}
      required={required}
      error={errors}
      block={display === 'buttons' || orientation !== 'vertical'}>
      {body}
    </QuestionShell>
  );
};

export const multiChoiceControlTester: RankedTester = rankWith(
  7,
  and(
    uiTypeIs('Control'),
    schemaMatches(
      schema =>
        (schema as any)?.type === 'array' &&
        !!(schema as any)?.items &&
        (Array.isArray((schema as any).items.oneOf) ||
          Array.isArray((schema as any).items.enum)),
    ),
    or(optionIs('display', 'checkboxes'), optionIs('display', 'buttons')),
  ),
);

export const MultiChoiceControl = (
  props: ControlProps & OwnPropsOfEnum & DispatchPropsOfMultiEnumControl,
) => {
  const {
    data,
    options = [],
    addItem,
    removeItem,
    path,
    schema,
    uischema,
    errors,
    enabled = true,
  } = props;
  const label = (uischema as any)?.label || schema.title;
  const description = schema.description;
  const required = Boolean((uischema as any)?.options?.required);
  const display = (uischema as any)?.options?.display;
  const { orientation, separated } = readChoiceLayout(uischema);
  const selected: unknown[] = Array.isArray(data) ? data : [];
  const isSelected = (v: unknown) => selected.includes(v);
  const toggle = (v: unknown) => {
    if (!enabled) return;
    if (isSelected(v)) removeItem?.(path, v);
    else addItem?.(path, v);
  };

  const body =
    display === 'buttons' ? (
      <ToggleButtonGroup
        disabled={!enabled}
        orientation={orientation === 'vertical' ? 'vertical' : 'horizontal'}
        value={selected as any}
        onChange={(_e, newVals: unknown[]) => {
          if (!enabled) return;
          newVals
            .filter(v => !selected.includes(v))
            .forEach(v => addItem?.(path, v));
          selected
            .filter(v => !newVals.includes(v))
            .forEach(v => removeItem?.(path, v));
        }}
        sx={toggleGroupSx(orientation, separated)}>
        {options.map(opt => (
          <ToggleButton key={String(opt.value)} value={opt.value as any}>
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    ) : (
      <FormGroup sx={choiceListSx(orientation)}>
        {options.map(opt => (
          <FormControlLabel
            key={String(opt.value)}
            disabled={!enabled}
            control={
              <Checkbox
                checked={isSelected(opt.value)}
                onChange={() => toggle(opt.value)}
              />
            }
            label={opt.label}
          />
        ))}
      </FormGroup>
    );

  return (
    <QuestionShell
      title={label}
      description={description}
      required={required}
      error={errors}
      block={display === 'buttons' || orientation !== 'vertical'}>
      {body}
    </QuestionShell>
  );
};

// NOTE: We removed the shell wrappers for text/number/integer/date controls because
// they interfere with JSONForms' internal cell rendering mechanism.
// The default materialRenderers handle these controls properly.
// Only export custom renderers that don't break cell rendering.
export const shellMaterialRenderers = [
  // Card-style enum control - a custom renderer that uses QuestionShell
  {
    tester: cardEnumControlTester,
    renderer: withJsonFormsControlProps(CardEnumControl),
  },
  // Keyboard-free Select for oneOf enums (shared $ref choice lists)
  {
    tester: selectOneOfEnumControlTester,
    renderer: withJsonFormsOneOfEnumProps(SelectOneOfEnumControl),
  },
  // Opt-in radio / button single-select (ui.json options.display)
  {
    tester: choiceControlTester,
    renderer: withJsonFormsControlProps(ChoiceControl),
  },
  // Opt-in checkbox / button multi-select (ui.json options.display)
  {
    tester: multiChoiceControlTester,
    renderer: withJsonFormsMultiEnumProps(MultiChoiceControl),
  },
];
