import {
  and,
  or,
  not,
  hasType,
  isEnumControl,
  isOneOfEnumControl,
  optionIs,
  schemaMatches,
  schemaSubPathMatches,
  resolveSchema,
  uiTypeIs,
  RankedTester,
  rankWith,
  ControlProps,
  OwnPropsOfEnum,
  DispatchPropsOfMultiEnumControl,
  JsonSchema,
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
  Radio,
  Checkbox,
  FormControlLabel,
  FormGroup,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import QuestionShell from '../components/QuestionShell';
import { isControlHidden } from '../jsonforms/visibleGuard';
import { tokens } from './tokens-adapter';
import {
  parseChoiceLayout,
  choiceListSx,
  toggleButtonListSx,
  toggleButtonOrientation,
} from './choiceLayout';
import { ChoiceOptionList } from './ChoiceOptionList';

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
    visible,
  } = props;

  if (isControlHidden(visible)) return null;
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
 * Autocomplete, which opens the on-screen keyboard on tablets/phones.
 *
 * Uses a **native** `<select>` so the
 * picker works inside Formulus / ODE Desktop WebViews — MUI Menu portals and
 * `readOnly` on the faux input both break menu open on mobile WebViews.
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
    // (e.g. a custom `format` renderer), so this Select only claims plain $ref/oneOf.
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
    visible,
  } = props;

  if (isControlHidden(visible)) return null;
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
      <FormControl
        fullWidth
        variant="outlined"
        error={hasError}
        disabled={!enabled}>
        <Select
          native
          value={data ?? ''}
          displayEmpty
          onChange={event => {
            const value = event.target.value;
            handleChange(path, value === '' ? undefined : value);
          }}
          inputProps={{
            'aria-label':
              typeof label === 'string' ? label : (schema.title ?? undefined),
          }}>
          <option value="">{placeholder}</option>
          {options.map(option => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormControl>
    </QuestionShell>
  );
};

// ---------------------------------------------------------------------------
// Default multi-select (array enum) — QuestionShell + vertical checkboxes
// Replaces stock MaterialEnumArrayRenderer (legend above row of boxes) in
// SwipeLayout inline mode. Opt-in display modes stay on MultiChoiceControl (7).
// ---------------------------------------------------------------------------

const hasOneOfItems = (schema: JsonSchema): boolean =>
  schema.oneOf !== undefined &&
  schema.oneOf.length > 0 &&
  (schema.oneOf as JsonSchema[]).every(entry => entry.const !== undefined);

const hasEnumItems = (schema: JsonSchema): boolean =>
  schema.type === 'string' && schema.enum !== undefined;

const isMultiEnumControl = and(
  uiTypeIs('Control'),
  and(
    schemaMatches(
      schema =>
        hasType(schema, 'array') &&
        !Array.isArray(schema.items) &&
        schema.uniqueItems === true,
    ),
    schemaSubPathMatches('items', (schema, rootSchema) => {
      if (!schema) return false;
      const resolvedSchema =
        schema.$ref && rootSchema
          ? resolveSchema(rootSchema, schema.$ref, rootSchema)
          : schema;
      if (!resolvedSchema) return false;
      return hasOneOfItems(resolvedSchema) || hasEnumItems(resolvedSchema);
    }),
  ),
);

export const enumArrayShellControlTester: RankedTester = rankWith(
  6,
  and(
    isMultiEnumControl,
    not(or(optionIs('display', 'checkboxes'), optionIs('display', 'buttons'))),
  ),
);

const EnumArrayShellControl = (
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
    visible,
    label,
  } = props;

  if (visible === false) return null;

  const title = (uischema as any)?.label || schema.title || label;
  const description = schema.description;
  const required = Boolean((uischema as any)?.options?.required);
  const selected: unknown[] = Array.isArray(data) ? data : [];
  const isSelected = (v: unknown) => selected.includes(v);
  const toggle = (v: unknown) => {
    if (!enabled) return;
    if (isSelected(v)) removeItem?.(path, v);
    else addItem?.(path, v);
  };

  return (
    <QuestionShell
      title={title}
      description={description}
      required={required}
      error={errors}>
      <FormGroup sx={choiceListSx({ mode: 'vertical' })}>
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
    </QuestionShell>
  );
};

// ---------------------------------------------------------------------------
// Choice display options (opt-in via `ui.json` control `options`)
//
//   options.display:
//     single-select (enum / oneOf): "radio" | "buttons"
//     multi-select  (array enum):   "checkboxes" | "buttons"
//   options.orientation: "vertical" (default) | "horizontal" | "flow" | "cols-2" … "cols-5"
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
  })) || (schema.enum || []).map((v: any) => ({ value: v, label: String(v) }));

const readChoiceLayout = (uischema: any) => {
  const o = uischema?.options ?? {};
  const layout = parseChoiceLayout(o);
  const separated = o.buttonGroup === 'separated';
  return { layout, separated };
};

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
    visible,
  } = props;

  if (isControlHidden(visible)) return null;
  const label = (uischema as any)?.label || schema.title;
  const description = schema.description;
  const required = Boolean(
    (uischema as any)?.options?.required ?? (schema as any)?.options?.required,
  );
  const display = (uischema as any)?.options?.display;
  const { layout, separated } = readChoiceLayout(uischema);
  const options = deriveChoiceOptions(schema);

  const body =
    display === 'buttons' ? (
      <ToggleButtonGroup
        exclusive
        disabled={!enabled}
        orientation={toggleButtonOrientation(layout)}
        value={data ?? null}
        onChange={(_e, val) => {
          if (!enabled) return;
          // Exclusive group returns null when re-clicking the active option,
          // which gives tap-to-clear for free.
          handleChange(path, val == null ? undefined : val);
        }}
        sx={toggleButtonListSx(layout, separated)}>
        {options.map(opt => (
          <ToggleButton key={String(opt.value)} value={opt.value as any}>
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    ) : (
      <ChoiceOptionList layout={layout} role="radiogroup">
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
      </ChoiceOptionList>
    );

  return (
    <QuestionShell
      title={label}
      description={description}
      required={required}
      error={errors}>
      {body}
    </QuestionShell>
  );
};

export const multiChoiceControlTester: RankedTester = rankWith(
  7,
  and(
    isMultiEnumControl,
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
    visible,
  } = props;

  if (isControlHidden(visible)) return null;
  const label = (uischema as any)?.label || schema.title;
  const description = schema.description;
  const required = Boolean((uischema as any)?.options?.required);
  const display = (uischema as any)?.options?.display;
  const { layout, separated } = readChoiceLayout(uischema);
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
        orientation={toggleButtonOrientation(layout)}
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
        sx={toggleButtonListSx(layout, separated)}>
        {options.map(opt => (
          <ToggleButton key={String(opt.value)} value={opt.value as any}>
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    ) : (
      <ChoiceOptionList layout={layout}>
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
      </ChoiceOptionList>
    );

  return (
    <QuestionShell
      title={label}
      description={description}
      required={required}
      error={errors}>
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
  // Default multi-select checkboxes in two-column QuestionShell
  {
    tester: enumArrayShellControlTester,
    renderer: withJsonFormsMultiEnumProps(EnumArrayShellControl),
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
