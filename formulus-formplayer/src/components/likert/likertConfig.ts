import type { JsonSchema } from '@jsonforms/core';
import { getPresetOptions } from './likertPresets';
import type {
  LikertConfig,
  LikertDisplay,
  LikertOption,
  ResolvedLikertOptions,
} from './likertTypes';
import { resolveEffectiveColorMode } from './likertColors';

type OneOfEntry = {
  const?: unknown;
  enum?: unknown[];
  title?: string;
  emoji?: string;
};

function oneOfToOptions(oneOf: OneOfEntry[]): LikertOption[] {
  return oneOf.map(entry => {
    const value =
      entry.const !== undefined
        ? (entry.const as string | number)
        : (entry.enum?.[0] as string | number);
    return {
      value,
      label: entry.title ?? String(value),
      emoji: entry.emoji,
    };
  });
}

export function parseLikertConfig(schema: JsonSchema): LikertConfig {
  const raw = (schema as Record<string, unknown>).likert;
  if (!raw || typeof raw !== 'object') return {};
  return raw as LikertConfig;
}

export function resolveLikertOptions(
  schema: JsonSchema,
  uischema?: { options?: Record<string, unknown> },
): ResolvedLikertOptions {
  const config = parseLikertConfig(schema);
  const uiOptions = uischema?.options ?? {};

  let options: LikertOption[] = [];
  const schemaOneOf = (schema as { oneOf?: OneOfEntry[] }).oneOf;
  if (schemaOneOf && schemaOneOf.length > 0) {
    options = oneOfToOptions(schemaOneOf);
  } else if (config.preset) {
    options = getPresetOptions(config.preset);
  }

  const uiDisplay = uiOptions.display as LikertDisplay | undefined;
  const display =
    uiDisplay ?? config.display ?? (options.length > 7 ? 'slider' : 'buttons');

  const orientation =
    uiOptions.orientation === 'vertical' ? 'vertical' : 'horizontal';

  const colorMode = resolveEffectiveColorMode(display, config.colorMode);

  return {
    options,
    display,
    colorMode,
    endpointLabelsOnly:
      config.endpointLabelsOnly ?? uiOptions.endpointLabelsOnly === true,
    allowClear: config.allowClear !== false,
    allowNotApplicable: config.allowNotApplicable === true,
    notApplicableLabel: config.notApplicableLabel ?? 'Not applicable',
    notApplicableValue:
      config.notApplicableValue !== undefined
        ? config.notApplicableValue
        : null,
    orientation,
  };
}

export function findOptionLabel(
  options: LikertOption[],
  value: unknown,
): string | null {
  if (value === undefined || value === null || value === '') return null;
  const match = options.find(o => valuesEqual(o.value, value));
  return match?.label ?? String(value);
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return String(a) === String(b);
}

export function isNotApplicableValue(
  value: unknown,
  naValue: null | string | number,
): boolean {
  if (value === undefined || value === '') return false;
  if (naValue === null) return value === null;
  return valuesEqual(value, naValue);
}
