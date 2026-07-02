import type { JsonSchema } from '@jsonforms/core';
import { parseChoiceLayout } from '../../theme/choiceLayout';
import { getPresetOptions } from './likertPresets';
import type {
  LikertConfig,
  LikertDisplay,
  LikertOneOfEntry,
  LikertOption,
  ResolvedLikertOptions,
} from './likertTypes';
import { resolveEffectiveColorMode } from './likertColors';

type OneOfEntry = LikertOneOfEntry;

function oneOfToOptions(oneOf: OneOfEntry[]): LikertOption[] {
  return oneOf.map(entry => ({
    value: entry.const,
    label: entry.title ?? String(entry.const),
    emoji: entry.emoji,
  }));
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

  // Localized option labels: `ui.json` `options.oneOf` (populated per active
  // locale by the translation merge) overrides titles/emoji by matching
  // `const`, so scale labels can be translated the same way as custom types.
  const uiOneOf = Array.isArray(uiOptions.oneOf)
    ? (uiOptions.oneOf as OneOfEntry[])
    : undefined;
  if (uiOneOf && uiOneOf.length > 0) {
    if (options.length === 0) {
      options = oneOfToOptions(uiOneOf);
    } else {
      const byConst = new Map(
        uiOneOf.map(entry => [String(entry.const), entry]),
      );
      options = options.map(opt => {
        const override = byConst.get(String(opt.value));
        if (!override) return opt;
        return {
          ...opt,
          label: override.title ?? opt.label,
          emoji: override.emoji ?? opt.emoji,
        };
      });
    }
  }

  const allowNotApplicable = config.allowNotApplicable === true;
  const notApplicableValue =
    config.notApplicableValue !== undefined ? config.notApplicableValue : null;

  // The N/A choice is rendered by the control's own pill, so drop any scale
  // option that matches the N/A value (it may be present because we inject a
  // matching branch into `oneOf` for validation — see injectLikertNotApplicable).
  if (allowNotApplicable) {
    options = options.filter(o => !valuesEqual(o.value, notApplicableValue));
  }

  const uiDisplay = uiOptions.display as LikertDisplay | undefined;
  const display =
    uiDisplay ?? config.display ?? (options.length > 7 ? 'slider' : 'buttons');

  const layout =
    uiOptions.orientation != null
      ? parseChoiceLayout(uiOptions)
      : { mode: 'horizontal' as const };

  const colorMode = resolveEffectiveColorMode(display, config.colorMode);

  return {
    options,
    display,
    colorMode,
    endpointLabelsOnly:
      config.endpointLabelsOnly ?? uiOptions.endpointLabelsOnly === true,
    allowClear: config.allowClear !== false,
    allowNotApplicable,
    notApplicableLabel: config.notApplicableLabel ?? 'Not applicable',
    notApplicableValue,
    layout,
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

type MutableSchemaNode = Record<string, unknown> & {
  type?: unknown;
  format?: unknown;
  likert?: {
    allowNotApplicable?: boolean;
    notApplicableValue?: null | string | number;
    notApplicableLabel?: string;
  };
  oneOf?: Array<{ const?: unknown; title?: string }>;
  properties?: Record<string, unknown>;
  items?: unknown;
};

function ensureTypeAllowsNull(node: MutableSchemaNode): void {
  if (node.type === undefined) return;
  if (Array.isArray(node.type)) {
    if (!node.type.includes('null')) node.type = [...node.type, 'null'];
  } else if (typeof node.type === 'string' && node.type !== 'null') {
    node.type = [node.type, 'null'];
  }
}

function normalizeLikertNode(node: MutableSchemaNode): void {
  if (node.format === 'likert' && node.likert?.allowNotApplicable === true) {
    const naValue =
      node.likert.notApplicableValue !== undefined
        ? node.likert.notApplicableValue
        : null;

    if (naValue === null) ensureTypeAllowsNull(node);

    if (Array.isArray(node.oneOf)) {
      const exists = node.oneOf.some(entry => valuesEqual(entry?.const, naValue));
      if (!exists) {
        node.oneOf = [
          ...node.oneOf,
          {
            const: naValue as string | number | null,
            title: node.likert.notApplicableLabel ?? 'Not applicable',
          },
        ];
      }
    }
  }

  if (node.properties && typeof node.properties === 'object') {
    for (const child of Object.values(node.properties)) {
      if (child && typeof child === 'object') {
        normalizeLikertNode(child as MutableSchemaNode);
      }
    }
  }

  if (node.items && typeof node.items === 'object') {
    normalizeLikertNode(node.items as MutableSchemaNode);
  }
}

/**
 * Returns a deep clone of a form schema in which every `format: "likert"` field
 * with `allowNotApplicable` accepts its N/A value during validation. Without
 * this, a `null` (N/A) value fails the field's `oneOf`/`type` constraints even
 * though the control offers the N/A choice. The injected branch is filtered out
 * of the displayed options by resolveLikertOptions, so no duplicate button shows.
 */
export function injectLikertNotApplicable<T>(schema: T): T {
  if (!schema || typeof schema !== 'object') return schema;
  const clone = JSON.parse(JSON.stringify(schema)) as MutableSchemaNode;
  normalizeLikertNode(clone);
  return clone as unknown as T;
}
