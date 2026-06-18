/**
 * Helpers for surfacing validation errors on SwipeLayout Done / Finalize actions.
 */

export type BlockingValidationError = {
  instancePath?: string;
  schemaPath?: string;
  path?: string;
};

export function firstBlockingErrorInstancePath(
  errors: ReadonlyArray<BlockingValidationError>,
): string | null {
  const first = errors[0];
  if (!first) return null;
  if (first.instancePath) return first.instancePath;
  if (typeof first.path === 'string' && first.path.length > 0) {
    return first.path;
  }
  return null;
}

/** Switch to ValidateAndShow and jump to the first blocking field when possible. */
export function navigateToFirstBlockingError(
  errors: ReadonlyArray<BlockingValidationError>,
): void {
  window.dispatchEvent(new CustomEvent('formShowValidation'));
  const instancePath = firstBlockingErrorInstancePath(errors);
  if (instancePath) {
    window.dispatchEvent(
      new CustomEvent('navigateToError', {
        detail: { path: instancePath },
      }),
    );
  }
}
