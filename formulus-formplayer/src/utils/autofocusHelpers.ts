/** Whether a Control ui schema opts into autofocus when its page is shown. */
export function controlWantsAutoFocus(uischema: unknown): boolean {
  if (!uischema || typeof uischema !== 'object') return false;
  const options = (uischema as { options?: { autoFocus?: boolean } }).options;
  return options?.autoFocus === true;
}

/** First property key on the current page with `options.autoFocus: true`. */
export function findAutoFocusPropertyPath(
  uischema: unknown,
): string | undefined {
  let found: string | undefined;

  const walk = (node: unknown): void => {
    if (found || !node || typeof node !== 'object') return;
    const ui = node as {
      type?: string;
      scope?: string;
      options?: { autoFocus?: boolean };
      elements?: unknown[];
    };

    if (
      ui.type === 'Control' &&
      controlWantsAutoFocus(ui) &&
      typeof ui.scope === 'string'
    ) {
      const match = /^#\/properties\/(.+)$/.exec(ui.scope);
      if (match?.[1]) {
        found = match[1];
        return;
      }
    }

    if (Array.isArray(ui.elements)) {
      for (const child of ui.elements) {
        walk(child);
        if (found) return;
      }
    }
  };

  walk(uischema);
  return found;
}

export function focusFieldInContainer(
  container: HTMLElement,
  propertyPath?: string,
): boolean {
  const marked = container.querySelector<HTMLElement>(
    '[data-formplayer-autofocus="true"]',
  );
  if (marked && typeof marked.focus === 'function') {
    try {
      marked.focus({ preventScroll: true });
    } catch {
      marked.focus();
    }
    return true;
  }

  if (propertyPath) {
    const byName = container.querySelector<HTMLElement>(
      `input[name="${CSS.escape(propertyPath)}"], textarea[name="${CSS.escape(propertyPath)}"]`,
    );
    if (byName && typeof byName.focus === 'function') {
      try {
        byName.focus({ preventScroll: true });
      } catch {
        byName.focus();
      }
      return true;
    }
  }

  return false;
}

/** Focus first enabled text-like input on the screen. */
export function focusFirstEnabledTextInput(
  container: HTMLElement | null,
): void {
  if (!container) return;
  const sel =
    'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"]),textarea:not([disabled])';
  const el = container.querySelector<HTMLElement>(sel);
  if (!el || typeof el.focus !== 'function') return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}
