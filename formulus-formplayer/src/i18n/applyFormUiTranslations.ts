import { localeLookupCandidates } from './localeUtils';

type UiSchemaNode = Record<string, unknown>;

const TRANSLATABLE_TOP_KEYS = new Set([
  'label',
  'description',
  'text',
  'headerTitle',
  'nextButtonLabel',
  'finalizeButtonLabel',
]);

/** Keys that live under `options` on SwipeLayout / Control. */
const SWIPE_OPTION_KEYS = new Set([
  'headerTitle',
  'nextButtonLabel',
  'finalizeButtonLabel',
]);

const CONTROL_OPTION_KEYS = new Set(['addButtonLabel']);

function hasTranslationsSubtree(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) {
    return node.some(hasTranslationsSubtree);
  }
  const obj = node as UiSchemaNode;
  if (obj.translations && typeof obj.translations === 'object') return true;
  if (Array.isArray(obj.elements)) {
    return obj.elements.some(hasTranslationsSubtree);
  }
  if (obj.options && typeof obj.options === 'object') {
    if (Array.isArray((obj.options as UiSchemaNode).columns)) {
      if (
        ((obj.options as UiSchemaNode).columns as unknown[]).some(
          hasTranslationsSubtree,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function pickLocaleBlock(
  translations: Record<string, unknown>,
  locale: string,
): Record<string, unknown> | null {
  for (const candidate of localeLookupCandidates(locale)) {
    const block = translations[candidate];
    if (block && typeof block === 'object' && !Array.isArray(block)) {
      return block as Record<string, unknown>;
    }
  }
  return null;
}

function mergeOptionsArraysByConst(
  base: unknown[],
  patch: unknown[],
): unknown[] {
  const result = base.map(item =>
    item && typeof item === 'object' ? { ...(item as object) } : item,
  );
  for (const patchItem of patch) {
    if (!patchItem || typeof patchItem !== 'object') continue;
    const patchObj = patchItem as Record<string, unknown>;
    const patchConst = patchObj.const;
    let matched = false;
    if (patchConst !== undefined) {
      for (let i = 0; i < result.length; i++) {
        const baseItem = result[i];
        if (
          baseItem &&
          typeof baseItem === 'object' &&
          (baseItem as Record<string, unknown>).const === patchConst
        ) {
          result[i] = { ...(baseItem as object), ...patchObj };
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      result.push(patchItem);
    }
  }
  return result;
}

function deepMergeOptions(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, patchVal] of Object.entries(patch)) {
    const baseVal = out[key];
    if (
      key === 'oneOf' ||
      key === 'columns' ||
      (Array.isArray(patchVal) && Array.isArray(baseVal))
    ) {
      out[key] = mergeOptionsArraysByConst(
        Array.isArray(baseVal) ? baseVal : [],
        Array.isArray(patchVal) ? patchVal : [],
      );
    } else if (
      patchVal &&
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      out[key] = deepMergeOptions(
        baseVal as Record<string, unknown>,
        patchVal as Record<string, unknown>,
      );
    } else {
      out[key] = patchVal;
    }
  }
  return out;
}

function applyBlockToNode(
  node: UiSchemaNode,
  block: Record<string, unknown>,
): UiSchemaNode {
  const out: UiSchemaNode = { ...node };
  const optionsBase =
    out.options &&
    typeof out.options === 'object' &&
    !Array.isArray(out.options)
      ? { ...(out.options as Record<string, unknown>) }
      : {};

  for (const [key, val] of Object.entries(block)) {
    if (key === 'title') {
      continue;
    }
    if (
      key === 'options' &&
      val &&
      typeof val === 'object' &&
      !Array.isArray(val)
    ) {
      out.options = deepMergeOptions(
        optionsBase,
        val as Record<string, unknown>,
      );
      continue;
    }
    if (SWIPE_OPTION_KEYS.has(key)) {
      out.options = {
        ...((out.options as Record<string, unknown>) ?? {}),
        [key]: val,
      };
      continue;
    }
    if (CONTROL_OPTION_KEYS.has(key)) {
      out.options = {
        ...((out.options as Record<string, unknown>) ?? {}),
        [key]: val,
      };
      continue;
    }
    if (TRANSLATABLE_TOP_KEYS.has(key)) {
      out[key] = val;
    }
  }

  const blockLabel = block.label;
  const blockTitle = block.title;
  if (typeof blockLabel === 'string') {
    out.label = blockLabel;
  } else if (
    typeof blockTitle === 'string' &&
    (out.label === undefined || out.label === null)
  ) {
    out.label = blockTitle;
  }

  return out;
}

function processNode(node: unknown, locale: string): unknown {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map(child => {
      const processed = processNode(child, locale);
      if (processed !== child) changed = true;
      return processed;
    });
    return changed ? next : node;
  }

  const obj = node as UiSchemaNode;
  let result: UiSchemaNode = obj;
  let changed = false;

  const translations = obj.translations;
  if (translations && typeof translations === 'object') {
    const block = pickLocaleBlock(
      translations as Record<string, unknown>,
      locale,
    );
    if (block) {
      result = applyBlockToNode(result, block);
      changed = true;
    }
  }

  if (Array.isArray(obj.elements)) {
    let elementsChanged = false;
    const newElements = obj.elements.map(el => {
      const processed = processNode(el, locale);
      if (processed !== el) elementsChanged = true;
      return processed;
    });
    if (elementsChanged) {
      result = changed
        ? { ...result, elements: newElements }
        : { ...obj, elements: newElements };
      changed = true;
    }
  }

  if (
    result.options &&
    typeof result.options === 'object' &&
    !Array.isArray(result.options)
  ) {
    const opts = result.options as Record<string, unknown>;
    if (Array.isArray(opts.columns)) {
      let colsChanged = false;
      const newCols = opts.columns.map(col => {
        const processed = processNode(col, locale);
        if (processed !== col) colsChanged = true;
        return processed;
      });
      if (colsChanged) {
        result = {
          ...result,
          options: { ...opts, columns: newCols },
        };
        changed = true;
      }
    }
  }

  if (changed && result.translations) {
    const { translations: _removed, ...without } = result;
    return without;
  }

  return changed ? result : node;
}

/**
 * Apply embedded ui.json translations for the active locale (once at form init).
 * Returns the same reference when no translations exist in the tree.
 */
export function applyFormUiTranslations<T>(uischema: T, locale: string): T {
  if (!uischema || typeof uischema !== 'object') return uischema;
  if (!hasTranslationsSubtree(uischema)) return uischema;
  return processNode(uischema, locale) as T;
}
