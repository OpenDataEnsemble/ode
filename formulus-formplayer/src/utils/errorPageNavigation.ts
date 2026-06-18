/**
 * Map AJV / custom-validator instance paths to SwipeLayout page indices.
 */

import {
  isControl,
  type JsonSchema7,
  type UISchemaElement,
} from '@jsonforms/core';
import type { BlockingValidationError } from './validationNavigation';

function escapeRegex(segment: string): string {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `#/properties/a/items/properties/b` → regex matching `/a/0/b`. */
export function scopeToInstancePathRegex(scope: string): RegExp | null {
  if (!scope?.startsWith('#/')) return null;

  const parts = scope.replace(/^#\//, '').split('/');
  const segments: string[] = [];

  for (const part of parts) {
    if (part === 'properties') continue;
    if (part === 'items') {
      segments.push('\\d+');
      continue;
    }
    segments.push(escapeRegex(part));
  }

  if (segments.length === 0) return null;
  return new RegExp(`^/${segments.join('/')}(/|$)`);
}

/** Convert `#/properties/foo` or AJV `/foo` to a comparable instance path. */
export function normalizeErrorInstancePath(path: string): string {
  if (!path) return '';
  if (path.startsWith('#/properties/')) {
    const tail = path
      .replace(/^#\/properties\//, '')
      .replace(/\/items\/properties\//g, '/')
      .replace(/\/items$/, '');
    return `/${tail}`;
  }
  return path.startsWith('/') ? path : `/${path}`;
}

export function instancePathMatchesControlScope(
  instancePath: string,
  scope: string | undefined,
): boolean {
  if (!scope) return false;
  const normalized = normalizeErrorInstancePath(instancePath);
  const regex = scopeToInstancePathRegex(scope);
  if (regex?.test(normalized)) return true;

  const leaf = normalized.split('/').filter(Boolean).pop();
  if (!leaf || /^\d+$/.test(leaf)) return false;
  return scope.includes(leaf);
}

export function collectControlsInSubtree(
  root: UISchemaElement,
): Array<{ scope: string }> {
  const controls: Array<{ scope: string }> = [];

  function walk(el: UISchemaElement) {
    if (isControl(el)) {
      const scope = (el as { scope?: string }).scope;
      if (scope) controls.push({ scope });
      return;
    }
    const children = (el as { elements?: UISchemaElement[] }).elements;
    if (!Array.isArray(children)) return;
    for (const child of children) walk(child);
  }

  walk(root);
  return controls;
}

export function getSwipeLayoutPages(
  uischema: UISchemaElement | null | undefined,
): { layouts: UISchemaElement[]; headerFields: string[] } {
  if (!uischema) return { layouts: [], headerFields: [] };

  const typed = uischema as {
    type?: string;
    elements?: UISchemaElement[];
    options?: { headerFields?: string[] };
  };

  if (typed.type === 'SwipeLayout' && Array.isArray(typed.elements)) {
    return {
      layouts: typed.elements,
      headerFields: (typed.options?.headerFields ?? []).slice(0, 2),
    };
  }

  if (typed.type === 'Group') {
    return { layouts: [uischema], headerFields: [] };
  }

  return { layouts: [], headerFields: [] };
}

/**
 * Shallowest swipe page index containing a control for `instancePath`, or null.
 */
export function findSwipePageIndexForInstancePath(
  layouts: UISchemaElement[],
  instancePath: string,
  headerFields: string[] = [],
): number | null {
  const normalized = normalizeErrorInstancePath(instancePath);
  const topLevelField = normalized
    .replace(/^\//, '')
    .split('/')
    .find(segment => segment && !/^\d+$/.test(segment));

  if (topLevelField && headerFields.includes(topLevelField)) {
    const firstContent = layouts.findIndex(
      page => (page as { type?: string }).type !== 'Finalize',
    );
    return firstContent >= 0 ? firstContent : null;
  }

  for (let i = 0; i < layouts.length; i++) {
    const page = layouts[i];
    if ((page as { type?: string }).type === 'Finalize') continue;

    const controls = collectControlsInSubtree(page);
    if (
      controls.some(({ scope }) =>
        instancePathMatchesControlScope(normalized, scope),
      )
    ) {
      return i;
    }
  }

  return null;
}

export function resolveErrorPageIndex(
  uischema: UISchemaElement | null | undefined,
  errorPath: string,
): number | null {
  const { layouts, headerFields } = getSwipeLayoutPages(uischema);
  if (layouts.length === 0) return null;
  return findSwipePageIndexForInstancePath(layouts, errorPath, headerFields);
}

function titleAtSchemaPath(
  schema: JsonSchema7 | undefined,
  propertyPath: string[],
): string | null {
  if (!schema || propertyPath.length === 0) return null;

  let current: JsonSchema7 | undefined = schema;
  for (const part of propertyPath) {
    if (!current) return null;
    if (current.properties?.[part]) {
      current = current.properties[part] as JsonSchema7;
      continue;
    }
    if (current.items && typeof current.items === 'object') {
      current = current.items as JsonSchema7;
      if (current.properties?.[part]) {
        current = current.properties[part] as JsonSchema7;
        continue;
      }
    }
    return part;
  }

  return (
    (current as { title?: string })?.title ??
    propertyPath[propertyPath.length - 1] ??
    null
  );
}

export function titleForErrorPath(
  errorPath: string,
  schema: JsonSchema7 | undefined,
): string | null {
  const normalized = normalizeErrorInstancePath(errorPath);
  const propertyPath = normalized
    .split('/')
    .filter(segment => segment && !/^\d+$/.test(segment));
  return titleAtSchemaPath(schema, propertyPath);
}

/** Human-readable summary for skipFinalize Done alert (field titles, not count only). */
export function formatBlockingErrorSummary(
  errors: ReadonlyArray<BlockingValidationError & { message?: string }>,
  schema: JsonSchema7 | undefined,
  maxTitles = 3,
): string {
  if (errors.length === 0) return '';

  const titles: string[] = [];
  for (const err of errors) {
    const path =
      err.instancePath ?? (typeof err.path === 'string' ? err.path : undefined);
    const title = path ? titleForErrorPath(path, schema) : null;
    const label = title || err.message;
    if (label && !titles.includes(label)) titles.push(label);
    if (titles.length >= maxTitles) break;
  }

  const remaining = errors.length - titles.length;
  const joined = titles.join(', ');
  const suffix = remaining > 0 ? ` (+${remaining} more)` : '';
  const countPhrase =
    errors.length === 1 ? '1 field needs' : `${errors.length} fields need`;

  if (joined) {
    return `${countPhrase} attention: ${joined}${suffix}. Tap Done to review.`;
  }

  return `${countPhrase} attention. Tap Done to review.`;
}
