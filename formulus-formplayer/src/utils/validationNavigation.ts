/**
 * Helpers for surfacing validation errors on SwipeLayout Done / Finalize actions.
 */

export type BlockingValidationError = {
  instancePath?: string;
  schemaPath?: string;
  path?: string;
  keyword?: string;
  params?: { missingProperty?: string; [key: string]: unknown };
};

/**
 * AJV `required` errors use an empty `instancePath` and put the field name in
 * `params.missingProperty`. Resolve a navigable/display path for any AJV-like error.
 */
export function instancePathForAjvError(
  error: BlockingValidationError,
): string | null {
  const missing =
    error.keyword === 'required' ? error.params?.missingProperty : undefined;
  if (typeof missing === 'string' && missing.length > 0) {
    const parent = error.instancePath ?? '';
    return parent ? `${parent}/${missing}` : `/${missing}`;
  }

  if (error.instancePath) return error.instancePath;
  if (typeof error.path === 'string' && error.path.length > 0) {
    // Mirror normalizeErrorInstancePath for #/properties/… custom-validator paths.
    if (error.path.startsWith('#/properties/')) {
      const tail = error.path
        .replace(/^#\/properties\//, '')
        .replace(/\/items\/properties\//g, '/')
        .replace(/\/items$/, '');
      return `/${tail}`;
    }
    return error.path.startsWith('/') ? error.path : `/${error.path}`;
  }

  return null;
}

export function firstBlockingErrorInstancePath(
  errors: ReadonlyArray<BlockingValidationError>,
): string | null {
  const first = errors[0];
  if (!first) return null;
  return instancePathForAjvError(first);
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
