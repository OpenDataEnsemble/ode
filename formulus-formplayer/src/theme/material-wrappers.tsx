import {
  isEnumControl,
  isOneOfEnumControl,
  RankedTester,
  rankWith,
  ControlProps,
  OwnPropsOfEnum,
} from '@jsonforms/core';
import {
  withJsonFormsControlProps,
  withJsonFormsOneOfEnumProps,
} from '@jsonforms/react';
import {
  Typography,
  Box,
  useTheme,
  FormControl,
  Select,
  MenuItem,
  FormHelperText,
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
              return <em>—</em>;
            }
            const match = options.find(o => o.value === selected);
            return match ? match.label : String(selected);
          }}>
          <MenuItem value="">
            <em>—</em>
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
];
