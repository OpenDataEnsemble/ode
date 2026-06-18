/** DOM rect subset used for scroll calculations. */
export interface FieldRect {
  top: number;
  bottom: number;
}

/** Prevent scrolling past the last real content row inside the form scroll area. */
export function clampScrollTop(el: HTMLElement): void {
  const max = Math.max(0, el.scrollHeight - el.clientHeight);
  if (el.scrollTop > max) {
    el.scrollTop = max;
  }
}

/**
 * True when the field is not fully visible inside the scroll container's client
 * area (with optional margins for sticky header / nav bar).
 */
export function isFieldObscuredInContainer(
  containerRect: FieldRect & { height?: number },
  fieldRect: FieldRect,
  marginTop = 8,
  marginBottom = 16,
): boolean {
  const visibleTop = containerRect.top + marginTop;
  const visibleBottom =
    containerRect.bottom !== undefined
      ? containerRect.bottom - marginBottom
      : containerRect.top + (containerRect.height ?? 0) - marginBottom;

  return fieldRect.bottom > visibleBottom || fieldRect.top < visibleTop;
}

/**
 * Minimal scroll delta (px) to bring `fieldRect` into the container's visible band.
 * Positive = scroll down, negative = scroll up. Zero when already visible.
 */
export function computeScrollDeltaForField(
  containerRect: FieldRect,
  fieldRect: FieldRect,
  marginTop = 8,
  marginBottom = 16,
): number {
  const visibleTop = containerRect.top + marginTop;
  const visibleBottom = containerRect.bottom - marginBottom;

  if (fieldRect.bottom > visibleBottom) {
    return fieldRect.bottom - visibleBottom;
  }
  if (fieldRect.top < visibleTop) {
    return fieldRect.top - visibleTop;
  }
  return 0;
}

export interface RevealFieldOptions {
  marginTop?: number;
  marginBottom?: number;
}

/**
 * Scroll the container only enough to reveal `field` when obscured.
 * Uses manual scrollTop adjustment (not scrollIntoView) to avoid WebView gaps.
 * @returns true when scroll position changed
 */
export function revealFieldIfNeeded(
  container: HTMLElement,
  field: HTMLElement,
  options: RevealFieldOptions = {},
): boolean {
  const marginTop = options.marginTop ?? 8;
  const marginBottom = options.marginBottom ?? 16;

  const containerRect = container.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();

  if (
    !isFieldObscuredInContainer(containerRect, fieldRect, marginTop, marginBottom)
  ) {
    return false;
  }

  const delta = computeScrollDeltaForField(
    containerRect,
    fieldRect,
    marginTop,
    marginBottom,
  );

  if (delta !== 0) {
    container.scrollTop += delta;
  }

  clampScrollTop(container);
  return delta !== 0;
}
