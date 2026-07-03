/**
 * Collect BCP-47 locale keys from embedded `translations` blocks in ui.json trees.
 * Mirrors the walk used by formplayer `applyFormUiTranslations`.
 */

function collectFromNode(node: unknown, out: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) {
      collectFromNode(child, out);
    }
    return;
  }

  const obj = node as Record<string, unknown>;
  const translations = obj.translations;
  if (
    translations &&
    typeof translations === 'object' &&
    !Array.isArray(translations)
  ) {
    for (const key of Object.keys(translations)) {
      const trimmed = key.trim();
      if (trimmed) out.add(trimmed);
    }
  }

  if (Array.isArray(obj.elements)) {
    for (const el of obj.elements) {
      collectFromNode(el, out);
    }
  }

  const options = obj.options;
  if (options && typeof options === 'object' && !Array.isArray(options)) {
    const opts = options as Record<string, unknown>;
    if (Array.isArray(opts.columns)) {
      for (const col of opts.columns) {
        collectFromNode(col, out);
      }
    }
  }
}

/** Union of all `translations.*` locale keys in a parsed ui.json root. */
export function collectTranslationLocalesFromUiSchema(
  uiSchema: unknown,
): string[] {
  const out = new Set<string>();
  collectFromNode(uiSchema, out);
  return Array.from(out).sort((a, b) => a.localeCompare(b));
}
